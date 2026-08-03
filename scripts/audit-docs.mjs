#!/usr/bin/env node
/**
 * The documentation says things that can be checked, so they are checked.
 *
 * Five failures this repository has actually had, every one of which reads as fine on the page:
 *
 *   1. **A link to a file that never existed.** Nine at once — seven in the first paragraph of the
 *      seven adapter examples, pointing at a shared page nobody had written. Nothing resolves a
 *      markdown link at build time, so a dead one survives every suite. A link that resolves only
 *      on the author's disk counts too: a git-ignored target is absent from a fresh clone.
 *   2. **A summary contradicting the document it summarises.** `contract-gaps.md` carries a status
 *      list of which findings are open; it drifted from the headings twice, the second time in the
 *      very commit whose message said it had been corrected. It listed four fixed findings as open
 *      and named a section, `C6`, that has never existed.
 *   3. **A page nothing links to.** Eleven of forty-eight, including every decision record.
 *   4. **An upstream README naming its own consumer**, which inverts the dependency direction in
 *      prose while the import graph stays clean.
 *   5. **A published package with no licence on its npm page.** Four of twelve.
 *
 * All five are one shape: prose asserting something about the repository, with nothing to notice
 * when the repository moves. Each is checked mechanically here, and each check is mutation-tested —
 * a check nobody has watched fail is only a claim that it works.
 *
 *   node scripts/audit-docs.mjs           # report
 *   node scripts/audit-docs.mjs --check   # exit 1 on any failure
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");

/**
 * Markdown that a human here maintains.
 *
 * Excluded: dependencies, build output, the site's synced copies, generated changelogs, and the
 * installer-generated skill trees under `.claude/` and `.github/` — those are vendored, their dead
 * links are upstream's, and editing them is undone by the next install.
 */
const SKIP = /node_modules|\/dist\/|\/site\/src\/content\/|\.changeset|CHANGELOG|\/target\/|\/\.git\/|\/skills\//;

function* markdown(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (SKIP.test(path)) continue;
    if (entry.isDirectory()) yield* markdown(path);
    else if (entry.name.endsWith(".md")) yield path;
  }
}

// ─── 1. Every relative link resolves ─────────────────────────────────────────

/**
 * Existing on this disk is not the same as existing in the repository.
 *
 * A tracked page may link only to something a fresh clone also gets. Linking to an ignored file
 * passes every local check and is dead for everyone else — `PRODUCT.md` is ignored here as personal,
 * and two tracked pages pointed at it.
 */
const ignored = new Set(
  execFileSync("git", ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean),
);

/** Whether git ignores this path, or any directory containing it. */
function isIgnored(absolute) {
  const path = relative(ROOT, absolute);
  if (path.startsWith("..")) return false;
  const segments = path.split("/");
  for (let i = 1; i <= segments.length; i++) {
    const prefix = segments.slice(0, i).join("/");
    if (ignored.has(prefix) || ignored.has(`${prefix}/`)) return true;
  }
  return false;
}

const brokenLinks = [];
for (const file of markdown(ROOT)) {
  // An ignored page linking to another ignored page is nobody's problem but this working tree's.
  if (isIgnored(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const [, text, target] of source.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
    // Only relative links to files in this repository. An anchor, a URL or a bare fragment is
    // somebody else's to resolve.
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const [path] = target.split("#");
    if (!path) continue;
    const resolved = resolve(dirname(file), path);
    if (!existsSync(resolved)) {
      brokenLinks.push(`${relative(ROOT, file)} → ${path}   [${text}]`);
    } else if (isIgnored(resolved)) {
      brokenLinks.push(`${relative(ROOT, file)} → ${path}   [${text}]  (git-ignored: absent from a fresh clone)`);
    }
  }
}

// ─── 2. The gap document's status list matches its own headings ──────────────

/**
 * Read each finding's status from its heading, then check the summary agrees.
 *
 * The heading is the source of truth because it sits with the evidence; the summary is a convenience
 * for a reader who does not want to scroll, and a convenience that can lie is worse than none.
 */
function gapStatusMismatches() {
  const path = join(ROOT, "docs/contract-gaps.md");
  if (!existsSync(path)) return [];
  const source = readFileSync(path, "utf8");

  const declared = new Map();
  for (const [, id, rest] of source.matchAll(/^## ([A-Z]\d*) — (.*)$/gm)) {
    const status = /partly fixed|mostly fixed|derivation fixed/.test(rest) ? "partial"
      : /closed as deliberate|documented, not a defect/.test(rest) ? "closed"
      : /\bfixed\b/.test(rest) ? "fixed"
      : "open";
    declared.set(id, status);
  }

  const summary = source.slice(0, source.indexOf("\n---"));
  const listed = new Map();
  const problems = [];
  for (const [, label, ids] of summary.matchAll(/\*\*(Fixed|Partly fixed|Closed[^*]*)\*\* — ([^\n]+)/g)) {
    const status = label.startsWith("Fixed") ? "fixed" : label.startsWith("Partly") ? "partial" : "closed";
    for (const [, id] of ids.matchAll(/\b([A-Z]\d*)\b(?=[,\s(]|$)/g)) {
      // A finding named under two statuses is drift on its own, and it hides: the second write wins,
      // so the summary reads as consistent with whichever list happens to come last.
      if (listed.has(id) && listed.get(id) !== status) {
        problems.push(`${id}: the summary lists it as both ${listed.get(id)} and ${status}`);
      }
      listed.set(id, status);
    }
  }

  for (const [id, status] of declared) {
    if (!listed.has(id)) problems.push(`${id}: heading says ${status}, the summary does not mention it`);
    else if (listed.get(id) !== status) problems.push(`${id}: heading says ${status}, the summary says ${listed.get(id)}`);
  }
  for (const id of listed.keys()) {
    if (!declared.has(id)) problems.push(`${id}: named in the summary, but there is no such section`);
  }
  return problems;
}

const gapProblems = gapStatusMismatches();

// ─── 3. Every page under docs/ is reachable from the index ───────────────────

/**
 * A page nobody links to is a page nobody reads, and it rots without anyone noticing — eleven of the
 * forty-eight here were unreachable at once, including two Studio guides and every decision record.
 *
 * Reachability is transitive: the index need not name a page directly, only reach it. That keeps a
 * hub page (the examples' shared scenario, say) a legitimate way to organise a section.
 */
function orphanedPages() {
  const docs = join(ROOT, "docs");
  if (!existsSync(docs)) return [];

  const reached = new Set();
  const queue = [join(docs, "README.md")];
  while (queue.length > 0) {
    const file = queue.pop();
    if (reached.has(file) || !existsSync(file)) continue;
    reached.add(file);
    for (const [, , target] of readFileSync(file, "utf8").matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const [path] = target.split("#");
      if (!path?.endsWith(".md")) continue;
      queue.push(resolve(dirname(file), path));
    }
  }

  const orphans = [];
  for (const file of markdown(docs)) {
    if (!reached.has(file)) orphans.push(relative(ROOT, file));
  }
  return orphans;
}

const orphans = orphanedPages();

// ─── 4. An upstream package does not name its dependents ─────────────────────

/**
 * `@modyra/core` and `@modyra/widgets` are consumed by the adapters; they do not know them.
 *
 * The import graph is already checked. Prose is not, and a README naming a dependent inverts the
 * responsibility just as surely — it tells a reader the contract is defined by one of its consumers,
 * and it goes stale the moment the set of consumers changes.
 *
 * Naming a *framework* stays legitimate: "Angular Signals" as an example of fine-grained reactivity
 * describes the landscape, not a dependency. Only the `@modyra/…` package names are the inversion.
 */
function dependentsNamedUpstream() {
  const upstream = ["core", "widgets"];
  const found = [];
  for (const name of upstream) {
    const file = join(ROOT, `packages/${name}/README.md`);
    if (!existsSync(file)) continue;
    readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      for (const [, dependent] of line.matchAll(/@modyra\/([a-z-]+)/g)) {
        if (!upstream.includes(dependent)) {
          found.push(`packages/${name}/README.md:${index + 1} names @modyra/${dependent}, which consumes it`);
        }
      }
    });
  }
  return found;
}

const inverted = dependentsNamedUpstream();

// ─── 5. Every published package states its licence ───────────────────────────

/**
 * A package README is its npm listing, read by people deciding whether they may use it. Four of the
 * twelve published packages had no licence section at all — the repository is MIT, but nothing on
 * the page said so.
 *
 * Private workspace packages are exempt: they are never rendered anywhere.
 */
function packagesMissingLicence() {
  const missing = [];
  for (const dir of readdirSync(join(ROOT, "packages"))) {
    const manifest = join(ROOT, "packages", dir, "package.json");
    if (!existsSync(manifest)) continue;
    if (JSON.parse(readFileSync(manifest, "utf8")).private) continue;

    const readme = join(ROOT, "packages", dir, "README.md");
    if (!existsSync(readme)) missing.push(`packages/${dir} is published with no README`);
    else if (!/^## License$/m.test(readFileSync(readme, "utf8"))) {
      missing.push(`packages/${dir}/README.md has no "## License" section`);
    }
  }
  return missing;
}

const unlicensed = packagesMissingLicence();

// ─── Report ──────────────────────────────────────────────────────────────────

console.log("# Documentation checks\n");
console.log(`Relative links that do not resolve: ${brokenLinks.length}`);
for (const link of brokenLinks.slice(0, 20)) console.log(`  ${link}`);
if (brokenLinks.length > 20) console.log(`  … ${brokenLinks.length - 20} more`);

console.log(`\ncontract-gaps.md summary vs its headings: ${gapProblems.length} mismatch(es)`);
for (const problem of gapProblems) console.log(`  ${problem}`);

console.log(`\ndocs/ pages unreachable from docs/README.md: ${orphans.length}`);
for (const page of orphans) console.log(`  ${page}`);

console.log(`\nUpstream READMEs naming a dependent: ${inverted.length}`);
for (const problem of inverted) console.log(`  ${problem}`);

console.log(`\nPublished packages without a licence section: ${unlicensed.length}`);
for (const problem of unlicensed) console.log(`  ${problem}`);

if (!check) process.exit(0);
if (brokenLinks.length || gapProblems.length || orphans.length || inverted.length || unlicensed.length) {
  console.error("\nDOCUMENTATION CHECKS FAILED");
  process.exit(1);
}
console.log("\nDOCUMENTATION CHECKS CLEAN");
