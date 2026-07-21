/**
 * Syncs docs/**\/*.md into site/src/content/docs/ as Starlight pages.
 *
 * docs/ stays the single source of truth — nothing here is hand-edited
 * content, it's a generated mirror. Each file gets Starlight's required
 * frontmatter (title, pulled from the first `# heading`) injected, and
 * the heading itself stripped from the body so Starlight doesn't render
 * the title twice (its own page header already shows it).
 */
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "docs");
const targetDir = join(root, "site/src/content/docs");

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

  const rel = relative(docsDir, file);
  const outPath = join(targetDir, rel === "README.md" ? "index.md" : rel);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `---\ntitle: ${yamlString(title)}\n---\n${body.replace(/^\n+/, "")}`,
    "utf8",
  );
  count++;
}

console.log(`docs/ (${count} files) -> site/src/content/docs/`);
