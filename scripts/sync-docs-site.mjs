/**
 * Syncs docs/**\/*.md into site/src/content/docs/ as Starlight pages.
 *
 * docs/ stays the single source of truth — nothing here is hand-edited
 * content, it's a generated mirror. Each file gets Starlight's required
 * frontmatter (title, pulled from the first `# heading`) injected, and
 * the heading itself stripped from the body so Starlight doesn't render
 * the title twice (its own page header already shows it).
 *
 * Relative markdown links are rewritten too — Astro/Starlight does not
 * auto-resolve `./foo.md`-style links to routes, so left untouched they
 * 404 on every page (confirmed with a real crawl, not assumed: every
 * `docs/**` file that cross-references another doc, a repo README, or a
 * source file broke). Links that stay inside docs/ become Starlight
 * routes (`.md` stripped, trailing slash, anchor preserved); links that
 * escape docs/ (repo READMEs, each package's own README, example source
 * files) become real github.com blob/tree URLs instead.
 */
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "docs");
const targetDir = join(root, "site/src/content/docs");

const REPO_BLOB = "https://github.com/modyra/modyra/blob/main/";
const REPO_TREE = "https://github.com/modyra/modyra/tree/main/";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/** Escapes a title for YAML frontmatter (only `"` and `\` need it here). */
function yamlString(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Rewrites every relative markdown link in `content`. `fileDocsRelDir` is
 * the POSIX directory of the source file relative to docs/ (e.g. "."
 * for docs/README.md, "guides" for docs/guides/schemas.md).
 */
function rewriteLinks(content, fileDocsRelDir) {
  return content.replace(
    /(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
    (whole, bang, text, url, titlePart) => {
      if (bang) return whole; // images: left as-is
      if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return whole; // has a scheme
      if (url.startsWith("#")) return whole; // same-page anchor

      const hashIdx = url.indexOf("#");
      const pathPart = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
      const hashPart = hashIdx >= 0 ? url.slice(hashIdx) : "";
      if (!pathPart) return whole;

      const isDir = pathPart.endsWith("/");
      const repoRel = posix.normalize(posix.join("docs", fileDocsRelDir, pathPart));

      if (repoRel === "docs" || repoRel.startsWith("docs/")) {
        const docsRel = repoRel === "docs" ? "" : repoRel.slice("docs/".length);
        if (!isDir && docsRel.endsWith(".md")) {
          let route = docsRel.slice(0, -3);
          if (posix.basename(route) === "README") {
            route = posix.dirname(route);
            if (route === ".") route = "";
          }
          return `[${text}](/${route}${route ? "/" : ""}${hashPart}${titlePart})`;
        }
        // A docs/ subdirectory (or non-.md file) has no Starlight page of
        // its own — link to the real thing on GitHub instead of a 404.
        return `[${text}](${REPO_TREE}${repoRel}${titlePart})`;
      }

      // Escaped outside docs/ entirely: a real repo file or directory.
      const target = isDir
        ? `${REPO_TREE}${repoRel}`
        : `${REPO_BLOB}${repoRel}${hashPart}`;
      return `[${text}](${target}${titlePart})`;
    },
  );
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });

let count = 0;
for (const file of walk(docsDir)) {
  const raw = readFileSync(file, "utf8");
  const lines = raw.split("\n");
  const titleIndex = lines.findIndex((l) => l.startsWith("# "));
  // Frontmatter `title` is rendered as plain text by Starlight, not
  // markdown — strip the inline code/emphasis markers so `` `mdyForm()` ``
  // doesn't show its literal backticks in the page header.
  const title =
    titleIndex >= 0
      ? lines[titleIndex].slice(2).trim().replace(/[`*_]/g, "")
      : "Modyra";
  const body =
    titleIndex >= 0
      ? [...lines.slice(0, titleIndex), ...lines.slice(titleIndex + 1)].join("\n")
      : raw;

  const rel = relative(docsDir, file).split("\\").join("/"); // posix, even on Windows
  const fileDocsRelDir = posix.dirname(rel);
  const rewritten = rewriteLinks(body, fileDocsRelDir);

  const outPath = join(targetDir, rel === "README.md" ? "index.md" : rel);
  mkdirSync(dirname(outPath), { recursive: true });
  // Starlight's automatic editLink derives the URL from this file's path
  // inside the *site* project (site/src/content/docs/<rel>) — since that
  // tree is a generated, gitignored mirror, the automatic link 404s. An
  // explicit per-page editUrl overrides it with the real docs/ source.
  const editUrl = `https://github.com/modyra/modyra/edit/main/docs/${rel}`;
  writeFileSync(
    outPath,
    `---\ntitle: ${yamlString(title)}\neditUrl: ${yamlString(editUrl)}\n---\n${rewritten.replace(/^\n+/, "")}`,
    "utf8",
  );
  count++;
}

console.log(`docs/ (${count} files) -> site/src/content/docs/`);
