/**
 * An adapter does not restate a type it derives.
 *
 * `@modyra/angular`'s own `typed-form.ts` explains why, from its own history: a handle written out
 * member by member drifted the moment the engine gained one, and code built against the copy
 * compiled and then threw. That file fixed `MdyFieldHandle` by *deriving* it — `AsAngularSignals<…>`
 * over the core type — and left three neighbours hand-copied. Nothing objected, because nothing was
 * looking: `audit-type-surface.mjs` reads `core` and `widgets` and no adapter at all.
 *
 * This is the missing half. Every type an adapter exports is compared, by member name, against the
 * surface `core` and `widgets` publish. A copy is a copy however its members are typed — re-branding
 * `MdySignal` as this framework's `Signal` is exactly what an adapter is for, and is what makes the
 * *types* differ while the *shape* stays the upstream one.
 *
 * `type-mirroring-allowlist.json` carries the ones that are legitimate, each with its reason. A
 * shape that is not listed fails; a listed shape that no longer mirrors anything fails too, because
 * an entry is a claim about the code and a stale claim is worse than none.
 *
 * It sees object shapes and nothing else. `MdyItemHandleTree` and `MdyFieldHandleTree` are
 * conditional types copied verbatim into the same Angular file, and no member-set comparison can
 * reach them — a copy this misses is still a copy.
 *
 *   node scripts/audit-type-mirroring.mjs [--write]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SURFACE = join(root, "packages/widgets/contract-baseline/type-surface.json");
const ALLOWLIST = join(root, "packages/widgets/contract-baseline/type-mirroring-allowlist.json");

const ADAPTERS = ["plain", "angular", "lit", "react", "preact", "vue", "svelte", "solid"];
/** Below this every options bag matches every other one. */
const MIN_MEMBERS = 3;
const SKIP = new Set(["node_modules", "dist", "coverage", ".angular", "contract-baseline"]);

function sources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|mts)$/.test(entry) && !/\.(spec|test)\./.test(entry)) out.push(path);
  }
  return out;
}

/** The member names of every exported object-shaped type in a file. */
function shapes(source, path) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  const found = [];
  const DECLARATION = /export\s+(?:interface|type)\s+([A-Za-z_$][\w$]*)(?:<[^>]*>)?\s*(?:extends\s+[^{]+)?=?\s*\{/g;
  let match;
  while ((match = DECLARATION.exec(text)) !== null) {
    const open = text.indexOf("{", match.index + match[0].length - 1);
    let depth = 0;
    let end = -1;
    for (let i = open; i < text.length; i += 1) {
      if (text[i] === "{") depth += 1;
      else if (text[i] === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) continue;
    const body = text.slice(open + 1, end);
    // Only members at the top level of this body: a nested object type is part of a member's type.
    const members = new Set();
    let level = 0;
    for (const line of body.split("\n")) {
      // A generic method — `cell<TCell = unknown>(…)` — is still a member called `cell`.
      const name = level === 0 && line.match(/^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\??\s*[(:]/);
      if (name) members.add(name[1]);
      for (const ch of line) {
        if (ch === "{" || ch === "(" || ch === "[") level += 1;
        else if (ch === "}" || ch === ")" || ch === "]") level -= 1;
      }
    }
    if (members.size >= MIN_MEMBERS) {
      found.push({ name: match[1], path, line: text.slice(0, match.index).split("\n").length, members });
    }
    DECLARATION.lastIndex = open + 1;
  }
  return found;
}

const surface = JSON.parse(readFileSync(SURFACE, "utf8"));

/**
 * The names the audited adapters declare themselves.
 *
 * The type surface is gathered from `core`, `widgets` **and** `angular`, so an adapter's own shapes
 * are in the file this audit reads as "upstream" — and a shape matches itself, member for member,
 * every time. Five Angular types were reported as restatements of themselves, with nothing upstream
 * to derive from: `MdyOptionsControl` exists in one package only.
 *
 * So a name only an adapter declares is not upstream. Only that: a name core or widgets declares
 * stays upstream however many adapters also declare it, which is what keeps a same-name copy — the
 * most likely kind — from becoming invisible by writing itself into the exclusion.
 */
const declaredIn = (packages) => {
  const names = new Set();
  for (const pkg of packages) {
    let files;
    try { files = sources(join(root, "packages", pkg, "src")); } catch { continue; }
    for (const file of files) {
      for (const shape of shapes(readFileSync(file, "utf8"), relative(root, file))) names.add(shape.name);
    }
  }
  return names;
};
const declaredUpstream = declaredIn(["core", "widgets"]);
const adapterOnly = new Set([...declaredIn(ADAPTERS)].filter((name) => !declaredUpstream.has(name)));

/** Upstream shapes by their member-name set, so a rename cannot hide a copy. */
const upstream = new Map();
for (const [name, members] of Object.entries(surface)) {
  if (!Array.isArray(members) || members.length < MIN_MEMBERS) continue;
  if (adapterOnly.has(name)) continue;
  const names = members.map((m) => String(m).split(":")[0].trim().replace(/\?$/, "").replace(/\(.*$/, ""));
  const key = [...new Set(names)].sort().join(",");
  if (!upstream.has(key)) upstream.set(key, []);
  upstream.get(key).push(name);
}

const mirrors = [];
for (const adapter of ADAPTERS) {
  let files;
  try { files = sources(join(root, "packages", adapter, "src")); } catch { continue; }
  for (const file of files) {
    for (const shape of shapes(readFileSync(file, "utf8"), relative(root, file))) {
      const key = [...shape.members].sort().join(",");
      const upstreamNames = upstream.get(key);
      if (!upstreamNames) continue;
      mirrors.push({
        id: `${adapter}:${shape.name}`,
        mirrors: upstreamNames.join(" | "),
        at: `${shape.path}:${shape.line}`,
        members: shape.members.size,
      });
    }
  }
}
mirrors.sort((a, b) => a.id.localeCompare(b.id));

if (process.argv.includes("--write")) {
  writeFileSync(ALLOWLIST, `${JSON.stringify({
    note: "Each entry restates an upstream shape. Derive it instead, or say here why it cannot be.",
    minMembers: MIN_MEMBERS,
    allowed: mirrors.map((m) => ({ ...m, reason: "recorded, not yet accounted for" })),
  }, null, 2)}\n`);
  console.log(`Type-mirroring allowlist written: ${mirrors.length} shape(s).`);
  process.exit(0);
}

let allowlist;
try { allowlist = JSON.parse(readFileSync(ALLOWLIST, "utf8")); }
catch { console.error("No type-mirroring allowlist. Record one with --write, then account for every entry."); process.exit(1); }

const allowed = new Map(allowlist.allowed.map((a) => [a.id, a]));
const seen = new Set(mirrors.map((m) => m.id));
const appeared = mirrors.filter((m) => !allowed.has(m.id));
const resolved = allowlist.allowed.filter((a) => !seen.has(a.id));

console.log(`Upstream shapes: ${upstream.size} · adapter shapes mirroring one: ${mirrors.length} (allowed: ${allowlist.allowed.length})`);

if (appeared.length) {
  console.error("\nTYPE MIRRORED — an adapter restated a shape it derives");
  for (const m of appeared) console.error(`- ${m.id} restates ${m.mirrors} (${m.members} members)\n    ${m.at}`);
  console.error("\nDerive or alias it, or record it with a reason:");
  console.error("  node scripts/audit-type-mirroring.mjs --write");
}
if (resolved.length) {
  console.error("\nSTALE ENTRIES — allowed shapes that no longer mirror anything");
  for (const a of resolved) console.error(`- ${a.id}`);
  console.error("\nRe-record: node scripts/audit-type-mirroring.mjs --write");
}
if (appeared.length || resolved.length) process.exit(1);
console.log("NO UNRECORDED TYPE MIRRORING");
