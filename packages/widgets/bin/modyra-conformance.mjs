#!/usr/bin/env node
/**
 * Runs the conformance suite against a renderer this package did not write.
 *
 *   npx modyra-conformance <adapter.config.mjs>
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
 *   export async function mount(kind, asked) { … }        // returns an MdyStateFixture
 *
 * `asked` is the second argument this tool passes, and a renderer written from the one-argument
 * signature never receives what a document declares — so a section asking whether a part appears
 * *because the document declared it* cannot be answered, and reports a defect the renderer does not
 * have. Three shapes arrive, each from the section that needs it:
 *
 *   { variant }             draw this configured variant of the kind
 *   { validators: false }   draw it with no rules at all, whatever your fixture's default is
 *   { rules }               draw it with exactly these rules, so their reaching the control can be
 *                           checked — declare `declaresRules` to say you pass them on
 *
 * A mount that ignores `asked` is conforming for every section that does not use it. What it may
 * not do is accept the argument and drop it: the sections that pass one report against what they
 * asked for.
 *
 * The config owns its own environment. A renderer needs a DOM and only its author knows how theirs
 * is set up, so the config installs one before exporting `mount`. This repository's own two
 * conformance configs are the reference.
 *
 * ## The two sections that need a browser
 *
 * Keyboard behaviour and an accessibility audit cannot be answered in Node: focus, native key
 * defaults and computed accessible names are not simulable, and asserting them here would produce a
 * green that means nothing. They are **reported as not run**, with the reason, rather than omitted.
 *
 * A config that can reach a browser runs them, by exporting one more function:
 *
 *   export async function openBrowserSession(kind) {
 *     return {
 *       press(key),          // a real key press, where focus currently is
 *       focusOpener(),       // focus the widget's opener; false if it has none
 *       evaluate(source),    // run a function's source in the page, return JSON
 *       close(),
 *     };
 *   }
 *
 * The assertions are this kit's and are evaluated in the page; the config supplies only the
 * transport. That is deliberate — this package takes no browser dependency, an implementer drives it
 * with whatever they already run their own tests with, and the *rules* stay in one place rather than
 * being re-derived per renderer, which is the failure the kit exists to prevent.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// This file ships inside the package, so the kit is a sibling of it rather than a path from a
// repository root that an installed copy does not have.
const packageRoot = resolve(new URL("..", import.meta.url).pathname);
const configPath = process.argv[2];

if (!configPath) {
  console.error("usage: modyra-conformance <adapter.config.mjs>");
  process.exit(2);
}

const {
  MDY_CANONICAL_AT_REST, canonicalWidgetSnapshot, collectStateMatrix, compareToCanonical,
  idsUnder, inspectCoexistence, inspectUnmount, inspectWidgetDom,
} = await import(pathToFileURL(resolve(packageRoot, "dist/testing/index.js")).href);

const { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } = await import(pathToFileURL(resolve(packageRoot, "dist/index.js")).href);

// Loaded with its own diagnosis. A config that throws on import is the normal first experience of
// this tool — a missing DOM, a path that does not exist, a renderer that fails to construct — and a
// raw stack trace from inside `import()` says nothing about which of those happened.
let config;
try {
  config = await import(pathToFileURL(resolve(process.cwd(), configPath)).href);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Could not load ${configPath}\n  ${reason}`);
  if (/Cannot find (module|package)/.test(reason)) {
    console.error(
      "\nIf that names a package rather than your config, the config imported something that is not"
      + "\ninstalled here. It runs in your project, so its dependencies have to be yours.",
    );
  }
  process.exit(2);
}

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

  // A kind whose anatomy depends on configuration is inspected once per variant, against that
  // variant's own anatomy. Without this the run reports full coverage having rendered one of them,
  // and the half that differs — which is the half the variants exist for — is never checked.
  let variantRuns = 0;
  for (const [kind, names] of Object.entries(config.variants ?? {})) {
    if (!kinds.includes(kind)) continue;
    for (const variant of names) {
      const fixture = await mount(kind, { variant });
      await fixture.settle?.();
      variantRuns += 1;
      // What a renderer does not draw at rest is stated per kind, and a variant can contradict it:
      // the steppers are absent in a toggle chip and required in a counter one. The variant wins,
      // because it is the more specific statement about the same instance.
      const required = new Set(MDY_WIDGET_CONTRACTS[kind]?.variants?.[variant]?.required ?? []);
      const absentParts = (config.absentParts?.[kind] ?? []).filter((part) => !required.has(part));
      for (const issue of inspectWidgetDom(fixture.root, kind, { parts: fixture.parts(), absentParts, variant })) {
        findings.push(`${kind}[${variant}].${issue.part ?? "-"}: ${issue.code} ${issue.message ?? ""}`.trim());
      }
      fixture.dispose();
    }
  }
  record(
    "DOM anatomy and relationships",
    findings,
    variantRuns ? `${kinds.length} kind(s), plus ${variantRuns} configured variant(s)` : undefined,
  );
}

// ── DOM anatomy while open ────────────────────────────────────────────────────────────────
{
  // A resting widget renders no popup, so every part the contract requires *inside* one is skipped
  // above — which is correct at rest and silent everywhere else. Without this pass, "the popup must
  // frame a list" is a rule no renderer is ever asked about.
  const findings = [];
  const opened = [];
  for (const kind of kinds) {
    if (!MDY_WIDGET_CONTRACTS[kind]?.capabilities.overlay) continue;
    const fixture = await mount(kind);
    await fixture.settle?.();
    if (fixture.drive?.("open") === false) {
      fixture.dispose();
      continue;
    }
    await fixture.settle?.();
    opened.push(kind);
    for (const issue of inspectWidgetDom(fixture.root, kind, { parts: fixture.parts(), open: true })) {
      findings.push(`${kind}.${issue.part ?? "-"}: ${issue.code} ${issue.message ?? ""}`.trim());
    }
    fixture.dispose();
  }
  record(
    "DOM anatomy while open",
    findings,
    opened.length ? `${opened.length} overlay kind(s) driven open` : "no overlay kind could be driven open",
  );
}

// ── State matrix ──────────────────────────────────────────────────────────────────────────
{
  // A fixture the kit cannot drive is a config problem, and this tool already refuses to answer one
  // with a stack trace from inside itself: the message names the member and what it is for, and the
  // exit code says it is the config rather than the renderer.
  let matrix;
  try {
    matrix = await collectStateMatrix({ kinds, mount });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`\nThis config's mount does not return what the kit drives.\n\n  ${reason}\n`);
    process.exit(2);
  }
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

// ── A rule a field declares reaches the control ───────────────────────────────────────────
//
// A constraint is a rule and an input attribute at the same time. A renderer that keeps only the
// first is not wrong about anything a consumer can see until someone types the fifty-first
// character — which is exactly the kind of silence this kit exists to break.
//
// The kit asks in the contract's vocabulary (`rules`), so a config translates once into whatever
// its renderer calls a validator. A config that does not declare it forwards them gets "not run":
// the kit cannot tell a renderer that ignores a constraint from a config that never handed it one,
// and reporting the first when it is the second is an accusation it cannot support.
if (config.declaresRules === true) {
  const findings = [];
  /**
   * The element the attributes belong on, named in the contract's vocabulary.
   *
   * `parts()` is the one thing every config provides, and the catalogue calls this part `input` on a
   * text-like kind and `control` elsewhere. Asking the root instead would read the renderer's outer
   * element and report "carries nothing" about a control that carries everything.
   */
  const attributeOf = (fixture, attribute) => {
    const parts = fixture.parts?.() ?? {};
    const control = parts["input"] ?? parts["control"] ?? fixture.control?.() ?? fixture.root;
    return control?.getAttribute?.(attribute) ?? null;
  };

  const expectations = [
    { kind: "text", rules: { maxLength: 8, minLength: 2 }, expect: { maxlength: "8", minlength: "2" } },
    { kind: "textarea", rules: { maxLength: 8 }, expect: { maxlength: "8" } },
    { kind: "number", rules: { min: 1, max: 9 }, expect: { min: "1", max: "9" } },
  ];

  for (const { kind, rules, expect } of expectations) {
    if (!kinds.includes(kind)) continue;
    const fixture = await mount(kind, { rules });
    await fixture.settle?.();
    for (const [attribute, wanted] of Object.entries(expect)) {
      const found = attributeOf(fixture, attribute);
      if (found !== wanted) {
        findings.push(
          `${kind}: the field declares ${attribute}=${wanted}, the control carries ` +
          `${found === null ? "nothing" : `"${found}"`}`,
        );
      }
    }
    fixture.dispose();
  }

  record("Declared rules reach the control", findings);
} else {
  record(
    "Declared rules reach the control",
    null,
    "not run — the config does not export `declaresRules`, so it may not pass `rules` to its fixture",
  );
}

// ── A value the options do not contain is shown ───────────────────────────────────────────
//
// A widget does not erase what it cannot show (ADR 0029), which leaves it owing the other half:
// what it will not erase, it has to display, or the form holds something nobody can see or remove.
if (config.declaresRules === true) {
  const findings = [];
  const OUTSIDE = "mdy-conformance-not-an-option";

  for (const kind of ["select", "multiselect"]) {
    if (!kinds.includes(kind)) continue;
    const fixture = await mount(kind, {
      validators: false,
      value: kind === "multiselect" ? [OUTSIDE] : OUTSIDE,
    });
    await fixture.settle?.();
    if (!(fixture.root?.textContent ?? "").includes(OUTSIDE)) {
      findings.push(
        `${kind}: holds a value its options do not contain and shows nothing standing for it, ` +
        "so it cannot be seen or replaced",
      );
    }
    fixture.dispose();
  }

  record("A value the options do not contain is shown", findings);
} else {
  record(
    "A value the options do not contain is shown",
    null,
    "not run — the config does not export `declaresRules`, so it may not pass `value` to its fixture",
  );
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
  // Which kinds put no id on the page. An instance that mints none carries none of the
  // relationships an id ties together, so there is nothing between two of them that could
  // collide: the intersection is empty because the subject is absent, not because it is sound.
  // Tracked per kind, because a renderer may legitimately id some kinds and not others.
  const kindsWithoutIds = [];
  for (const kind of kinds) {
    const first = await config.mountScoped(kind, "one");
    const second = await config.mountScoped(kind, "two");
    await first.settle?.();
    await second.settle?.();

    const firstIds = idsUnder(first.root);
    const secondIds = idsUnder(second.root);
    if (firstIds.size === 0 && secondIds.size === 0) kindsWithoutIds.push(kind);

    for (const issue of inspectCoexistence(firstIds, secondIds)) {
      findings.push(`${kind}: ${issue.code} — ${issue.detail}`);
    }
    first.dispose();
    second.dispose();
  }
  if (kindsWithoutIds.length === kinds.length) {
    record(
      "Multi-instance isolation",
      null,
      "not run — no kind emitted an id, so no two instances have anything that could collide;"
        + " passing here would report an isolation this renderer never demonstrated",
    );
  } else {
    record(
      "Multi-instance isolation",
      findings,
      kindsWithoutIds.length > 0
        ? `not established for ${kindsWithoutIds.join(", ")}: no id was emitted, so nothing there`
          + " could collide"
        : undefined,
    );
  }
} else {
  record(
    "Multi-instance isolation",
    null,
    "not run — the config exports no `mountScoped(kind, scope)`, so there is no way to ask this"
      + " renderer for two instances that should not share ids",
  );
}

// ── What the kit evaluates in the page ─────────────────────────────────────────────────────
//
// Serialized to the session as source, so the transport only has to be able to run a function in the
// page and return JSON. Nothing here reaches for a driver's own API.

const OPEN_THE_WIDGET = `(root) => {
  const opener = root.querySelector(
    ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle,"
    + " .mdy-colors__toggle-area, .mdy-multiselect__search-btn",
  );
  if (!opener) return false;
  opener.click();
  return true;
}`;

const READ_STATE = `(root) => {
  const expanded = root.querySelector("[aria-expanded]");
  const active = root.querySelector("[aria-activedescendant]");
  return {
    open: expanded?.getAttribute("aria-expanded") === "true",
    activeOption: active?.getAttribute("aria-activedescendant") ?? null,
    focusInsideWidget: !!(document.activeElement && root.contains(document.activeElement)),
  };
}`;

/**
 * Operable elements, and which of them announce nothing.
 *
 * The name is computed the way the platform computes it, in the order the accname specification
 * uses, rather than guessed from one attribute. An element hidden from the accessibility tree is
 * skipped: it is not announced because it is not there, which is a different statement.
 */
const READ_NAMELESS_CONTROLS = `(root) => {
  const OPERABLE = "button, input, select, textarea, a[href], [role=option], [role=button], [tabindex]:not([tabindex='-1'])";
  const missing = [];
  let total = 0;
  for (const element of root.querySelectorAll(OPERABLE)) {
    if (element.closest("[aria-hidden=true]") || element.hidden) continue;
    total += 1;
    const labelled = element.getAttribute("aria-labelledby");
    const fromIds = labelled
      ? labelled.split(/\\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? "").join(" ").trim()
      : "";
    const explicit = element.getAttribute("aria-label")?.trim() ?? "";
    const associated = element.id
      ? (document.querySelector('label[for="' + CSS.escape(element.id) + '"]')?.textContent?.trim() ?? "")
      : "";
    const wrapping = element.closest("label")?.textContent?.trim() ?? "";
    const own = element.tagName === "INPUT" || element.tagName === "SELECT" || element.tagName === "TEXTAREA"
      ? ""
      : (element.textContent?.trim() ?? "");
    const title = element.getAttribute("title")?.trim() ?? "";
    const name = fromIds || explicit || associated || wrapping || own || title;
    if (!name) {
      const where = element.className ? "." + String(element.className).split(/\\s+/)[0] : element.tagName.toLowerCase();
      missing.push(where);
    }
  }
  return { total, missing: [...new Set(missing)] };
}`;

// ── What needs a real browser ─────────────────────────────────────────────────────────────
//
// Focus, native key defaults and accessible-name computation are not simulable, so these two ran
// nowhere and the verdict said so. Saying so is not covering them: they are what a keyboard user and
// a screen-reader user depend on, which makes them the worst pair to leave unestablished.
//
// A config may supply a browser session, and then they run. The *rules* stay here — every assertion
// below is this kit's, evaluated in the page — and the config supplies only the transport, so this
// package gains no dependency and a consumer drives it with whatever they already have.
if (typeof config.openBrowserSession === "function") {
  const keyboard = await checkKeyboard(config.openBrowserSession);
  record("Keyboard behaviour", keyboard.findings, keyboard.note);
  const names = await checkAccessibleNames(config.openBrowserSession);
  record("Accessibility audit", names.findings, names.note);
} else {
  const how = "not run — no `openBrowserSession` in the config; see the kit's docs for its four methods";
  record("Keyboard behaviour", null, how);
  record("Accessibility audit", null, how);
}

/**
 * A key the contract declares, pressed for real, with the declared effect asserted.
 *
 * Only `open` and `cancel` are asserted, and the narrowness is the point.
 *
 * `commit` and `clear` change a value, which the state matrix already covers in a harness that can
 * read one. `move` was asserted here and produced false findings rather than defects: what "the
 * active option moved" looks like is not one thing — an overlay drives a list with
 * `aria-activedescendant` while a segmented control moves real focus between radios — and a key
 * pressed at the end of a list legitimately moves nothing. The contract does not pin either, so a
 * single check of it reports the renderer for not matching a guess. It is counted as unasserted
 * rather than quietly passed.
 *
 * A binding whose precondition cannot be reached is reported as unreachable rather than passed. A
 * key that could not be delivered is not a key the widget ignored.
 */
async function checkKeyboard(openSession) {
  const findings = [];
  let asserted = 0;
  let unreachable = 0;

  for (const kind of kinds) {
    const bindings = (MDY_WIDGET_KEYBOARD[kind] ?? []).filter(
      (binding) => binding.intent === "open" || binding.intent === "cancel",
    );
    if (bindings.length === 0) continue;

    for (const binding of bindings) {
      const session = await openSession(kind);
      try {
        // The precondition is part of the binding: a key declared `when: "open"` says nothing about
        // a closed widget, and pressing it on one asserts the wrong question.
        if (binding.when === "open" && !(await session.evaluate(OPEN_THE_WIDGET))) {
          unreachable += 1;
          continue;
        }
        if (!(await session.focusOpener())) {
          unreachable += 1;
          continue;
        }

        const before = await session.evaluate(READ_STATE);
        if (!before) {
          unreachable += 1;
          continue;
        }
        await session.press(binding.key);
        const after = await session.evaluate(READ_STATE);

        asserted += 1;
        const describe = `${kind} ${JSON.stringify(binding.key)} when ${binding.when} (${binding.intent})`;

        if (binding.intent === "open" && !after.open) {
          findings.push(`${describe}: the widget did not open`);
        }
        if (binding.intent === "cancel" && after.open) {
          findings.push(`${describe}: the widget did not close`);
        }
        // Restoring focus is declared per binding, and a widget that closes while leaving focus
        // nowhere has stranded the user who pressed the key.
        if (binding.intent === "cancel" && binding.restoresFocus && !after.focusInsideWidget) {
          findings.push(`${describe}: focus was not restored to the widget`);
        }
      } finally {
        await session.close();
      }
    }
  }

  const unasserted = kinds.reduce(
    (total, kind) => total + (MDY_WIDGET_KEYBOARD[kind] ?? []).filter(
      (binding) => binding.intent !== "open" && binding.intent !== "cancel",
    ).length,
    0,
  );
  return {
    findings,
    note: `${asserted} open/cancel binding(s) pressed, ${unreachable} unreachable`
      + `, ${unasserted} binding(s) not asserted here (commit, clear and move)`,
  };
}

/**
 * Every operable element carries a name a screen reader can announce.
 *
 * The browser computes it, which is the point: an icon-only button with a `title`, a label
 * associated by `for`, and `aria-labelledby` pointing at three elements all produce names no static
 * check can predict, and a widget that announces nothing is a widget only a pointer can use.
 */
async function checkAccessibleNames(openSession) {
  const findings = [];
  let asserted = 0;
  let absent = 0;

  for (const kind of kinds) {
    const session = await openSession(kind);
    try {
      // Opened where it opens: the options, the calendar cells and the clock face are the elements
      // most likely to be nameless, and they do not exist while the widget is shut.
      await session.evaluate(OPEN_THE_WIDGET);
      const nameless = await session.evaluate(READ_NAMELESS_CONTROLS);
      // A session that cannot reach this kind reports nothing rather than nothing wrong.
      if (!nameless) {
        absent += 1;
        continue;
      }
      asserted += nameless.total;
      for (const control of nameless.missing) {
        findings.push(`${kind}: ${control} has no accessible name`);
      }
    } finally {
      await session.close();
    }
  }

  return {
    findings,
    note: `${asserted} operable element(s) checked for a name`
      + (absent ? `, ${absent} kind(s) not reachable in the session` : ""),
  };
}

// Whatever the browser sections started, closed before the report: a run that never exits reads as
// a hung suite rather than a passing one.
if (typeof config.disposeBrowser === "function") await config.disposeBrowser();

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

// A run that did not execute two of its sections has not established conformance, and a verdict that
// says otherwise is the failure this kit exists to prevent, one level up: a consumer wiring the exit
// code into CI reads an unqualified word and a zero. The verdict names its own coverage instead, and
// the two sections it cannot reach are the ones a keyboard user and a screen-reader user depend on —
// precisely where a renderer is most likely to diverge unnoticed.
const skipped = sections.filter((section) => section.findings === null);
const ran = sections.length - skipped.length;
const verdict = failed > 0
  ? `NOT CONFORMANT — ${failed} finding(s)`
  : skipped.length === 0
    ? "CONFORMANT"
    : "CONFORMANT WHERE CHECKED";

console.log(
  `\n${verdict}  ·  ${kinds.length} kind(s)  ·  ${ran} of ${sections.length} section(s) run\n`
  + (skipped.length === 0
    ? ""
    : `  Not established: ${skipped.map((section) => section.title).join(", ")}.\n`
      + "  Run the browser suites for these; this exit code does not cover them.\n"),
);
process.exit(failed === 0 ? 0 : 1);
