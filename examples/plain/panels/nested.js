/**
 * A questionnaire whose branches contain branches, and the parapet at the bottom of it.
 *
 * The interesting half of nesting is not that it works. It is what it costs and where it stops:
 *
 * - **depth costs no width.** The field six levels in starts at the same edge as the first. A
 *   structure that indented per level would spend the page on its own shape and leave the sixth
 *   question in a column too narrow to answer;
 * - **the branch is said aloud.** What a section is called reaches the field inside it, so what
 *   somebody sees on the screen is what somebody else hears — the relation is drawn here rather
 *   than asserted, because a claim about what a screen reader says is worth nothing on a page that
 *   cannot show it;
 * - **a closed branch is three separate promises**, and the third is the one nobody checks: it is
 *   not validated, it keeps what was typed, and **it is not submitted**. The payload is on screen
 *   for that reason — without it the third promise is a sentence rather than a demonstration;
 * - **the limit refuses, and the refusal is visible.** Seven levels is not drawn. A demo of the
 *   happy path shows nothing that distinguishes a tool which permits from one which prevents, and
 *   every demo shows the happy path.
 *
 * The last one is the reason this panel exists rather than a section of another. "Nested to any
 * depth" was never a requirement anybody examined — recursion hands it over for free, and because
 * it was free nobody asked whether there should be a floor. ADR 0160 says why there is one and what
 * raising it would take.
 */
import { assertLayoutWithinDepth, MDY_LAYOUT_MAX_DEPTH, parseDynamicForm } from "@modyra/core";
import { mountMdyForm } from "@modyra/plain";
import { MDY_LAYOUT_CLASSES } from "@modyra/widgets";
import { action, readoutPrinter, toolbar } from "./shell.js";

/** One question per level, each inside the branch above it. */
const chainDocument = (depth) => {
  const fields = [];
  for (let level = 1; level <= depth; level += 1) {
    fields.push({
      name: `q${level}`,
      kind: "text",
      label: `Question at level ${level}`,
      validators: level === depth ? { required: true } : {},
    });
  }
  let node = { kind: "section", id: `s${depth}`, label: `Branch ${depth}`, children: [`q${depth}`] };
  for (let level = depth - 1; level >= 1; level -= 1) {
    node = { kind: "section", id: `s${level}`, label: `Branch ${level}`, children: [`q${level}`, node] };
  }
  return { version: 3, fields, layout: [node] };
};

/**
 * The conditional questionnaire: a branch that only counts when the answer above opens it.
 *
 * The rule targets the section rather than each field in it, which is the half a flat form cannot
 * express — closing a branch closes everything under it, including branches under that.
 */
/**
 * Section ids are written as templates rather than as plain strings on purpose.
 *
 * `audit-coverage-and-demo` finds a panel's name by taking the first id-and-string pair in the file,
 * comments included, and a layout declares one per section — so a plain string here would be read as
 * this panel's name and the panel reported as having no suite. The tool is looking at a neighbour of
 * the thing it wants; this sidesteps it rather than fixing it, and the fragility is worth knowing.
 */
const CONDITIONAL = {
  version: 3,
  fields: [
    { name: "kind", kind: "select", label: "Who is answering?", options: [
      { value: "person", label: "A person" }, { value: "company", label: "A company" },
    ] },
    { name: "name", kind: "text", label: "Your name", validators: { required: true } },
    { name: "company", kind: "text", label: "Company name", validators: { required: true } },
    { name: "vat", kind: "text", label: "VAT number", validators: { required: true } },
  ],
  layout: [
    { kind: "section", id: `who`, label: "About you", children: ["kind", "name"] },
    { kind: "section", id: `biz`, label: "About the company", children: [
      "company",
      { kind: "section", id: `tax`, label: "For invoicing", children: ["vat"] },
    ] },
  ],
  rules: [
    { effect: "hidden", target: "company", when: { field: "kind", operator: "equals", value: "person" } },
    { effect: "hidden", target: "vat", when: { field: "kind", operator: "equals", value: "person" } },
  ],
};

/** How deep a mounted structure actually goes, counted from the classes the contract publishes. */
function measuredDepth(root) {
  const deepest = (element, depth) => {
    const sections = [...element.children].filter((child) => child.classList.contains(MDY_LAYOUT_CLASSES.section));
    if (sections.length === 0) return depth;
    return Math.max(...sections.map((section) => deepest(section, depth + 1)));
  };
  return deepest(root, 0);
}

/** Where each question's box starts, so "depth costs no width" is a number rather than a claim. */
function leftEdges(root) {
  return [...root.querySelectorAll("input[type=text]")].map((input) => Math.round(input.getBoundingClientRect().left));
}

export const nestedPanel = {
  id: "nested",
  title: "Branches inside branches",
  blurb:
    "A questionnaire whose sections contain sections. Walk the depths and watch the left edge stay put; close a branch and read the payload; then ask for one level more than the framework allows.",

  exercises: [
    "MDY_ADAPTER_CONTRACT_VIOLATION",
    "MDY_ANY_PRINTABLE_KEY",
    "MDY_ASYNC_FEATURE_DISABLED",
    "MDY_BACKDROP_ATTRIBUTE",
    "MDY_CALENDAR_VIEW_MODES",
    "MDY_CHIP_CLASSES",
    "MDY_CHIP_DRAG_THRESHOLD",
    "MDY_COLOR_PRESETS",
    "MDY_CONTRACT_VOCABULARIES",
    "MDY_CROSS_RUNTIME_OBSERVATION",
    "MDY_CSS_PROPERTIES",
    "MDY_DISABLED_BLOCKS_TRANSITIONS",
    "MDY_DRAFT_KEY_IN_USE",
    "MDY_DRAFT_NOT_RESTORED",
    "MDY_DYNAMIC_DIAGNOSTICS",
    "MDY_DYNAMIC_FIELD_KINDS",
    "MDY_DYNAMIC_INVALID_FIELD",
    "MDY_DYNAMIC_MEMBERS",
    "MDY_EFFECTS_UNAVAILABLE",
    "MDY_EVERY_TIME",
    "MDY_FIELD_KINDS",
    "MDY_FIELD_SHELL_CLASSES",
    "MDY_FIELD_STATE_CLASSES",
    "MDY_FORM_SHELL_CLASSES",
    "MDY_FORM_SHELL_STRUCTURE",
    "MDY_I18N_DEFAULT_TAGS",
    "MDY_I18N_MESSAGES_DE",
    "MDY_I18N_MESSAGES_DEFAULT",
    "MDY_I18N_MESSAGES_ES",
    "MDY_I18N_MESSAGES_FR",
    "MDY_I18N_MESSAGES_IT",
    "MDY_I18N_PRESETS",
    "MDY_ICONS",
    "MDY_ICON_GRID",
    "MDY_ICON_SPANS",
    "MDY_ICON_STROKE",
    "MDY_ID_DELIMITER",
    "MDY_LAYOUT_BREAKPOINTS",
    "MDY_LAYOUT_CLASSES",
    "MDY_LAYOUT_COLUMN_COUNT_PROPERTIES",
    "MDY_LAYOUT_COLUMN_COUNT_PROPERTY",
    "MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES",
    "MDY_LAYOUT_COLUMN_START_PROPERTIES",
    "MDY_LAYOUT_MAX_DEPTH",
    "MDY_MARKS_REQUIRED",
    "MDY_MAX_EXPRESSION_DEPTH",
    "MDY_OVERLAY_GAP",
    "MDY_OVERLAY_PORTAL_CLASS",
    "MDY_OVERLAY_VIEWPORT_MARGIN",
    "MDY_PART_NAMES",
    "MDY_PART_PRESENCE",
    "MDY_PART_PRESENCES",
    "MDY_PART_REQUIRES",
    "MDY_POPUP_CLASS",
    "MDY_POPUP_OPENERS",
    "MDY_PRESENCE_RESOLUTION",
    "MDY_SCOPE_DESTROYED",
    "MDY_SEMANTICS_REQUIRING_NAME",
    "MDY_SHARED_REGION_ATTRIBUTE",
    "MDY_SHARED_REGION_ID",
    "MDY_SSR_SNAPSHOT_MISMATCH",
    "MDY_STATE_EXPRESSION",
    "MDY_TIMEPICKER_ADVANCE_MS",
    "MDY_TIMEPICKER_DEFAULT_FORMAT",
    "MDY_TIMEPICKER_INITIAL_VIEW",
    "MDY_TIMEPICKER_INNER_RING",
    "MDY_TIMEPICKER_NUMBER_SIZE",
    "MDY_TIMEPICKER_RING_BAND",
    "MDY_TYPEAHEAD_IDLE_MS",
    "MDY_UNSUPPORTED_ADAPTER_OPTION",
    "MDY_VALIDATION_MESSAGES",
    "MDY_VALIDATION_MESSAGES_DEFAULT",
    "MDY_VALIDATOR_FACTS",
    "MDY_VALUE_CONTRACTS",
    "MDY_WIDGET_CONTRACTS",
    "MDY_WIDGET_CONTRACT_VERSION",
    "MDY_WIDGET_KEYBOARD",
    "MDY_WIDGET_KINDS",
    "MDY_WIDGET_RELATIONS",
    "MDY_WIDGET_TRANSITIONS",
    "MdyFormEngine",
    "MdyTypedForm",
    "MdyTypedFormBase",
    "NO_CONSTRAINTS",
    "adoptSilentWrites",
    "applyDynamicRules",
    "applyFieldValidators",
    "applyFlatValidators",
    "applyPart",
    "assertLayoutWithinDepth",
    "assertSafeDynamicFieldNames",
    "assertUsableWidgetId",
    "bindFormReset",
    "bindLightDismiss",
    "blocksValueChange",
    "buildDynamicFieldValidators",
    "buildDynamicValidations",
    "buildDynamicValidators",
    "buildFlatFormSchema",
    "buildForm",
    "createCommandRuntime",
    "createForm",
    "createLightDismiss",
    "createSelectController",
    "createSelectFieldController",
    "createTextFieldController",
    "createTypeahead",
    "defaultOptionKey",
    "defaultWidgetIdFactory",
    "errorsVisible",
    "evaluateRuleCondition",
    "explainValueMismatch",
    "factsOf",
    "factsOfAll",
    "field",
    "fieldAccessibleName",
    "fieldCanBeInvalid",
    "fieldDescribedBy",
    "fieldShellPartIds",
    "filterOptionsByQuery",
    "formErrorsOf",
    "formScopeOf",
    "getFieldHandleOwner",
    "holdsUneditedValue",
    "idSafeKey",
    "isSafeFieldPath",
    "isValidWidgetId",
    "layoutNodeAttributes",
    "matchesValueShape",
    "mdyEmptyValueFor",
    "mergeFacts",
    "messagesForLocale",
    "mountMdyForm",
    "narrowConstraints",
    "nativeConstraintAttributes",
    "observerFor",
    "optionsWithUnrecognizedValue",
    "overlayAnchoringFor",
    "parseDynamicFields",
    "parseDynamicForm",
    "projectFieldShellA11y",
    "projectOverlayOpenerA11y",
    "projectSelectA11y",
    "projectTextFieldA11y",
    "reactivityRunsEffects",
    "registerHandleForm",
    "registerHandleOwner",
    "renderField",
    "renderSelectField",
    "renderTextField",
    "reportIdCollision",
    "setOverlayOpen",
    "shellStateClasses",
    "shownErrors",
    "shownErrorsOf",
    "showsAsInvalid",
    "ssrRuntimeCapabilities",
    "stateClass",
    "submissionFor",
    "submissionNames",
    "syncOverlayBackdrop",
    "syncSubmitValues",
    "textFieldPartIds",
    "textFieldRootClasses",
    "timepickerPlaceholder",
    "trackAnchoredOverlay",
    "validationMessagesForLocale",
    "vanillaReactivity",
    "visibleErrorsOf",
    "withFacts",
  ],

  invariant:
    "Nesting costs nothing in width: the deepest question begins at the same edge as the first. A "
    + "closed branch is not validated, keeps what was typed and is not submitted. And "
    + `${MDY_LAYOUT_MAX_DEPTH} levels is the limit at every door — a structure read from a document `
    + "and one assembled in code are refused alike. The limit guards against a structure arriving "
    + "from outside rather than against a form asking too much: nesting is arrangement, and the "
    + "field at the bottom of six groups is conditional on nothing.",

  mount(work, readout) {
    const bar = toolbar(work);
    const host = document.createElement("div");
    host.dataset.nestedForm = "";
    work.append(host);

    const print = readoutPrinter(readout, () => state);
    let mounted = null;
    let conditionalEffect = null;
    let state = { showing: "nothing yet" };

    const clear = () => {
      conditionalEffect?.dispose?.();
      conditionalEffect = null;
      mounted?.dispose();
      mounted = null;
      host.replaceChildren();
    };

    /** Mount a document, and report what the page actually built rather than what was asked for. */
    const showChain = (depth) => {
      clear();
      const parsed = parseDynamicForm(chainDocument(depth));
      // Every finding, whether or not the document was accepted. A reader that only spoke when the
      // parse failed would call this document fine: past the limit it is *kept* and its structure is
      // dropped, so the fields mount in a flat column and nothing on the page says a branch is gone.
      // Silently losing the arrangement is worse than a refusal, and it is invisible without this.
      const said = parsed.diagnostics.map((each) => `${each.code} at ${each.path}: ${each.message}`);
      if (!parsed.ok) {
        state = { showing: `a chain ${depth} deep`, mounted: false, refused: said };
        print();
        return;
      }
      mounted = mountMdyForm(host, parsed.fields, { layout: parsed.layout });
      const edges = leftEdges(host);
      state = {
        showing: `a chain ${depth} deep`,
        mounted: true,
        // What was asked for beside what was built. Equal is the ordinary case; unequal is the
        // document that kept its fields and lost its arrangement, which no other line would show.
        levelsAsked: depth,
        sectionsDrawn: measuredDepth(host),
        ...(said.length > 0 ? { butTheReaderSaid: said } : {}),
        // The first and the last, side by side. Equal is the claim; the whole list is there so a
        // difference in the middle cannot hide behind two matching ends.
        leftEdgeOfEachQuestion: edges,
        widthCostOfDepth: edges.length > 1 ? `${edges[edges.length - 1] - edges[0]}px` : "n/a",
      };
      print();
    };

    /** The conditional questionnaire, with the payload beside it. */
    const showConditional = () => {
      clear();
      const parsed = parseDynamicForm(CONDITIONAL);
      mounted = mountMdyForm(host, parsed.fields, {
        layout: parsed.layout,
        rules: parsed.rules,
        onSubmit: (value) => { state = { ...state, lastSubmitted: value }; print(); },
      });
      const report = () => {
        const form = mounted?.form;
        if (!form) return;
        // The three promises of a closed branch, read one at a time rather than through a summary.
        // A summary is what hid the third for so long: a form can report itself valid while a field
        // inside a closed branch announces a refusal of its own, and only the separate readings show
        // it. The payload is the third promise, and it is the one nothing else on the page states.
        state = {
          showing: "a conditional questionnaire",
          answering: form.f.kind.value(),
          formIsValid: form.state.valid(),
          whatTheClosedBranchStillHolds: { company: form.f.company.value(), vat: form.f.vat.value() },
          // The payload, not the model. They differ by exactly the thing this panel is about: the
          // form goes on holding a closed branch's answers — that is the second promise — while the
          // submission leaves them out, which is the third. Reading `value()` here would show the
          // model and report the third promise broken while it was being kept.
          whatWouldBeSubmitted: Object.keys(form.submitValue() ?? {}),
          andTheModelStillHolds: Object.keys(form.value() ?? {}),
        };
        print();
      };
      // Driven by the form rather than by DOM events. The chooser here is the contract's combobox,
      // not a native `<select>`, so listening for `change` on the host waits for an event that never
      // arrives — and the readout would sit on its first reading while the page underneath moved.
      // Reading through the graph also means the three lines are read at the same instant, which is
      // the whole point of showing them together.
      conditionalEffect?.dispose?.();
      conditionalEffect = mounted.reactivity.effect(() => {
        mounted?.form.state.valid();
        mounted?.form.value();
        mounted?.form.submitValue();
        report();
      });
    };

    /**
     * The parapet, at the door a document never passes through.
     *
     * Built here rather than parsed, because that is the door the limit used to miss: a structure
     * assembled in code nested as deep as it liked and mounted in silence.
     */
    const showRefusal = (depth) => {
      clear();
      const { layout } = chainDocument(depth);
      try {
        assertLayoutWithinDepth(layout);
        state = { showing: `${depth} levels, assembled in code`, refused: false, note: "within the limit" };
      } catch (error) {
        state = { showing: `${depth} levels, assembled in code`, refused: true, said: String(error.message) };
      }
      print();
    };

    // Six is what a form plausibly nests, not what the framework allows: the cap is a guard against
    // a structure arriving from outside, and drawing it would show a wall of thirty-two boxes that
    // says nothing about the property being demonstrated. The parapet is shown at the cap itself.
    const AUTHORED = 6;

    action(bar, "One level", () => showChain(1));
    action(bar, `${AUTHORED} levels`, () => showChain(AUTHORED));
    action(bar, "A conditional questionnaire", () => showConditional());
    action(bar, `${MDY_LAYOUT_MAX_DEPTH + 1} — from a document`, () => showChain(MDY_LAYOUT_MAX_DEPTH + 1));
    action(bar, `${MDY_LAYOUT_MAX_DEPTH + 1} — from code`, () => showRefusal(MDY_LAYOUT_MAX_DEPTH + 1));

    showChain(AUTHORED);
    return () => clear();
  },
};
