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
 * installer-generated skill trees vendored with tool configuration (`.github/` among them) —
 * those are vendored, their dead links are upstream's, and editing them is undone by the next
 * install.
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
 * Read each finding's status from its heading, then check every summary of it agrees.
 *
 * The heading is the source of truth because it sits with the evidence. Two summaries restate it:
 * the register's own status list, and `docs/known-issues.md`, the page the site publishes for a
 * reader who is not holding the source. Both are conveniences, and a convenience that can lie is
 * worse than none — the public one most of all, because it is the version most people read.
 *
 * A finding id may carry a lowercase suffix (`J4a`): the same underlying question split into two
 * records. Matching only `[A-Z]\d*` skipped those headings entirely while still accepting them in a
 * summary, so their status was unverifiable in exactly the direction that hides drift.
 */
const FINDING_ID = "[A-Z]\\d*[a-z]?";

function statusFromHeadingText(rest) {
  return /partly fixed|mostly fixed|derivation fixed/.test(rest) ? "partial"
    : /closed as deliberate|documented, not a defect/.test(rest) ? "closed"
    : /\bfixed\b/.test(rest) ? "fixed"
    : "open";
}

/** Parse `**Open** — R` style status lists out of a summary. */
function listedStatuses(summary, label, problems) {
  const listed = new Map();
  const lists = new RegExp(`\\*\\*(Fixed|Partly fixed|Closed[^*]*|Open)\\*\\* — ([^\\n]+)`, "g");
  for (const [, heading, ids] of summary.matchAll(lists)) {
    const status = heading.startsWith("Fixed") ? "fixed"
      : heading.startsWith("Partly") ? "partial"
      : heading.startsWith("Open") ? "open"
      : "closed";
    for (const [, id] of ids.matchAll(new RegExp(`\\b(${FINDING_ID})\\b(?=[,\\s(]|$)`, "g"))) {
      // A finding named under two statuses is drift on its own, and it hides: the second write wins,
      // so the summary reads as consistent with whichever list happens to come last.
      if (listed.has(id) && listed.get(id) !== status) {
        problems.push(`${label}: ${id} is listed as both ${listed.get(id)} and ${status}`);
      }
      listed.set(id, status);
    }
  }
  return listed;
}

function compare(declared, listed, label, problems) {
  for (const [id, status] of declared) {
    if (!listed.has(id)) problems.push(`${label}: heading says ${id} is ${status}, it does not mention it`);
    else if (listed.get(id) !== status) {
      problems.push(`${label}: heading says ${id} is ${status}, it says ${listed.get(id)}`);
    }
  }
  for (const id of listed.keys()) {
    if (!declared.has(id)) problems.push(`${label}: names ${id}, but the register has no such section`);
  }
}

function gapStatusMismatches() {
  const problems = [];
  const path = join(ROOT, "docs/contract-gaps.md");
  if (!existsSync(path)) return ["docs/contract-gaps.md is missing — the register this check reads is gone"];
  const source = readFileSync(path, "utf8");

  const declared = new Map();
  for (const [, id, rest] of source.matchAll(new RegExp(`^## (${FINDING_ID}) — (.*)$`, "gm"))) {
    declared.set(id, statusFromHeadingText(rest));
  }
  if (declared.size === 0) problems.push("docs/contract-gaps.md: no finding headings found — the check reads nothing");

  const summary = source.slice(0, source.indexOf("\n---"));
  compare(declared, listedStatuses(summary, "contract-gaps.md", problems), "contract-gaps.md", problems);

  // The published page is held to the same statuses. It is not synced to the site's register route —
  // it *is* what the site publishes — so a drift here is visible to every reader and to no test but
  // this one.
  const publicPath = join(ROOT, "docs/known-issues.md");
  if (!existsSync(publicPath)) {
    problems.push("docs/known-issues.md is missing — the site has no page summarising the register");
  } else {
    const publicSource = readFileSync(publicPath, "utf8");
    compare(declared, listedStatuses(publicSource, "known-issues.md", problems), "known-issues.md", problems);
  }

  return problems;
}

const gapProblems = gapStatusMismatches();

// ─── 2b. A backticked path names a file that exists ─────────────────────────

/**
 * Prose cites files the link checker never sees.
 *
 * A markdown link is checked; `packages/core/src/reactivity.ts` written inline is not, and it is how
 * documentation cites evidence — the file behind a claim, the test that proves it, the fixture a
 * decision argues from. When such a file moves or was never shipped, the citation reads exactly as
 * it did before.
 *
 * That is not hypothetical: five decision records supported their Verification sections by pointing
 * at a worked example version control ignored, so the evidence behind them was unreachable from a
 * clone. A citation that exists only on one machine is a citation that does not exist.
 *
 * A path resolves if it exists from the repository root or beside the citing page **and is tracked
 * by git** — an existing-but-ignored file is a violation, not a pass. Two shapes are
 * deliberately not paths and are skipped: a package subpath specifier (`./lib/version.cjs`), and an
 * abbreviation naming a file within a package it has already named in prose.
 */
const CITED_PATH = /`([A-Za-z0-9._/-]+\.(?:ts|tsx|mjs|cjs|js|json|css|yml|yaml|html|rs|java))`/g;

const TRACKED = new Set(
  execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map((path) => join(ROOT, path)),
);

function missingCitedPaths() {
  const problems = [];
  for (const file of markdown(ROOT)) {
    if (!/\/(docs)\/|README\.md$|CONTRIBUTING\.md$|ROADMAP\.md$/.test(file)) continue;
    for (const [, cited] of readFileSync(file, "utf8").matchAll(CITED_PATH)) {
      if (!cited.includes("/")) continue;
      // A subpath specifier is how a package names its own entry point, not a file on disk.
      if (cited.startsWith("./") || cited.startsWith("@")) continue;
      // An abbreviation like `testing/canonical.ts`, resolved by the package the prose just named.
      if (!cited.includes(".") || cited.split("/").length < 3) continue;
      const found = [join(ROOT, cited), resolve(dirname(file), cited)].find((p) => existsSync(p));
      if (!found) problems.push(`${relative(ROOT, file)} cites ${cited}, which does not exist`);
      else if (!TRACKED.has(found))
        problems.push(`${relative(ROOT, file)} cites ${cited}, which version control does not track`);
    }
  }
  return problems;
}

const missingCitations = missingCitedPaths();

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

  // Two records under one number, named before the contiguity check reaches them.
  //
  // Contiguity catches a duplicate by rebound — with two `0093` the count no longer lines up — but it
  // reports the *innocent* record, saying `0093-a-field-…: expected number 0094`. Whoever reads that
  // renames the right file to the wrong number and the collision survives. Two sessions writing an
  // ADR at once is the ordinary way this happens, and the message has to name the pair.
  const byNumber = new Map();
  for (const name of records) {
    const number = name.slice(0, 4);
    if (!byNumber.has(number)) byNumber.set(number, []);
    byNumber.get(number).push(name);
  }
  const collided = new Set();
  for (const [number, names] of byNumber) {
    if (names.length < 2) continue;
    for (const name of names) collided.add(name);
    problems.push(
      `${number} is used by ${names.length} records — ${names.join(", ")}. ` +
      "A number names one decision; renumber all but the earliest.",
    );
  }

  records.forEach((name, position) => {
    const source = readFileSync(join(dir, name), "utf8");

    // Contiguous from 0001: a gap means a record was deleted rather than superseded, and superseding
    // is the only honest way to retire a decision.
    //
    // Not asked of a record whose number is already reported as shared: the count is off by the
    // duplicate, so every record after it would be blamed for a gap it did not make.
    const expected = String(position + 1).padStart(4, "0");
    if (collided.size === 0 && !name.startsWith(expected)) problems.push(`${name}: expected number ${expected} — records must be contiguous from 0001`);

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
 * sync step keeps it off the site deliberately — hidden from the sidebar but published, or excluded
 * from the published tree altogether. Both sets are read from the sync script rather than restated
 * here, so the two cannot disagree.
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
  const syncSource = existsSync(sync) ? readFileSync(sync, "utf8") : "";
  const namesIn = (constant) => [
    ...(syncSource.match(new RegExp(`${constant} = new Set\\(\\[([^\\]]*)\\]`))?.[1] ?? "")
      .matchAll(/'([^']+)'/g),
  ].map(([, path]) => path);
  const hidden = new Set([...namesIn("SIDEBAR_HIDDEN"), ...namesIn("SYNC_EXCLUDED")]);

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

console.log(`\nBackticked paths that do not exist: ${missingCitations.length}`);
for (const problem of missingCitations.slice(0, 20)) console.log(`  ${problem}`);
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
if (brokenLinks.length || gapProblems.length || missingCitations.length || orphans.length || inverted.length || unlicensed.length || adrs.length || unlisted.length) {
  console.error("\nDOCUMENTATION CHECKS FAILED");
  process.exit(1);
}
console.log("\nDOCUMENTATION CHECKS CLEAN");
