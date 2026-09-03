/**
 * The custom properties a consumer may set, against the documents that name them.
 *
 * A theme surface is an API: a host overriding `--mdy-sys-color-primary` is calling this library as
 * surely as one calling `createForm`. Nothing checked that surface against its documentation, so it
 * grew to 713 declarations with six of them named anywhere a reader would look.
 *
 * **Which of them are public is read, not chosen.** `modyra-base.css` declares the tier system in
 * its own header — `ref` is raw brand values "never used by components", `sys` is "THE theme
 * surface", `comp` are component tokens that "exist for overrides" — so `sys` and `comp` are the
 * public perimeter and `ref` is not. Picking that perimeter myself would have produced a number that
 * invents work: 713 variables to document, most of them internal.
 *
 * Three questions, and the third is about the declaration rather than the documents:
 *
 *   undocumented — public and named in no document. The perimeter of the guide that is owed.
 *   phantom      — a document names it and no stylesheet declares it. Stale prose, or an example
 *                  using a host's own property; the second is legitimate and is declared below.
 *   untiered     — declared and belonging to none of the three tiers, so this cannot say whether it
 *                  is public. Not a documentation defect: a gap in the tier declaration itself.
 *
 * `--check` fails on `phantom` alone. The other two are counts of work, and a gate that failed on
 * them today would be red for as long as the work takes — which is how a gate teaches people to pass
 * it with an allowlist instead of a guide.
 *
 *   node scripts/audit-css-variables-documented.mjs
 *   node scripts/audit-css-variables-documented.mjs --check
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const STYLES = join(ROOT, "packages/styles/src");
const CHECK = process.argv.includes("--check");

/**
 * The tiers, read from the header that declares them.
 *
 * Hardcoding `["sys", "comp"]` here would be a second declaration of something the stylesheet
 * already states, and the two would part company the day a tier is added. The header names each
 * tier with a sentence; the sentence is what says whether it is a surface.
 */
function declaredTiers() {
  const base = readFileSync(join(STYLES, "modyra-base.css"), "utf8").slice(0, 2000);
  const tiers = new Map();
  for (const [, tier, description] of base.matchAll(/--mdy-(\w+)-\*\s+(.+)/g)) {
    tiers.set(tier, description.trim());
  }
  return tiers;
}

/** Every custom property a stylesheet in this package declares, with the sheet that declares it. */
function declared() {
  const found = new Map();
  for (const file of readdirSync(STYLES).filter((name) => name.endsWith(".css"))) {
    const source = readFileSync(join(STYLES, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const [, name] of source.matchAll(/(?:^|[;{]|\s)(--mdy-[a-z0-9-]+)\s*:/g)) {
      // Every sheet that declares it, not the first one found. Which sheet comes first is directory
      // order — `modyra-default.css` sorts before `modyra.css` — so keeping only the first said a
      // property was "declared by a theme" whenever a theme happened to sort earlier than the
      // foundation that also declares it. That turned 80 theme-supplied properties into 192.
      if (!found.has(name)) found.set(name, new Set());
      found.get(name).add(file);
    }
  }
  return found;
}

/** Whether version control ignores this path, which is how a generated page is told from a written one. */
function isGenerated(path) {
  try {
    execFileSync("git", ["check-ignore", "-q", path], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
}

/** Every custom property a document names, in prose or in a code fence. */
function documented() {
  const found = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!/\.(md|mdx|astro|html)$/.test(entry)) continue;
      // Decision records are not where a consumer looks up a property, and they must not be edited
      // into agreement with the present: one naming a token that has since been removed is correct,
      // because it records what was true when the decision was taken. Counting them would both
      // excuse a property from the guide and push somebody to rewrite a record.
      if (path.includes(join("docs", "architecture"))) continue;
      // A register of gaps names what is missing on purpose: quoting a rule that reads a property
      // nothing declares *is* the finding it records.
      if (path.endsWith("contract-gaps.md")) continue;
      // A generated mirror is not a document: `docs/` is the source of truth and the site pages are
      // built from it, so reading both counts every property twice and reports the build artefact's
      // staleness as a documentation defect. It said a guide named a property that nothing declares
      // when the guide had just been corrected and the mirror not yet rebuilt.
      if (isGenerated(path)) continue;
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/(--mdy-[a-z0-9-]*[a-z0-9])([-*]?)/g)) {
        const [, name, next] = match;
        // Prose names a *family* as `--mdy-comp-*`, and a reader that stops at the last letter turns
        // that into `--mdy-comp` — a property nobody wrote, reported as a phantom. What follows the
        // name is what says which was meant.
        if (next === "-" || next === "*") continue;
        if (!found.has(name)) found.set(name, relative(ROOT, path));
      }
    }
  };
  for (const dir of ["docs", "site/src"]) {
    const at = join(ROOT, dir);
    if (existsSync(at)) walk(at);
  }
  return found;
}

/**
 * Names a document may use that no stylesheet declares, with the reason.
 *
 * A guide showing a host how to set *their own* property is naming something this library must not
 * declare — the example would be wrong if it used one of ours.
 */
const NOT_OURS = new Map([
  ["--mdy-cloud", "the marketing site's own palette, set on its own elements — not a library token"],
  ["--mdy-coral", "the marketing site's own palette, set on its own elements — not a library token"],
  ["--mdy-indigo", "the marketing site's own palette, set on its own elements — not a library token"],
  ["--mdy-gradient-brand", "the marketing site's own gradient, declared in its layout"],
  ["--mdy-gradient-brand-ink", "the marketing site's own gradient, declared in its layout"],
  ["--mdy-gradient-brand-marker", "the marketing site's own gradient, declared in its layout"],
  ["--mdy-night", "the marketing site's own palette, set on its own elements"],
  ["--mdy-slate", "the marketing site's own palette, set on its own elements"],
]);

const tiers = declaredTiers();
const publicTiers = [...tiers].filter(([, description]) => !/never used by components/i.test(description));
const isPublic = (name) => publicTiers.some(([tier]) => name.startsWith(`--mdy-${tier}-`));
const isTiered = (name) => [...tiers.keys()].some((tier) => name.startsWith(`--mdy-${tier}-`));

const inCss = declared();
const inDocs = documented();

const undocumented = [...inCss.keys()].filter((name) => isPublic(name) && !inDocs.has(name)).sort();
const phantom = [...inDocs.keys()].filter((name) => !inCss.has(name) && !NOT_OURS.has(name)).sort();
const untiered = [...inCss.keys()].filter((name) => !isTiered(name)).sort();

/**
 * What reads each property, so an untiered one can be classified by evidence instead of by choice.
 *
 * Read from every written file in the repository — never from a built one. A stylesheet vendored
 * into an example reads our own properties back at us, and counting it made 317 of these look like
 * consumer surface when six are. What tells the two apart is version control, not the path.
 */
function readers() {
  const found = new Map();
  const note = (name, where) => {
    if (!found.has(name)) found.set(name, new Set());
    found.get(name).add(where);
  };
  const walk = (dir, where) => {
    for (const entry of readdirSync(dir)) {
      if (["node_modules", "dist", ".astro", ".styles", ".git"].includes(entry)) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) { walk(path, where); continue; }
      if (!/\.(ts|js|mjs|css|html|astro)$/.test(entry)) continue;
      if (isGenerated(path)) continue;
      const source = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
      for (const [, name] of source.matchAll(/var\(\s*(--mdy-[a-z0-9-]+)/g)) note(name, where);
    }
  };
  for (const [dir, where] of [
    [join(ROOT, "packages/styles/src"), "a stylesheet"],
    [join(ROOT, "packages/plain/src"), "a renderer"],
    [join(ROOT, "packages/lit/src"), "a renderer"],
    [join(ROOT, "packages/angular/src"), "a renderer"],
    [join(ROOT, "examples"), "an example or app"],
    [join(ROOT, "apps"), "an example or app"],
    [join(ROOT, "site/src"), "an example or app"],
  ]) {
    if (existsSync(dir)) walk(dir, where);
  }
  return found;
}

const readBy = readers();
const family = (name) => name.replace(/-[a-z0-9]+$/, "");
const familyOf = new Map();
for (const name of inCss.keys()) {
  const key = family(name);
  if (!familyOf.has(key)) familyOf.set(key, []);
  familyOf.get(key).push(name);
}

const classified = new Map();
for (const name of untiered) {
  const who = readBy.get(name);
  if (who === undefined) {
    // Read by nothing here — which is not read by nothing anywhere. These sheets are published, and
    // a user's own theme can read one in its own CSS where no scan of ours will ever see it. Whether
    // a property with no reader here is dead or is surface nobody has exercised is a question the
    // repository cannot answer, so it is reported and never failed on.
    const siblings = (familyOf.get(family(name)) ?? []).filter((s) => s !== name && readBy.has(s));
    classified.set(name, siblings.length > 0 ? "no reader here — a step of a scale whose siblings are read" : "no reader here — alone in its family");
    continue;
  }
  if (who.has("an example or app")) classified.set(name, "read by an example or app");
  else if (who.has("a renderer")) classified.set(name, "read by a renderer");
  else {
    // Between stylesheets, *which* sheet declares it is the whole distinction. A property the
    // foundation declares and its own rules consume is plumbing. One a **theme** declares and the
    // foundation consumes is the opposite: it is what a theme must supply for the foundation to
    // work — a contract pointing outward, at anybody writing a theme of their own, and the section
    // of the guide nobody would have written from the totals.
    // Supplied by a theme only when **every** sheet that declares it is a theme: where the
    // foundation declares it too, the theme is overriding a default, not meeting a requirement.
    const sheets = [...(inCss.get(name) ?? [])];
    const fromATheme = sheets.length > 0
      && sheets.every((sheet) => /^modyra-(ios|material|ionic|modern|salience|default)\.css$/.test(sheet));
    classified.set(name, fromATheme
      ? "declared by a theme, consumed by the foundation — what a theme must supply"
      : "declared and read between the foundation's own sheets");
  }
}

console.log("# CSS custom properties against the documents that name them\n");
console.log(`Tiers declared by modyra-base.css: ${[...tiers.keys()].map((t) => `--mdy-${t}-*`).join(", ")}`);
for (const [tier, description] of tiers) {
  console.log(`  --mdy-${tier}-*`.padEnd(16) + `${isPublic(`--mdy-${tier}-x`) ? "public " : "internal"}  ${description}`);
}
console.log(`\nDeclared: ${inCss.size}   named in a document: ${inDocs.size}\n`);

console.log(`## undocumented — public and named in no document: ${undocumented.length}`);
for (const name of undocumented.slice(0, 8)) console.log(`  ${name.padEnd(42)} ${[...inCss.get(name)].join(", ")}`);
if (undocumented.length > 8) console.log(`  … and ${undocumented.length - 8} more`);

console.log(`\n## phantom — a document names it and no stylesheet declares it: ${phantom.length}`);
for (const name of phantom) console.log(`  ${name.padEnd(42)} ${inDocs.get(name)}`);

console.log(`\n## untiered — declared, and in none of the tiers above: ${untiered.length}`);
console.log("  Classified by what reads each one, which is evidence rather than a choice:");
const groups = new Map();
for (const [name, kind] of classified) {
  if (!groups.has(kind)) groups.set(kind, []);
  groups.get(kind).push(name);
}
for (const [kind, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${String(list.length).padStart(4)}  ${kind}`);
  console.log(`        e.g. ${list.slice(0, 3).join(", ")}`);
}
console.log("  Who declares one is as telling as who reads it: the foundation declaring its own is");
console.log("  plumbing, a theme declaring what the foundation consumes is a contract pointing at");
console.log("  whoever writes the next theme. None is owed documentation until the header names its tier.");
console.log("  These cannot be called public or internal from any declaration, so this audit does");
console.log("  not count them as owed documentation. That is a gap in the tier header, not in the docs.");

// The tier system is declared twice, and the two do not agree. Said here because the number above
// depends on it: whichever declaration is right, this audit is reading only one of them.
const guide = join(ROOT, "docs/guides/ui-toolkit.md");
if (existsSync(guide)) {
  const named = [...readFileSync(guide, "utf8").matchAll(/\*\*Tier \d+ — ([^*]+)\*\*\s*\(`([^`]+)`/g)]
    .map(([, label, sample]) => `${label.trim()} (${sample})`);
  if (named.length > 0) {
    console.log(`\n## the tier system is declared twice, and they differ`);
    console.log(`  packages/styles/src/modyra-base.css: ${[...tiers.keys()].map((t) => `--mdy-${t}-*`).join(", ")}`);
    console.log(`  docs/guides/ui-toolkit.md:           ${named.join("; ")}`);
    console.log("  The guide names a family the stylesheet header does not, calls it \"the quickest path");
    console.log("  for a global brand color change\", and shows it being set in `:root` — a consumer");
    console.log("  surface. Most of the untiered above are that family. Until one declaration covers");
    console.log("  both, the public perimeter printed here is the narrower of the two readings.");
  }
}

console.log(`\nThe guide that is owed covers ${undocumented.length} propert(y/ies) — that is its perimeter.`);
if (CHECK && phantom.length > 0) {
  console.error("\nA DOCUMENT NAMES A PROPERTY NOTHING DECLARES — the prose is stale, or the example");
  console.error("uses a host's own property and should be recorded in NOT_OURS with that reason.");
  process.exit(1);
}
