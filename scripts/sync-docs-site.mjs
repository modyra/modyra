/**
 * Sync every Markdown file under docs/ into generated Starlight pages.
 *
 * docs/ remains the single source of truth. The sync step:
 * - injects Starlight frontmatter using the first H1 as the title;
 * - removes that H1 from the body to avoid rendering it twice;
 * - rewrites links between docs pages to deployed Starlight routes;
 * - prefixes internal routes with the GitHub Pages base path;
 * - rewrites links outside docs/ to the corresponding GitHub URL;
 * - preserves anchors, query strings, optional Markdown titles, and images.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = join(root, 'docs');
const targetDir = join(root, 'site/src/content/docs');

const DOCS_BASE = '/modyra';
const REPO_ROOT = 'https://github.com/modyra/modyra';
const REPO_BLOB = `${REPO_ROOT}/blob/main/`;
const REPO_TREE = `${REPO_ROOT}/tree/main/`;
const REPO_EDIT = `${REPO_ROOT}/edit/main/`;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function yamlString(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function splitTarget(target) {
  const match = target.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  return match
    ? { path: match[1], query: match[2] ?? '', hash: match[3] ?? '' }
    : { path: target, query: '', hash: '' };
}

function docsRoute(docsRel) {
  let route = docsRel.replace(/\.md$/i, '');
  if (posix.basename(route).toLowerCase() === 'readme') {
    route = posix.dirname(route);
    if (route === '.') route = '';
  }

  const clean = route.replace(/^\/+|\/+$/g, '');
  return clean ? `${DOCS_BASE}/${clean}/` : `${DOCS_BASE}/`;
}

function repoUrl(repoRel, isDirectory, query = '', hash = '') {
  const encoded = repoRel
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${isDirectory ? REPO_TREE : REPO_BLOB}${encoded}${query}${hash}`;
}

function filesystemPath(repoRel) {
  return join(root, ...repoRel.split('/'));
}

function isDirectoryTarget(repoRel, explicitDirectory) {
  if (explicitDirectory) return true;
  const full = filesystemPath(repoRel);
  return existsSync(full) && statSync(full).isDirectory();
}

/**
 * Rewrites inline Markdown links and images. fileDocsRelDir is the POSIX
 * directory of the source file relative to docs/.
 */
function rewriteLinks(content, fileDocsRelDir) {
  return content.replace(
    /(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
    (whole, bang, text, rawTarget, titlePart) => {
      if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) return whole;
      if (rawTarget.startsWith('//') || rawTarget.startsWith('#')) return whole;

      const { path: pathPart, query, hash } = splitTarget(rawTarget);
      if (!pathPart) return whole;

      // A leading slash in source docs means docs-root-relative, not domain-root.
      const sourceRelative = pathPart.startsWith('/')
        ? pathPart.slice(1)
        : posix.join(fileDocsRelDir, pathPart);
      const repoRel = posix.normalize(posix.join('docs', sourceRelative));
      const staysInDocs = repoRel === 'docs' || repoRel.startsWith('docs/');
      const explicitDirectory = pathPart.endsWith('/');

      let rewritten;
      if (staysInDocs) {
        const docsRel = repoRel === 'docs' ? '' : repoRel.slice('docs/'.length);
        const isMarkdownPage = !explicitDirectory && /\.md$/i.test(docsRel);

        if (!bang && isMarkdownPage) {
          rewritten = `${docsRoute(docsRel)}${query}${hash}`;
        } else {
          // Images, downloads, directories, and non-Markdown assets remain
          // source artifacts and therefore link to GitHub rather than a
          // non-existent Starlight route.
          const directory = isDirectoryTarget(repoRel, explicitDirectory);
          rewritten = repoUrl(repoRel, directory, query, hash);
        }
      } else {
        const directory = isDirectoryTarget(repoRel, explicitDirectory);
        rewritten = repoUrl(repoRel, directory, query, hash);
      }

      return `${bang}[${text}](${rewritten}${titlePart})`;
    },
  );
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });

let count = 0;
for (const file of walk(docsDir)) {
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  const titleIndex = lines.findIndex((line) => line.startsWith('# '));
  const title =
    titleIndex >= 0
      ? lines[titleIndex].slice(2).trim().replace(/[`*_]/g, '')
      : 'Modyra';
  const body =
    titleIndex >= 0
      ? [...lines.slice(0, titleIndex), ...lines.slice(titleIndex + 1)].join('\n')
      : raw;

  const rel = relative(docsDir, file).split('\\').join('/');
  const fileDocsRelDir = posix.dirname(rel);
  const rewritten = rewriteLinks(body, fileDocsRelDir);

  const outRel = rel === 'README.md' ? 'index.md' : rel;
  const outPath = join(targetDir, outRel);
  mkdirSync(dirname(outPath), { recursive: true });

  const editUrl = `${REPO_EDIT}docs/${rel}`;
  const generated = [
    '---',
    `title: ${yamlString(title)}`,
    `editUrl: ${yamlString(editUrl)}`,
    '---',
    rewritten.replace(/^\n+/, ''),
  ].join('\n');

  writeFileSync(outPath, generated, 'utf8');
  count += 1;
}

console.log(`docs/ (${count} files) -> site/src/content/docs/`);
