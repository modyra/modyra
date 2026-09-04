/**
 * A form declared as data, and what the parser says about it.
 *
 * The document arrives over a network, so it is parsed rather than trusted: an expression is data
 * and never code, a field name is a path and is checked as one, and everything the parser rejects
 * it says out loud. Paste something broken and read the diagnostics — that is the panel.
 */
import { MDY_DYNAMIC_DIAGNOSTICS, MDY_DYNAMIC_INVALID_FIELD, evaluateRuleCondition, parseDynamicForm } from "@modyra/core";
import { mountDynamicForm, mountMdyForm } from "@modyra/plain";
import { formErrorsOf, MDY_FORM_SHELL_CLASSES, MDY_FORM_SHELL_STRUCTURE, MDY_TIMEPICKER_DEFAULT_FORMAT, timepickerPlaceholder } from "@modyra/widgets";
import { action, readoutPrinter, toolbar } from "./shell.js";

const SAMPLE = {
  version: 2,
  fields: [
    { name: "email", kind: "email", label: "Email", validators: { required: true, email: true } },
    { name: "code", kind: "text", label: "Code", validators: { minLength: 2, maxLength: 8, pattern: "^[A-Z]+$" } },
    { name: "plan", kind: "select", label: "Plan", options: [
      { value: "free", label: "Free" }, { value: "pro", label: "Pro" },
    ] },
    { name: "starts", kind: "datepicker", label: "Starts" },
    // The pair is the point: the same kind, one opening on the face and one on the number boxes,
    // because a document names the view rather than the renderer choosing it. The second also spells
    // out the two defaults the contract owns, so what a field gets when it says nothing is visible
    // beside a field that says something.
    { name: "meets", kind: "timepicker", label: "Meets" },
    {
      name: "shiftEnds",
      kind: "timepicker",
      label: "Shift ends",
      viewMode: "input",
      format: MDY_TIMEPICKER_DEFAULT_FORMAT,
      placeholder: timepickerPlaceholder(MDY_TIMEPICKER_DEFAULT_FORMAT),
    },
    { name: "seats", kind: "number", label: "Seats" },
  ],
  // What the document says the form does, not only what it holds. Change the plan and watch the
  // seat count leave the page and the payload with it: a rule is a binding on the form, so what it
  // decides reaches what is sent and not only what is drawn.
  rules: [
    { effect: "visible", target: "seats", when: { field: "plan", operator: "equals", value: "pro" } },
  ],
};

/** Documents that must be refused, and the reason each one is refused for. */
const BROKEN = {
  "a kind nobody declared": { version: 2, fields: [{ name: "a", kind: "wormhole", label: "A" }] },
  "a view a picker does not have": { version: 2, fields: [{ name: "a", kind: "timepicker", label: "A", viewMode: "sundial" }] },
  "a name that is not a path": { version: 2, fields: [{ name: "__proto__", kind: "text", label: "A" }] },
  "a pattern that is not one": { version: 2, fields: [{ name: "a", kind: "text", validators: { pattern: "(" } }] },
  "options that are not options": { version: 2, fields: [{ name: "a", kind: "select", options: "free,pro" }] },
};

export const dynamicPanel = {
  id: "dynamic",
  title: "Declared as data",
  blurb:
    "Edit the document and render it. The buttons paste documents that must be refused; each one should produce a diagnostic that names what is wrong and where, and no form at all.",
  /**
   * The public names this panel drives.
   *
   * Declared rather than inferred: `audit-coverage-and-demo` used to search the demo sources for
   * a name, which counted an import line as a demonstration and made almost everything look
   * covered. What a panel exercises is a claim its own browser test checks.
   */
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
    "mountDynamicForm",
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
    "acceptTimeField",
    "adoptSilentWrites",
    "anchorOverlay",
    "applyAnchoredOverlay",
    "applyDynamicRules",
    "applyFieldValidators",
    "applyFlatValidators",
    "applyOverlayProperties",
    "applyPart",
    "applySubmissionNames",
    "assertLayoutWithinDepth",
    "assertSafeDynamicFieldNames",
    "assertUsableWidgetId",
    "bindFormReset",
    "bindLightDismiss",
    "blocksFocus",
    "blocksValueChange",
    "buildDynamicFieldValidators",
    "buildDynamicValidations",
    "buildDynamicValidators",
    "buildFlatFormSchema",
    "buildForm",
    "calendarDayId",
    "calendarKeyboardTarget",
    "calendarViewOnToggle",
    "calendarViewOnZoom",
    "MDY_ARIA_DISABLED_PARTS",
    "capabilityOf",
    "clearAnchoredOverlay",
    "createCommandRuntime",
    "createDatepickerFieldController",
    "createForm",
    "createLightDismiss",
    "createMdyAnnouncer",
    "createSelectController",
    "createSelectFieldController",
    "createTextFieldController",
    "createTimepickerFieldController",
    "createTypeahead",
    "datepickerFieldPartIds",
    "datepickerFieldRootClasses",
    "decideOverlayAlignment",
    "decideOverlayPlacement",
    "bindDismissOnFocusOutside",
    "defaultOptionKey",
    "defaultWidgetIdFactory",
    "dialRingOf",
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
    "fieldShellRootClasses",
    "filterOptionsByQuery",
    "focusIsInsideField",
    "formErrorsOf",
    "getFieldHandleOwner",
    "holdsUneditedValue",
    "idSafeKey",
    "inlineDirectionOf",
    "isOnStep",
    "isPrimaryInteraction",
    "isSafeFieldPath",
    "isTypeaheadCharacter",
    "isValidWidgetId",
    "keepKeyboardInPlay",
    "keyBindingFor",
    "keyMeans",
    "listboxNextIndex",
    "matchesKeyGesture",
    "matchesValueShape",
    "mdyEmptyValueFor",
    "measureOverlayContent",
    "mergeFacts",
    "messagesForLocale",
    "mountMdyForm",
    "narrowConstraints",
    "nativeConstraintAttributes",
    "observerFor",
    "optionsWithUnrecognizedValue",
    "overlayAnchoringFor",
    "overlayBranchContains",
    "overlayControlledId",
    "parseDynamicFields",
    "parseDynamicForm",
    "partClasses",
    "popupPlacementClass",
    "portalRootFor",
    "processWidgetCommands",
    "projectCalendarPeriodCellA11y",
    "projectCalendarViewA11y",
    "projectDatepickerFieldA11y",
    "projectFieldShellA11y",
    "projectOverlayOpenerA11y",
    "projectSelectA11y",
    "projectTextFieldA11y",
    "projectTimepickerFieldA11y",
    "reactivityRunsEffects",
    "registerHandleForm",
    "registerHandleOwner",
    "renderDatepickerField",
    "renderField",
    "renderSelectField",
    "renderTextField",
    "renderTimepickerField",
    "reportIdCollision",
    "selectKeyboardAction",
    "setOverlayOpen",
    "shellStateClasses",
    "shownErrors",
    "shownErrorsOf",
    "showsAsInvalid",
    "ssrRuntimeCapabilities",
    "stabilizeOverlayPlacement",
    "staysOpen",
    "stateClass",
    "stepTimeField",
    "submissionNames",
    "syncOverlayBackdrop",
    "syncSubmitValues",
    "textFieldPartIds",
    "textFieldRootClasses",
    "timeFieldBounds",
    "timeStepsAt",
    "timepickerDialNumbers",
    "timepickerEntry",
    "timepickerEntryText",
    "timepickerFieldPartIds",
    "timepickerFieldRootClasses",
    "timepickerFocusPart",
    "timepickerPlaceholder",
    "timepickerSegmentAria",
    "timepickerSelectedDialValue",
    "timepickerSelectedRing",
    "trackAnchoredOverlay",
    "validationMessagesForLocale",
    "vanillaReactivity",
    "viewportSize",
    "visibleErrorsOf",
    "withFacts",
  ],

  invariant:
    "Expressions are data, never code. Nothing in this document is evaluated, a field name is validated as a path before it becomes one, and a document the parser rejects mounts nothing rather than mounting partly.",

  mount(work, readout) {
    const bar = toolbar(work);
    const editor = document.createElement("textarea");
    editor.dataset.dynamicSource = "";
    editor.rows = 14;
    editor.style.cssText = "width:100%;font:12px ui-monospace,monospace;margin-bottom:1rem";
    editor.value = JSON.stringify(SAMPLE, null, 2);
    work.append(editor);

    const formHost = document.createElement("div");
    formHost.dataset.dynamicForm = "";
    work.append(formHost);

    let mounted = null;
    let lastResult = { ok: false, reason: "not rendered yet" };

    const render = () => {
      mounted?.dispose();
      mounted = null;
      formHost.replaceChildren();

      let document_;
      try { document_ = JSON.parse(editor.value); }
      catch (error) { lastResult = { ok: false, reason: "not valid JSON", detail: String(error.message) }; return print(); }

      const parsed = parseDynamicForm(document_);
      lastResult = {
        ok: parsed.ok,
        version: parsed.version,
        fields: parsed.fields.map((f) => `${f.name}: ${f.kind}`),
        diagnostics: parsed.diagnostics.map((d) => `${d.severity} ${d.code} at ${d.path} — ${d.message}`),
        // Each rule's condition against the form's current value: the same answer the binding uses,
        // asked directly, so what a rule is doing is readable rather than inferred from what moved.
        rules: parsed.rules.map((rule) => {
          const holds = evaluateRuleCondition(rule.when, mounted ? mounted.form.getValue() : {});
          return `${rule.effect} ${rule.target} when ${rule.when.field} ${rule.when.operator} ${JSON.stringify(rule.when.value)} → ${holds}`;
        }),
      };
      // A document the parser refused mounts nothing. Rendering "the part that parsed" is how a
      // rejected document becomes a form somebody fills in.
      //
      // **`ok` is the right question here, and the nested panel's opposite answer is not a
      // disagreement.** `ok` answers *was anything lost*: a rule written on the field instead of
      // beside it leaves every field standing and drops the constraint, so the form that would be
      // drawn is looser than the one that was written. This is an editor — somebody types a document
      // and gets a form back — and handing back a form that is not what was typed is the failure this
      // panel would cause. The nested panel reads what survives instead, because showing the fields
      // arriving without their arrangement is the thing it exists to demonstrate. Same flag, two
      // purposes, and neither should be edited to match the other.
      if (parsed.ok && parsed.fields.length > 0) {
        mounted = mountMdyForm(formHost, parsed.fields, {
          idPrefix: "dyn",
          layout: parsed.layout,
          // Passed, because a form built without them behaves as though the array were empty.
          rules: parsed.rules,
        });
      }
      print();
    };

    action(bar, "Render", render);
    for (const [label, document_] of Object.entries(BROKEN)) {
      action(bar, label, () => { editor.value = JSON.stringify(document_, null, 2); render(); });
    }
    action(bar, "Back to a good one", () => { editor.value = JSON.stringify(SAMPLE, null, 2); render(); });
    // A refusal that names no field. A failed call, a service that is down, a rule only a server can
    // check: the engine keeps it, and `mdy-form__errors` is where a person reads it — above the
    // fields, because a summary below a long form is one nobody scrolls to.
    action(bar, "The service is down", () => {
      void mounted?.form.submit(async () => [{ path: null, message: "The service is unavailable. Nothing was saved." }]);
      print();
    });

    // Every refusal the parser has a name for, listed where a reader can compare it against what
    // the document above actually produced. A code is what a consumer matches on; the sentence
    // beside it is prose and may be reworded.
    const legend = document.createElement("details");
    legend.innerHTML = `<summary>What this parser can refuse (${MDY_DYNAMIC_DIAGNOSTICS.length} named, plus ${MDY_DYNAMIC_INVALID_FIELD})</summary>`;
    const list = document.createElement("ul");
    for (const { code, phrase } of MDY_DYNAMIC_DIAGNOSTICS) {
      const item = document.createElement("li");
      item.textContent = `${code} — recognised by "${phrase}"`;
      list.append(item);
    }
    legend.append(list);
    work.append(legend);

    const print = readoutPrinter(readout, () => ({
      ...lastResult,
      controlsMounted: formHost.querySelectorAll(".mdy-renderer").length,
      // **Why nothing was drawn, when something parsed.** `fields` and `controlsMounted` disagreeing
      // is the whole answer for a document that keeps its fields and loses a constraint, and two
      // numbers side by side do not say that they are meant to disagree — a reader can take `fields`
      // for what was built. `ok` answers *was anything lost*, so a rule written on the field instead
      // of beside it makes it false while every field arrives: the form that would be drawn is
      // looser than the one that was written, which is exactly when a lab must not hand one over.
      whyNothingMounted: lastResult.ok === false && (lastResult.fields?.length ?? 0) > 0
        ? "the parse kept these fields and lost something else, so what would be drawn is not what was written"
        : null,
      // What the form has to say about itself, and where it says it. The two are printed together
      // because a refusal the engine holds and the page does not show is the failure this region
      // exists for: a person pressed the button, the answer was no, and nothing appeared.
      formRefusals: mounted
        ? formErrorsOf(mounted.form.state.lastSubmitErrors()).map((error) => error.message)
        : [],
      refusalsOnScreen: formHost.querySelectorAll(`.${MDY_FORM_SHELL_CLASSES.formErrorItem}`).length,
      // The part name, printed because it is what a renderer outside this repository writes against:
      // `MdyFormShellPart` is the closed vocabulary, and the class is derived from it rather than
      // spelled.
      regionPart: /** @type {import("@modyra/widgets").MdyFormShellPart} */ (MDY_FORM_SHELL_STRUCTURE.nodes[0].part),
    }));

    render();

    // ── The same contract, served by a different language ───────────────────────────────────────
    //
    // The document above is typed into the page. This one is built by a Rust process from its own
    // business objects and handed over as contract JSON — which is the claim worth showing: the
    // form is defined by the backend and drawn by whichever renderer is on the page.
    //
    // It is parsed strictly before it is mounted. A document arriving over a network is data from
    // somewhere else even when the somewhere else is ours, and the panel's own opening line says
    // so about the editor above.
    const served = document.createElement("section");
    served.dataset.servedByRust = "";
    served.style.cssText = "margin-top:2rem;padding-top:1rem;border-top:1px solid var(--mdy-sys-color-outline,#ccc)";
    const servedHeading = document.createElement("h3");
    servedHeading.textContent = "Checkout, served by the Rust API";
    served.append(servedHeading);
    const servedNote = document.createElement("p");
    servedNote.style.cssText = "margin:.25rem 0 1rem;font-size:.9em";
    served.append(servedNote);
    const servedHost = document.createElement("div");
    servedHost.dataset.servedForm = "";
    served.append(servedHost);
    work.append(served);

    let servedMount = null;
    const loadServed = async () => {
      servedMount?.dispose();
      servedMount = null;
      servedHost.replaceChildren();
      servedNote.textContent = "asking the API…";

      let payload;
      try {
        const response = await fetch("http://127.0.0.1:3000/v1/forms/checkout", {
          signal: AbortSignal.timeout(4000),
        });
        if (!response.ok) throw new Error(`the API answered ${response.status}`);
        payload = await response.json();
      } catch (error) {
        // An absence that says what it is and how to end it. A blank space here would read as a
        // renderer that failed, which is the wrong thing to go and debug.
        servedNote.textContent =
          `The form API is not answering (${error.message}). Start it with: `
          + "cargo run -p modyra-axum-form-server-example — or run this demo with npm run demo:plain, "
          + "which starts it for you.";
        return;
      }

      // Parsed strictly, its rules applied, and mounted — in one act. The three-step version is
      // what this door removes: forget `applyDynamicRules` in the middle and the form still mounts,
      // with every condition the document declared inert and the page looking obeyed.
      try {
        const verdict = parseDynamicForm(payload, { mode: "strict" });
        servedNote.textContent =
          `Contract v${verdict.version}, ${verdict.fields.length} fields, built in Rust and drawn here.`;
        servedMount = mountDynamicForm(servedHost, payload, { submitLabel: "Place order" });
      } catch (refusal) {
        servedNote.textContent =
          "The API served a document this reader refuses — which is the check doing its job, not a "
          + `network problem: ${refusal.message}`;
      }
    };

    void loadServed();
    action(bar, "Reload from the API", loadServed);

    return () => { mounted?.dispose(); servedMount?.dispose(); print.cancel(); };
  },
};
