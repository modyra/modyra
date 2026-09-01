/**
 * `@modyra/plain`'s conformance config — the reference an implementer copies.
 *
 *   node scripts/conformance-cli.mjs packages/plain/conformance.config.mjs
 *
 * A config's whole job is to say which kinds the renderer draws and how to mount one. The
 * environment is its own business: a renderer needs a DOM, and only its author knows how theirs is
 * set up, so the DOM is installed here before anything is exported.
 *
 * This one delegates to the fixture the package's own suites already drive, rather than describing
 * the renderer a second time. A config written independently of the suite is a second opinion about
 * what the renderer does, and the two drift.
 */
import { installDomGlobals } from "./test/support/dom-env.mjs";

installDomGlobals();

const fixture = await import("./test/support/state-fixture.mjs");
const contractParts = await import("./test/contract-parts.mjs");

export const name = "@modyra/plain";
export const kinds = fixture.KINDS;

/**
 * Mount one widget, ready to drive.
 *
 * Delegated to the fixture the package's own suites already use — but written out rather than
 * assigned across, because this file is what an implementer copies. `export const mount =
 * fixture.mount` is shorter and shows nothing: the members below are what the kit calls, and a
 * mount that omits one is refused by name before anything is driven.
 *
 * `root`, `parts`, `drive`, `settle` and `dispose` are owed. `control`, `value` and `press` are
 * offered when the adapter can answer them, and skipped with a reason when it cannot.
 */
export const mount = async (...given) => {
  // Every argument forwarded, not just the kind: the kit hands a mount its `rules` and `value` when
  // the config says it passes them on, and a wrapper that names only the first silently drops them —
  // which reads as a renderer ignoring a declared constraint rather than as a config that never
  // handed one over.
  const mounted = await fixture.mount(...given);
  return {
    /** The element the widget was rendered into. */
    root: mounted.root,
    /** Where each contract part is, as `inspectWidgetDom` takes it. */
    parts: () => mounted.parts(),
    /** Put the widget in a state; `false` when the public API offers no way to reach it. */
    drive: (state) => mounted.drive(state),
    /** Let the rendering settle, so an assertion does not read the previous value. */
    settle: () => mounted.settle(),
    dispose: () => mounted.dispose(),
    ...(mounted.control ? { control: () => mounted.control() } : {}),
    ...(mounted.value ? { value: () => mounted.value() } : {}),
    ...(mounted.press ? { press: (key) => mounted.press(key) } : {}),
  };
};

/** What each kind legitimately does not render at rest -- the suite's own list, not a second one. */
export const absentParts = contractParts.ABSENT;

/**
 * Kinds whose anatomy depends on configuration, and the values this renderer supports.
 *
 * Declared because a suite that mounts one variant reports full coverage having rendered half the
 * widget — the same shape as the gap the variants exist to close. The names are the config's own.
 */
/**
 * This config passes the kit's `rules` and `value` to its fixture.
 *
 * Declared rather than assumed: without it the kit cannot tell a renderer that ignores a declared
 * constraint from a config that never handed it one, and reporting the first when it is the second
 * would be an accusation the kit cannot support.
 */
export const declaresRules = true;

// A renderer declares the shapes *it* draws, not every shape the kind has. This one draws the
// combobox whichever way the field is configured — deliberately, and the reason six cross-renderer
// findings looked like divergences: two renderers hand a non-filtering select to the platform and
// this one does not. Listing `native` here would report it non-conforming for a shape it never
// claims to render.
export const variants = { multiselect: ["single", "multi"], select: ["custom"] };


const { mountMdyForm } = await import("./dist/index.js");

/** This renderer schedules onto a task: a signal write is not in the DOM until the turn ends. */
const { settleFor } = await import("../widgets/dist/testing/index.js");
const PAINT_BEAT = "task";

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const NEEDS_OPTIONS = new Set(["radio", "segmented", "select", "multiselect"]);

/**
 * Two instances that are meant to differ.
 *
 * Optional, and the suite says so when it is missing: two mounts of the same fixture share their
 * field names and so share their ids, which is documented behaviour rather than a defect. A
 * renderer that can scope its ids says how here, and this one does it with `idPrefix`.
 */
export function mountScoped(kind, scope) {
  const host = document.createElement("div");
  document.body.append(host);
  const field = {
    name: "f", kind, label: "F",
    ...(NEEDS_OPTIONS.has(kind) ? { options: OPTIONS } : {}),
  };
  const mounted = mountMdyForm(host, [field], { submitLabel: null, idPrefix: scope });
  return {
    root: host.querySelector(`[data-mdy-field="f"]`) ?? host,
    parts: () => ({}),
    settle: settleFor(PAINT_BEAT),
    dispose: () => { mounted.dispose(); host.remove(); },
  };
}
