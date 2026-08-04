/**
 * `@modyra/angular`'s conformance config.
 *
 *   node packages/widgets/bin/modyra-conformance.mjs packages/angular/conformance.config.mjs
 *
 * This package's own suites already drive `inspectWidgetDom` against the same contract, so the kit
 * is not its first check. What the kit adds is that coverage stops being a property of the suite
 * somebody wrote: two drivers of one contract are free to diverge in *what they check*, and they
 * had — the jest suite calls `inspectWidgetDom` with no variant, so multiselect's counter mode was
 * mounted nowhere in this package. The kit's anatomy pass mounts every declared variant, so the
 * contract decides what is covered.
 *
 * Bootstrapping costs more here than a renderer that only needs a DOM: this one needs a DOM, the JIT
 * compiler (the published package is partially compiled, so templates are compiled at run time), and
 * an application with a form adapter to inject — a control outside a form has no value to render.
 * That is a property of the framework, not of the contract, which is why it lives in this file and
 * nothing in the kit knows about it.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
// `defineProperty` rather than assignment: some of these are getter-only on `globalThis` in current
// Node, and a plain assignment throws rather than being ignored.
for (const key of [
  "window", "document", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "MouseEvent",
  "CustomEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame",
]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
}
Object.defineProperty(globalThis, "self", { value: dom.window, configurable: true, writable: true });

// Before anything that resolves an injectable: the published package ships partially compiled, and
// without the compiler the first injection fails rather than the first template.
await import("@angular/compiler");

const { Component, Injector, inject, signal, provideZonelessChangeDetection } = await import("@angular/core");
const { bootstrapApplication } = await import("@angular/platform-browser");
const ng = await import("./dist/fesm2022/modyra-angular.mjs");
const { MdyDeclarativeAdapter } = await import("./dist/fesm2022/modyra-angular-adapter.mjs");
const { MDY_WIDGET_CONTRACTS } = await import("../widgets/dist/index.js");
const { MDY_CANONICAL_EMPTY, findPartElement } = await import("../widgets/dist/testing/index.js");
const { explainValueMismatch } = await import("../core/dist/index.js");

export const name = "@modyra/angular";

/**
 * One control per kind, with the element that draws it and the inputs it needs to render anything.
 *
 * `email` and `password` are `mdy-control-text` with a type — the same distinction the catalogue
 * draws, and the reason the selector rather than the element name identifies a kind here.
 */
const CONTROLS = [
  { kind: "text", tag: "mdy-control-text", component: "MdyTextComponent", attrs: "" },
  { kind: "textarea", tag: "mdy-control-textarea", component: "MdyTextareaComponent", attrs: "" },
  { kind: "number", tag: "mdy-control-number", component: "MdyNumberComponent", attrs: "" },
  { kind: "checkbox", tag: "mdy-control-checkbox", component: "MdyCheckboxComponent", attrs: "" },
  { kind: "toggle", tag: "mdy-control-toggle", component: "MdyToggleComponent", attrs: "" },
  { kind: "slider", tag: "mdy-control-slider", component: "MdySliderComponent", attrs: "" },
  { kind: "radio", tag: "mdy-control-radio", component: "MdyRadioGroupComponent", attrs: "[options]=\"options\"" },
  { kind: "segmented", tag: "mdy-control-segmented", component: "MdySegmentedButtonComponent", attrs: "[options]=\"options\"" },
  { kind: "email", tag: "mdy-control-text", component: "MdyTextComponent", attrs: "type=\"email\"" },
  { kind: "password", tag: "mdy-control-text", component: "MdyTextComponent", attrs: "type=\"password\"" },
  { kind: "select", tag: "mdy-control-select", component: "MdySelectComponent", attrs: "[options]=\"options\" searchable" },
  { kind: "multiselect", tag: "mdy-control-multiselect", component: "MdyMultiselectComponent", attrs: "[options]=\"options\" searchable" },
  { kind: "datepicker", tag: "mdy-control-datepicker", component: "MdyDatePickerComponent", attrs: "" },
  { kind: "daterange", tag: "mdy-control-daterange", component: "MdyDateRangePickerComponent", attrs: "" },
  { kind: "timepicker", tag: "mdy-control-timepicker", component: "MdyTimepickerComponent", attrs: "" },
  { kind: "file", tag: "mdy-control-file", component: "MdyFileComponent", attrs: "" },
  { kind: "colors", tag: "mdy-control-colors", component: "MdyColorsComponent", attrs: "" },
];

const BY_KIND = new Map(CONTROLS.map((control) => [control.kind, control]));

export const kinds = CONTROLS.map((control) => control.kind);

/**
 * Nothing is absent at rest.
 *
 * Measured, not assumed: this renderer builds its overlays eagerly, so every part the catalogue
 * declares is in the DOM before anything is opened. Declaring the overlay parts absent — which the
 * lazy renderer legitimately does — failed 48 checks here, each one the suite correctly refusing to
 * accept a claim contradicted by the DOM.
 *
 * An empty list is the strongest statement available: every part is checked at rest, and a part that
 * later stops being rendered fails rather than being covered by a waiver.
 */
export const absentParts = {};

/** The kinds whose anatomy depends on configuration, and the values this renderer supports. */
export const variants = { multiselect: ["single", "multi"] };

/**
 * What a kind holds when it holds something.
 *
 * Only the filled side is declared here. **Empty is not**: `MDY_CANONICAL_EMPTY` in
 * `@modyra/widgets/testing` already states it, the equivalence section compares against it, and a
 * second table would be a fixture disagreeing with the contract it is checking — which is what a
 * first version of this file did, reporting five kinds as divergent because it had invented `""`
 * where the contract says `null`.
 */
const FILLED = {
  multiselect: ["a"],
  radio: "a",
  segmented: "a",
  select: "a",
  checkbox: true,
  toggle: true,
  slider: 1,
  number: 1,
  file: [],
  daterange: { start: "2026-06-15", end: "2026-06-20" },
  colors: "#336699",
  datepicker: "2026-06-15",
  timepicker: "09:30",
};

const valueFor = (kind, which) =>
  which === "empty" ? MDY_CANONICAL_EMPTY[kind] : (kind in FILLED ? FILLED[kind] : "text");

/** What a kind holds before anything is driven: empty, like every other adapter's fixture. */
const seedFor = (kind) => valueFor(kind, "empty");

/**
 * Mounts one control, in its own application.
 *
 * One kind per application rather than one host for all seventeen: the kit mounts and disposes
 * repeatedly, and a shared host would make each mount's result depend on what the previous one left
 * behind — which is the failure `Multi-instance isolation` exists to detect, introduced by the
 * harness rather than found in the renderer.
 */
async function mountKind(kind, { variant, idPrefix, validators = true } = {}) {
  // The variant name *is* the mode: `MdyWidgetVariant` aliases core's `MdyMultiselectMode`, so the
  // kit's variant key and this input's value cannot drift apart. Nothing translates between them.
  const mode = variant;
  const control = BY_KIND.get(kind);
  if (!control) throw new Error(`no Angular control declared for kind "${kind}"`);

  const host = dom.window.document.createElement("div");
  const hostId = `mdy-conformance-${Math.random().toString(36).slice(2)}`;
  host.id = hostId;
  dom.window.document.body.append(host);

  const modeInput = mode ? ` [mode]="mode"` : "";
  /**
   * Validators are on by default, and the resting comparison turns them off.
   *
   * Most states are unreachable without one: a field with nothing to fail can never be invalid, so
   * every `invalid` row would be green about a state the widget cannot enter. A widget genuinely at
   * rest is the opposite question — a required field that is empty is invalid the moment it mounts,
   * and comparing that against the canonical resting state compares two different things.
   *
   * A slider is never empty, so `required` alone can never fail on one; it gets a bound instead.
   */
  const validation = !validators ? "" : kind === "slider" ? `mdyRequired [mdyMin]="1"` : "mdyRequired";
  const fieldName = idPrefix ? `${idPrefix}-field` : "field";

  class ConformanceHost {
    injector = inject(Injector);
    adapter = new MdyDeclarativeAdapter(
      signal({ [fieldName]: seedFor(kind) }),
      undefined,
      this.injector,
    );
    options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
    mode = mode ?? "single";
  }

  const Decorated = Component({
    selector: `#${hostId}`,
    standalone: true,
    imports: [ng.MdyFormComponent, ng.MdyRequiredDirective, ng.MdyMinDirective, ng[control.component]],
    template: `<mdy-form [adapter]="adapter">`
      + `<${control.tag} name="${fieldName}" label="Field" ${validation} ${control.attrs}${modeInput} />`
      + `</mdy-form>`,
  })(ConformanceHost);

  const app = await bootstrapApplication(Decorated, {
    providers: [provideZonelessChangeDetection()],
  });
  const instance = app.components[0].instance;
  await settle();

  const root = host.querySelector(selectorFor(control));
  const field = () => instance.adapter.getField(fieldName)?.();

  return {
    root: root ?? host,
    parts: () => partsOf(root, kind),
    value: () => field()?.value(),
    settle,
    dispose: () => {
      app.destroy();
      host.remove();
    },
    /**
     * Put the widget into a declared state, through the adapter's public API.
     *
     * Everything here goes through what a host application can reach — the adapter, the field's own
     * signals, a click on the opener. A driver that reached inside a component would assert that the
     * renderer can be forced into a state, not that it can be put into one.
     *
     * Returns `false` for a state this renderer offers no way into. The kit counts that separately
     * from a pass, which is the point: an undrivable state is unknown, not conformant.
     */
    drive(state) {
      switch (state) {
        case "pristine":
          return true;
        case "empty":
          field()?.value.set(checkedValue(kind, "empty"));
          return true;
        case "filled":
        case "selected":
          field()?.value.set(checkedValue(kind, "filled"));
          return true;
        case "touched":
          field()?.touched.set(true);
          return true;
        case "invalid":
          field()?.value.set(checkedValue(kind, "empty"));
          field()?.touched.set(true);
          return true;
        case "focused":
          (root?.querySelector("input, select, textarea, button, [tabindex]"))?.focus?.();
          return true;
        case "disabled":
          instance.adapter.setDisabled(fieldName, signal(true));
          return true;
        case "readonly":
          instance.adapter.setReadonly(fieldName, signal(true));
          return true;
        case "open": {
          const opener = root?.querySelector(OPENER);
          if (!opener) return false;
          opener.click();
          return true;
        }
        // Async options belong to the control rather than to the form, and nothing in the public
        // API drives them. Reported as undrivable rather than counted as a pass.
        case "loading":
          return false;
        default:
          return false;
      }
    },
  };
}

/**
 * Every part the contract declares for a kind, resolved out of the rendered DOM.
 *
 * `findPartElement` is the contract's own resolver, so this is not a second opinion about where a
 * part lives — it is the derivation the contract itself defines, from the same declaration every
 * renderer answers to. The body is passed as a portal root because an overlay may render outside
 * the widget it belongs to.
 */
function partsOf(root, kind) {
  const parts = {};
  if (!root) return parts;
  for (const node of MDY_WIDGET_CONTRACTS[kind].structure.nodes) {
    if (node.part === "root") continue;
    parts[node.part] = findPartElement(root, kind, node.part, {
      portalRoots: [root.ownerDocument.body],
    });
  }
  return parts;
}

/** The element that opens an overlay, per the kinds that have one. */
const OPENER = ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle,"
  + " .mdy-colors__toggle-area, .mdy-multiselect__search-btn";

/** A value the contract agrees the kind can hold, or a loud failure rather than a quiet green row. */
function checkedValue(kind, which) {
  const value = valueFor(kind, which);
  const mismatch = explainValueMismatch(kind, value);
  if (mismatch) throw new Error(`conformance config drives ${kind} ${which} with a bad shape: ${mismatch}`);
  return value;
}

/** One frame plus a macrotask: enough for a zoneless application's first render to have happened. */
const settle = () => new Promise((done) => setTimeout(done, 30));

/** `email` and `password` share an element with `text` and are told apart by their type. */
function selectorFor(control) {
  const type = /type="(\w+)"/.exec(control.attrs)?.[1];
  return type ? `${control.tag}[type="${type}"]` : control.tag;
}

export const mount = (kind, options) => mountKind(kind, options);

/**
 * Two instances that are meant to differ.
 *
 * This renderer's ids come from the caller's field name rather than from a counter it mints itself,
 * so a scope has to be given to it. A renderer that scopes its own ids has nothing to be told.
 */
export const mountScoped = (kind, scope) => mountKind(kind, { idPrefix: scope });
