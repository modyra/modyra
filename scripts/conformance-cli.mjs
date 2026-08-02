/**
 * Runs the conformance suite against a renderer this repository did not write.
 *
 *   node scripts/conformance-cli.mjs <adapter.config.mjs>
 *
 * Milestone G's fifth proof is a public conformance kit. Everything it runs already exists in
 * `@modyra/widgets/testing`; this only packages it behind one entry point, so an implementer can
 * check their renderer without reading four suites to find out how.
 *
 * ## The adapter config
 *
 * A module exporting `{ name, kinds, mount }` — the same shape `collectStateMatrix` already takes:
 *
 *   export const name  = "@acme/renderer";
 *   export const kinds = ["text", "select"];              // the kinds you draw
 *   export async function mount(kind) { … }               // returns an MdyStateFixture
 *
 * The config owns its own environment. A renderer needs a DOM and only its author knows how theirs
 * is set up, so the config installs one before exporting `mount` — the shipped examples in
 * `packages/plain` and `packages/lit` do exactly that and are the reference.
 *
 * ## What this cannot answer
 *
 * Keyboard behaviour and an accessibility audit need a real browser: focus, native key defaults and
 * computed accessible names are not simulable, and asserting them here would produce a green that
 * means nothing. Both are **reported as not run**, with the reason, rather than omitted — an
 * implementer has to know the suite did not cover them.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const configPath = process.argv[2];

if (!configPath) {
  console.error("usage: node scripts/conformance-cli.mjs <adapter.config.mjs>");
  process.exit(2);
}

const {
  MDY_CANONICAL_AT_REST, canonicalWidgetSnapshot, collectStateMatrix, compareToCanonical,
  idsUnder, inspectCoexistence, inspectUnmount, inspectWidgetDom,
} = await import(pathToFileURL(resolve(root, "packages/widgets/dist/testing/index.js")).href);

const config = await import(pathToFileURL(resolve(process.cwd(), configPath)).href);
const { name = configPath, kinds, mount } = config;

if (!Array.isArray(kinds) || typeof mount !== "function") {
  console.error(`${configPath}: a config must export 'kinds' (array) and 'mount' (function).`);
  process.exit(2);
}

/** A section's findings, in the contract's vocabulary. Empty is a pass. */
const sections = [];
const record = (title, findings, note) => sections.push({ title, findings, note });

// ── DOM anatomy and relationships ─────────────────────────────────────────────────────────
{
  const findings = [];
  for (const kind of kinds) {
    const fixture = await mount(kind);
    await fixture.settle?.();
    const parts = fixture.parts();

    // Which parts a kind legitimately does not render at rest is the adapter's to declare, not this
    // script's to guess: the contract leaves eager-versus-lazy mounting free, so a closed popup's
    // parts may or may not be in the DOM. Deriving it from what the part map happens to mention
    // conflates "the config did not name this part" with "the renderer did not draw it".
    //
    // It is not a silencer either — the inspector rejects a list naming a part the contract makes
    // mandatory, and rejects one naming a part that is still in the DOM.
    const absentParts = config.absentParts?.[kind] ?? [];

    for (const issue of inspectWidgetDom(fixture.root, kind, { parts, absentParts })) {
      findings.push(`${kind}.${issue.part ?? "-"}: ${issue.code} ${issue.message ?? ""}`.trim());
    }
    fixture.dispose();
  }
  record("DOM anatomy and relationships", findings);
}

// ── State matrix ──────────────────────────────────────────────────────────────────────────
{
  const matrix = await collectStateMatrix({ kinds, mount });
  const findings = Object.entries(matrix.observed).map(
    ([pair, codes]) => `${pair}: ${codes.join(", ")}`,
  );
  for (const kind of matrix.unsupportedAria) {
    findings.push(`${kind}: exposes ARIA for a state it does not declare`);
  }
  record(
    "State matrix",
    findings,
    `${matrix.asserted} of ${matrix.expected} pairs asserted`
      + (matrix.undrivable.length ? `, ${matrix.undrivable.length} undrivable` : ""),
  );
}

// ── Renderer equivalence, at rest ─────────────────────────────────────────────────────────
{
  const findings = [];
  for (const kind of kinds) {
    const expectation = MDY_CANONICAL_AT_REST[kind];
    if (!expectation) continue;
    const fixture = await mount(kind, { validators: false });
    await fixture.settle?.();
    const snapshot = canonicalWidgetSnapshot(fixture.root, kind, {
      parts: fixture.parts(),
      // The value the form holds, not the value the DOM displays: comparing the rendering would ask
      // three renderers to agree on how they show a value rather than which one they hold.
      value: fixture.value?.(),
    });
    for (const difference of compareToCanonical(snapshot, expectation)) {
      findings.push(`${kind}: ${difference}`);
    }
    fixture.dispose();
  }
  record("Renderer equivalence (at rest)", findings);
}

// ── Lifecycle: what a mount owes when it is taken down ────────────────────────────────────
{
  const findings = [];
  const document = globalThis.document;
  for (const kind of kinds) {
    const before = document.body.querySelectorAll("*").length;
    const fixture = await mount(kind);
    await fixture.settle?.();
    const held = idsUnder(document);
    fixture.dispose();

    for (const issue of inspectUnmount({
      document, idsWhileMounted: held, elementsBeforeMount: before,
    })) {
      findings.push(`${kind}: ${issue.code} — ${issue.detail}`);
    }
  }
  record("Lifecycle (nothing survives unmount)", findings);
}

// ── Multi-instance isolation ──────────────────────────────────────────────────────────────
//
// Only meaningful when the config can mint two instances that are *meant* to differ. Two mounts of
// the same fixture share their field names, so their ids collide by construction — and that is
// documented behaviour, not a defect: id scoping is opt-in. Reporting it as a violation would fail
// every renderer for doing what the contract says.
if (typeof config.mountScoped === "function") {
  const findings = [];
  for (const kind of kinds) {
    const first = await config.mountScoped(kind, "one");
    const second = await config.mountScoped(kind, "two");
    await first.settle?.();
    await second.settle?.();

    for (const issue of inspectCoexistence(idsUnder(first.root), idsUnder(second.root))) {
      findings.push(`${kind}: ${issue.code} — ${issue.detail}`);
    }
    first.dispose();
    second.dispose();
  }
  record("Multi-instance isolation", findings);
} else {
  record(
    "Multi-instance isolation",
    null,
    "not run — the config exports no `mountScoped(kind, scope)`, so there is no way to ask this"
      + " renderer for two instances that should not share ids",
  );
}

// ── What a Node harness cannot answer ─────────────────────────────────────────────────────
record("Keyboard behaviour", null, "not run — real key presses, focus and native defaults need a browser");
record("Accessibility audit", null, "not run — computed accessible names and an axe pass need a browser");

// ── Report ────────────────────────────────────────────────────────────────────────────────
console.log(`\nModyra conformance — ${name}\n${"─".repeat(40)}`);
let failed = 0;
for (const { title, findings, note } of sections) {
  if (findings === null) {
    console.log(`  ~ ${title}\n      ${note}`);
    continue;
  }
  if (findings.length === 0) {
    console.log(`  ✓ ${title}${note ? `\n      ${note}` : ""}`);
    continue;
  }
  failed += findings.length;
  console.log(`  ✗ ${title}${note ? `\n      ${note}` : ""}`);
  for (const finding of findings.slice(0, 10)) console.log(`      ${finding}`);
  if (findings.length > 10) console.log(`      … ${findings.length - 10} more`);
}

console.log(
  `\n${failed === 0 ? "CONFORMANT" : `NOT CONFORMANT — ${failed} finding(s)`}`
  + `  ·  ${kinds.length} kind(s)  ·  2 section(s) need a browser\n`,
);
process.exit(failed === 0 ? 0 : 1);
