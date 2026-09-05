/**
 * `@modyra/vue`'s conformance config, written before the renderer it describes.
 *
 * The kit refuses a config by naming what it lacks, before it drives anything — so a config written
 * first is a work list, and a config written last can only report that everything is missing. That
 * is the whole reason this file exists ahead of a single rendered kind: what it prints today is the
 * order the units that follow have to be built in.
 *
 * The DOM is installed here, as every config installs its own: a framework runtime needs more
 * globals than a hand-written renderer, and this package's harness says which and why.
 */
import { installDomGlobals } from "./test/support/dom-env.mjs";

installDomGlobals();

const { createApp, h } = await import("vue");
const { MdyTextField, MdyBooleanField, MdySliderField, MdyFileField, MdyOptionField, MdySelectField, MdyDatepickerField, MdyDaterangeField, MdyTimepickerField, MdyColorsField, MdyMultiselectField } = await import("./dist/index.js");
const { createVueForm, field } = await import("./dist/index.js");
const { MDY_CANONICAL_EMPTY, MDY_CANONICAL_FILLED, findPartElements } = await import("@modyra/widgets/testing");

/**
 * What a kind holds when it holds nothing, and when it holds something.
 *
 * Copies are handed out because a driver that returns the shared table lets this renderer mutate the
 * one every other adapter is compared against. A `File` is the one value that cannot be written down
 * centrally — two files with the same bytes are still two different values — so it is made here.
 */
const emptyFor = (kind) => {
  const empty = MDY_CANONICAL_EMPTY[kind];
  if (Array.isArray(empty)) return [...empty];
  if (empty && typeof empty === "object") return { ...empty };
  return empty;
};
const filledFor = (kind) => {
  if (kind === "file") return [new File(["content"], "report.txt", { type: "text/plain" })];
  const filled = MDY_CANONICAL_FILLED[kind];
  if (Array.isArray(filled)) return [...filled];
  if (filled && typeof filled === "object") return { ...filled };
  return filled;
};
const { MDY_WIDGET_CONTRACTS } = await import("@modyra/widgets");

export const name = "@modyra/vue";

/**
 * The kinds this adapter draws.
 *
 * A kind joins this list in the commit that makes it mountable, never before: a config naming a kind
 * it cannot mount reports a renderer that is broken rather than one that is unwritten, and those
 * need opposite work.
 */
export const kinds = ["text", "email", "password", "textarea", "number", "checkbox", "toggle", "slider", "file", "radio", "segmented", "select", "datepicker", "daterange", "timepicker", "colors", "multiselect"];

/** Which component draws a kind, read from the shape rather than from a list of names. */
const BOOLEAN = new Set(["checkbox", "toggle"]);
const GROUP = new Set(["radio", "segmented"]);
// The shape with a panel of ours. The other one is the platform's chooser, which this package does
// not draw, so it is not among the variants declared below.
const NEEDS_OPTIONS = new Set(["radio", "segmented", "select"]);
/** Two options, because a group with one cannot show a roving focus moving. */
const GROUP_OPTIONS = [{ value: "a", label: "First" }, { value: "b", label: "Second" }];

/**
 * Mounting one widget, ready for the kit to inspect.
 *
 * `root`, `parts`, `drive`, `settle` and `dispose` are owed. `drive` answers `false` for every state
 * this adapter cannot reach yet, which is the honest word for it: the kit skips what a renderer says
 * it cannot do and reports a state silently unreachable as conformance.
 */
/**
 * This config passes the kit's `rules` and `value` through to the field it builds, so the sections
 * that need them run instead of reporting themselves unestablished.
 */
export const declaresRules = true;

/**
 * This config also passes the kit's `config` — a document's declarations that are not rules.
 *
 * They arrive as props, which is how a document reaches a component here, and after the defaults
 * this file sets so a declared caption can replace the one it would otherwise draw.
 */
export const declaresConfig = true;

// Both shapes of the select are drawn here, so both are declared: the combobox this package builds
// and the platform's chooser it hands a non-filtering field to. A shape left off this list is one
// the suite never mounts — a defect in it stays green, which was measured rather than assumed.
export const variants = { select: ["native", "custom"], multiselect: ["single", "multi"] };

export const mount = async (kind, { rules, value, variant, config } = {}) => {
  if (!kinds.includes(kind)) {
    throw new Error(`@modyra/vue draws ${kinds.join(", ")} so far, and ${kind} is not among them.`);
  }
  const host = document.createElement("div");
  document.body.append(host);
  // The empty the kind declares, so the form starts where the contract says it starts rather than at
  // a string this file chose.
  const form = createVueForm({
    /**
     * A rule by default, because "invalid" is a state a field with no rules cannot be in.
     *
     * Without one, driving a field empty and touching it leaves it *correctly* valid, and the kit
     * reads `aria-invalid="false"` as a renderer that will not say it is wrong — a finding about a
     * fixture that never asked a question. The reference renderer's fixture defaults the same way,
     * and for the same reason.
     *
     * A slider is never empty, so `required` alone can never fail on one: its bound is what makes
     * the invalid row reachable rather than green-because-unreachable.
     */
    value: field(
      value === undefined ? MDY_CANONICAL_EMPTY[kind] : value,
      [],
      { rules: rules ?? (kind === "slider" ? { required: true, min: 1 } : { required: true }) },
    ),
  });
  const app = createApp({
    render: () => (kind === "multiselect"
      ? h(MdyMultiselectField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}),
          options: GROUP_OPTIONS, mode: variant === "multi" ? "multi" : "single" })
      : kind === "colors"
      ? h(MdyColorsField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}) })
      : kind === "timepicker"
      ? h(MdyTimepickerField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}) })
      : kind === "daterange"
      ? h(MdyDaterangeField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}) })
      : kind === "datepicker"
      ? h(MdyDatepickerField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}) })
      : kind === "select"
      ? h(MdySelectField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}), options: GROUP_OPTIONS,
          // `custom` is the shape that filters; asked for neither, the state matrix means the one
          // whose states it describes, which is the one with an `open`.
          searchable: variant === undefined || variant === "custom" })
      : GROUP.has(kind)
      ? h(MdyOptionField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}), kind, options: GROUP_OPTIONS })
      : kind === "file"
      ? h(MdyFileField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}) })
      : kind === "slider"
      ? h(MdySliderField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}) })
      : BOOLEAN.has(kind)
      ? h(MdyBooleanField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}), kind })
      : h(MdyTextField, { field: form.f.value, label: "Given", widgetId: `vue-${kind}`, ...(config ?? {}), kind })),
  });
  app.mount(host);

  const root = () => host.firstElementChild;
  return {
    root: root(),
    // Resolved from the catalogue, never from a selector this file chose. A map written by hand is a
    // map written for one kind: the first version named the text field's wrapper class and was right
    // for four kinds by resemblance, then reported a checkbox's wrapper as missing while it was on
    // the page. `findPartElements` is the same lookup the kit uses on itself.
    // Searched from the document, not from the host: a panel is drawn outside the field it belongs
    // to (ADR 0130), so parts inside it are not under the mount point. Scoped to the host, they read
    // as absent — and the kit, which knows a part may be portalled, was being handed nothing to
    // recognise.
    parts: () => Object.fromEntries(
      MDY_WIDGET_CONTRACTS[kind].structure.nodes
        .map((node) => [node.part, findPartElements(document.body, kind, node.part)])
        .filter(([, found]) => found.length > 0)
        .map(([part, found]) => [part, found.length === 1 ? found[0] : found]),
    ),
    // Nothing yet: the states the kit drives arrive with the units that make them reachable, and
    // saying so is what keeps a state nobody can reach out of the conformance count.
    // Only what this renderer can actually be put into. `open` is answered for the kind that draws
    // a panel; every other state is still `false`, which keeps a state nobody can reach out of the
    // conformance count rather than reporting it as met.
    /**
     * Put the widget in a state, or say plainly that this renderer cannot be.
     *
     * Read from the reference renderer's own fixture rather than invented: the same nine states,
     * reached the same way — the value through the handle, the refusals through the form, the
     * opening through the element the catalogue names as the opener. A driver that answers `false`
     * is not a neutral answer: the kit skips the pair, and the section that would have caught five
     * components rendering once and never again only works where it can drive.
     *
     * The canonical values come from the table every renderer is measured against, so "filled"
     * means the same thing here as it does there. A driver that handed every kind `""` would be
     * telling the truth for a text field and, for a daterange, putting a string where an object
     * belongs — a row green about a state the widget was never in.
     */
    /**
     * Put a value in the model, whatever a document's declaration would have done with it.
     *
     * Not the same door as `{ value }`: that one declares an initial value, and a declaration of the
     * wrong shape is refused with a warning — correctly. What the engine *holds* is what a form
     * writes into it, and a value of the wrong shape held there is a verdict the control has to stay
     * on the page to show.
     */
    hold: (value) => { form.f.value.set(value); },
    drive: (state) => {
      switch (state) {
        case "pristine": return true;
        case "empty": form.f.value.set(emptyFor(kind)); return true;
        case "filled": case "selected": form.f.value.set(filledFor(kind)); return true;
        case "touched": form.f.value.markAsTouched(); return true;
        case "invalid": form.f.value.set(emptyFor(kind)); form.f.value.markAsTouched(); return true;
        case "focused":
          (host.querySelector("input, textarea, select") ?? host.querySelector("button, [tabindex]"))?.focus?.();
          return true;
        case "disabled": form.setDisabled("value", () => true); return true;
        case "readonly": form.setReadonly("value", () => true); return true;
        case "open": break;
        // `loading` needs a remount with the flag, which this config does not offer: said as false
        // rather than as a silent true, so the report counts it among what nobody is checking.
        default: return false;
      }
      // The element that opens a panel is the button that says it opens one. More than one element
      // can carry `aria-expanded` — a datepicker's text control says so as well as the button
      // beside it — and pressing the one that is not a button does nothing at all, which would
      // hand the suite a shut widget and let it call the emptiness conformant.
      //
      // The press is not verified here because it cannot be: this runs before the renderer has
      // drawn the result, and the kit settles afterwards. What catches a press that did nothing is
      // the inspection that follows — a panel that never opened is reported as its required parts
      // missing, which is how the wrong element was found in the first place.
      const opener = host.querySelector("button[aria-expanded]") ?? host.querySelector("[aria-expanded]");
      if (opener === null) return false;
      opener.click();
      return true;
    },
    settle: async () => { await new Promise((resolve) => setTimeout(resolve, 0)); },
    dispose: () => { app.unmount(); host.remove(); },
    control: () => host.querySelector("input, textarea"),
    // The field's value, not the control's text. What a kind holds when it holds nothing is the
    // kind's own answer — a number field is empty at `null` and a text field at `""` — and reading
    // the DOM string reports `""` for both, which is right for one of them by accident.
    value: () => form.f.value.value(),
  };
};
