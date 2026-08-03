#!/usr/bin/env node
/**
 * The documentation says things that can be checked, so they are checked.
 *
 * The failure modes below all read as fine on the page:
 *
 *   - **A link to a file that does not exist.** Nothing resolves a markdown link at build time, so a
 *     dead one survives every suite. A link that resolves only on the author's disk counts too: a
 *     git-ignored target is absent from a fresh clone.
 *   - **A summary contradicting the document it summarises.** `contract-gaps.md` carries a status
 *     list of which findings are open. Maintained beside the headings rather than derived from them,
 *     it drifts — and a summary that can lie is worse than none.
 *   - **A page nothing links to**, which is how documentation stops being found.
 *   - **An upstream README naming its own consumer**, which inverts the dependency direction in
 *     prose while the import graph stays clean.
 *   - **A published package with no licence on its npm page.**
 *   - **A decision record with no Verification or Security section**, which is how a record stops
 *     being reviewable — and one that is not in the index, which is how it stops being read.
 *
 * They are one shape: prose asserting something about the repository, with nothing to notice when
 * the repository moves. Each is checked mechanically here, and each check is mutation-tested — a
 * check nobody has watched fail is only a claim that it works.
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
  for (const [, label, ids] of summary.matchAll(/\*\*(Fixed|Partly fixed|Closed[^*]*|Open)\*\* — ([^\n]+)/g)) {
    const status = label.startsWith("Fixed") ? "fixed"
      : label.startsWith("Partly") ? "partial"
      : label.startsWith("Open") ? "open"
      : "closed";
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
 * A page nobody links to is a page nobody reads, and it rots without anyone noticing.
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

// ─── 6. Every decision record is complete and indexed ────────────────────────

/**
 * Architectural and security decisions live in `docs/architecture/`, and a record that omits why it
 * costs, how it is checked, or what it exposes is not one.
 *
 * `Verification` and `Security and privacy` are required precisely because they are the sections a
 * hurried record drops — and they are the two a reviewer needs. "No security impact" is a finding and
 * takes one line; an absent section is indistinguishable from not having thought about it.
 */
function adrProblems() {
  const dir = join(ROOT, "docs/architecture");
  if (!existsSync(dir)) return [];

  const required = ["## Context", "## Decision", "## Consequences", "## Verification", "## Security and privacy"];
  const records = readdirSync(dir).filter((name) => /^\d{4}-.*\.md$/.test(name)).sort();
  const index = existsSync(join(dir, "README.md")) ? readFileSync(join(dir, "README.md"), "utf8") : "";
  const problems = [];

  if (records.length === 0) return problems;
  if (index === "") problems.push("docs/architecture/README.md is missing — the records have no index");

  records.forEach((name, position) => {
    const source = readFileSync(join(dir, name), "utf8");

    // Contiguous from 0001: a gap means a record was deleted rather than superseded, and superseding
    // is the only honest way to retire a decision.
    const expected = String(position + 1).padStart(4, "0");
    if (!name.startsWith(expected)) problems.push(`${name}: expected number ${expected} — records must be contiguous from 0001`);

    if (!/^Status:/m.test(source)) problems.push(`${name}: no "Status:" line`);
    for (const heading of required) {
      if (!source.includes(`\n${heading}\n`)) problems.push(`${name}: missing "${heading}"`);
    }
    if (!index.includes(name)) problems.push(`${name}: not listed in docs/architecture/README.md`);
  });

  return problems;
}

const adrs = adrProblems();

// ─── 7. Every page under docs/ has a place in the site sidebar ───────────────

/**
 * The sidebar names its pages one by one, so a page can be published and unreachable.
 *
 * Groups are editorial — `guides/` holds concepts, integration notes, comparisons and a maintainer
 * runbook — so the site cannot autogenerate them from the directory tree. The cost of listing them
 * is that adding a page to docs/ no longer adds it to the sidebar, and nothing about the built site
 * looks wrong: the page renders, at its own URL, with no way in.
 *
 * A page is covered if the sidebar names its slug, an `autogenerate` directory contains it, or the
 * sync step hides it deliberately. `SIDEBAR_HIDDEN` is read from the sync script rather than
 * restated here, so the two cannot disagree.
 */
function sidebarCoverage() {
  const config = join(ROOT, "site/astro.config.mjs");
  const docs = join(ROOT, "docs");
  if (!existsSync(config) || !existsSync(docs)) return [];

  const source = readFileSync(config, "utf8");
  const start = source.indexOf("sidebar: [");
  if (start === -1) return ["site/astro.config.mjs: no sidebar array — this check cannot see it"];
  const sidebar = source.slice(start);

  const slugs = new Set([...sidebar.matchAll(/slug:\s*'([^']+)'/g)].map(([, slug]) => slug));
  const directories = [...sidebar.matchAll(/autogenerate:\s*\{\s*directory:\s*'([^']+)'/g)]
    .map(([, directory]) => directory);

  const sync = join(ROOT, "scripts/sync-docs-site.mjs");
  const hidden = new Set(
    existsSync(sync)
      ? [...(readFileSync(sync, "utf8").match(/SIDEBAR_HIDDEN = new Set\(\[([^\]]*)\]/)?.[1] ?? "")
          .matchAll(/'([^']+)'/g)].map(([, path]) => path)
      : [],
  );

  const problems = [];
  for (const file of markdown(docs)) {
    const rel = relative(docs, file).split("\\").join("/");
    if (hidden.has(rel)) continue;
    // docs/README.md is published as `start-here`; every other page keeps its path as its slug.
    const slug = rel === "README.md" ? "start-here" : rel.replace(/\.md$/, "");
    if (slugs.has(slug)) continue;
    if (directories.some((directory) => slug.startsWith(`${directory}/`))) continue;
    problems.push(`docs/${rel}: published as "${slug}" and named nowhere in the sidebar`);
  }
  return problems;
}

const unlisted = sidebarCoverage();

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

console.log(`\nIncomplete or unindexed decision records: ${adrs.length}`);
for (const problem of adrs) console.log(`  ${problem}`);

console.log(`\ndocs/ pages missing from the site sidebar: ${unlisted.length}`);
for (const problem of unlisted) console.log(`  ${problem}`);

if (!check) process.exit(0);
if (brokenLinks.length || gapProblems.length || orphans.length || inverted.length || unlicensed.length || adrs.length || unlisted.length) {
  console.error("\nDOCUMENTATION CHECKS FAILED");
  process.exit(1);
}
console.log("\nDOCUMENTATION CHECKS CLEAN");
