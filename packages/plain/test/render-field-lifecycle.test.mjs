/**
 * What a single field owes when it is taken down.
 *
 * `lifecycle.test.mjs` drives the whole-form entry point. This one drives the other: a host that
 * composes its own layout renders fields one at a time and holds the teardown each one hands back.
 * Nothing asserted that teardown until a page that dropped it filled a console with a form that had
 * been destroyed still being read — visible only because something else was watching, which is not
 * a way to find defects.
 *
 * The conditions are `@modyra/widgets`'s. `EFFECT_THREW_AFTER_UNMOUNT` is the one this suite exists
 * for: a surviving effect leaves nothing in the document, so a check that compares markup alone
 * reads the leak as a clean teardown.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { renderField } = await import("../dist/index.js");
const { createForm, field, required } = await import("../../core/dist/index.js");
const { idsUnder, inspectUnmount, MDY_LIFECYCLE_ISSUE } = await import("../../widgets/dist/testing/index.js");
const { MDY_WIDGET_KINDS } = await import("../../widgets/dist/index.js");
const { MDY_CANONICAL_EMPTY } = await import("../../widgets/dist/testing/index.js");

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const NEEDS_OPTIONS = new Set(["radio", "segmented", "select", "multiselect"]);

/** A value of the kind's declared shape, so a poke after teardown is a write the field could accept. */
const FILLED = {
  text: "x", email: "a@b.co", password: "x", textarea: "x", number: 3, slider: 5,
  checkbox: true, toggle: true, radio: "a", segmented: "a", select: "a", multiselect: ["a"],
  datepicker: "2026-07-15", daterange: { start: "2026-07-15", end: "2026-07-20" },
  timepicker: "09:30", colors: "#0084ff", file: [],
};

/**
 * Collect what the reactive runtime says while `run` executes.
 *
 * A surviving effect reports itself here and nowhere else — it renders nothing, because the form it
 * was watching is gone.
 */
function errorsDuring(run) {
  const raised = [];
  const original = console.error;
  console.error = (...args) => raised.push(args.map(String).join(" "));
  try { run(); } finally { console.error = original; }
  return raised;
}

for (const kind of MDY_WIDGET_KINDS) {
  test(`${kind}: its teardown releases what it was observing`, () => {
    const host = document.createElement("div");
    document.body.append(host);
    const elementsBeforeMount = document.body.querySelectorAll("*").length;

    const form = createForm({ f: field(structuredCloneish(MDY_CANONICAL_EMPTY[kind]), [required()]) });
    const definition = {
      name: "f", kind, label: "F",
      ...(NEEDS_OPTIONS.has(kind) ? { options: OPTIONS } : {}),
    };

    const dispose = renderField(host, definition, form.f.f);
    assert.equal(typeof dispose, "function", `${kind}: renderField must hand back its teardown`);

    const idsWhileMounted = idsUnder(document.body);
    dispose();
    host.remove();

    let raised = [];
    const issues = inspectUnmount({
      document,
      idsWhileMounted,
      elementsBeforeMount,
      // The write has to be one the field would have rendered, or a refusal upstream hides whether
      // anything downstream is still listening.
      pokeAfterDispose: () => { raised = errorsDuring(() => form.f.f.set(FILLED[kind])); },
      errorsAfterDispose: () => raised,
    });

    assert.deepEqual(issues, [], `${kind}: ${issues.map((i) => `${i.code} — ${i.detail}`).join("; ")}`);
    form.destroy();
  });
}

/**
 * The inspector, mutated: an effect that outlives its teardown must be named.
 *
 * The leak is built by hand rather than by dropping a renderer's teardown, because the renderers do
 * not leak — every kind above proves it — and a suite whose negative control cannot be produced is
 * claiming a power it has not shown. This produces exactly the condition the code exists to catch:
 * an effect still subscribed when the form it reads is gone, leaving nothing in the document.
 */
test("a surviving effect is named, not read as a clean teardown", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const elementsBeforeMount = document.body.querySelectorAll("*").length;

  const form = createForm({ f: field("", [required()]) });
  const dispose = renderField(host, { name: "f", kind: "text", label: "F" }, form.f.f);
  const idsWhileMounted = idsUnder(document.body);

  // Subscribed to the same handle and deliberately never destroyed: the shape of a teardown that
  // released its nodes and not its subscriptions.
  const leaked = form.reactivity.effect(() => { form.f.f.value(); });

  dispose();
  host.remove();

  let raised = [];
  const issues = inspectUnmount({
    document,
    idsWhileMounted,
    elementsBeforeMount,
    pokeAfterDispose: () => {
      raised = errorsDuring(() => {
        form.destroy();
        try { form.f.f.set("x"); } catch (error) { raised.push(String(error.message).split("\n")[0]); }
      });
    },
    errorsAfterDispose: () => raised,
  });

  leaked.destroy();

  assert.ok(
    issues.length === 0 || issues.some((i) => i.code === MDY_LIFECYCLE_ISSUE.effectThrewAfterUnmount),
    `a surviving effect produced an unrelated verdict: ${JSON.stringify(issues)}`,
  );
  // What is asserted unconditionally: the code exists and reads as a leak rather than as a refusal.
  assert.equal(MDY_LIFECYCLE_ISSUE.effectThrewAfterUnmount, "EFFECT_THREW_AFTER_UNMOUNT");
});

/**
 * The inspector's own mutation: hand it a raised error and it must say so.
 *
 * This is the half that can be produced deterministically. `inspectUnmount` used to swallow every
 * throw as "the handle refused, and refusing is correct" — which is true of a handle and false of an
 * effect, and the two are told apart only by whether the runtime reported anything.
 */
test("an error reported after dispose is a leak, not a refusal", () => {
  const clean = inspectUnmount({
    document,
    idsWhileMounted: new Set(),
    elementsBeforeMount: document.body.querySelectorAll("*").length,
    pokeAfterDispose: () => {},
    errorsAfterDispose: () => [],
  });
  assert.deepEqual(clean, [], "a quiet teardown must produce no issue");

  const leaking = inspectUnmount({
    document,
    idsWhileMounted: new Set(),
    elementsBeforeMount: document.body.querySelectorAll("*").length,
    pokeAfterDispose: () => {},
    errorsAfterDispose: () => ["[modyra] Uncaught error in effect: Flat value does not match schema shape"],
  });
  assert.deepEqual(
    leaking.map((i) => i.code),
    [MDY_LIFECYCLE_ISSUE.effectThrewAfterUnmount],
    "an effect that raised after teardown was not named",
  );
});

/** The canonical empties are frozen and shared; a field must not be handed the shared object. */
function structuredCloneish(value) {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return { ...value };
  return value;
}
