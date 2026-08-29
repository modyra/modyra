/**
 * What a form remembers, and when it stops.
 *
 * A draft survives the page; undo and redo walk the values the form has held; deactivating stops
 * the effects that write both. The last one is what a framework adapter needs and a demo rarely
 * shows: a form whose host has gone away must stop saving, and must pick up again on return.
 */
import { createForm, field as mdyField, required as mdyRequired } from "@modyra/core";
import { renderField } from "@modyra/plain";
import { adoptSilentWrites, bindFormReset, submissionFor, submissionNames } from "@modyra/widgets";
import { action, grid, readoutPrinter, toolbar } from "./shell.js";

const FIELDS = [
  { name: "title", kind: "text", label: "Title" },
  { name: "notes", kind: "textarea", label: "Notes" },
  { name: "secret", kind: "password", label: "Secret (kept out of the draft)" },
];

export const lifecyclePanel = {
  id: "lifecycle",
  title: "Lifecycle",
  blurb:
    "Type something, reload the page, and it is still here. Undo walks back through what you typed. Deactivate and the autosave stops — reload then, and the draft is whatever it was when the form went quiet.",
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
    "applyPart",
    "assertUsableWidgetId",
    "bindFormReset",
    "blocksValueChange",
    "createCommandRuntime",
    "createForm",
    "createTextFieldController",
    "defaultWidgetIdFactory",
    "errorsVisible",
    "factsOf",
    "factsOfAll",
    "field",
    "fieldAccessibleName",
    "fieldCanBeInvalid",
    "fieldDescribedBy",
    "fieldShellPartIds",
    "getFieldHandleOwner",
    "holdsUneditedValue",
    "isSafeFieldPath",
    "isValidWidgetId",
    "mdyEmptyValueFor",
    "mergeFacts",
    "messagesForLocale",
    "narrowConstraints",
    "nativeConstraintAttributes",
    "observerFor",
    "projectFieldShellA11y",
    "projectTextFieldA11y",
    "reactivityRunsEffects",
    "registerHandleForm",
    "registerHandleOwner",
    "renderField",
    "renderTextField",
    "required",
    "shellStateClasses",
    "shownErrors",
    "showsAsInvalid",
    "ssrRuntimeCapabilities",
    "submissionFor",
    "submissionNames",
    "textFieldPartIds",
    "textFieldRootClasses",
    "timepickerPlaceholder",
    "vanillaReactivity",
    "visibleErrorsOf",
    "withFacts",
  ],

  invariant:
    "A draft is the form's value and nothing else. `exclude` keeps a field out of storage entirely, and an error-free submit clears the draft rather than leaving a stale copy to be restored over a fresh form.",

  mount(work, readout) {
    const form = createForm(
      {
        title: mdyField("", [mdyRequired()]),
        notes: mdyField(""),
        secret: mdyField(""),
      },
      {
        history: { maxEntries: 50 },
        draft: { key: "modyra-lab-draft", exclude: ["secret"], debounceMs: 150 },
      },
    );

    const bar = toolbar(work);

    /**
     * A real `<form>` around the fields, with the Cancel button a consumer actually writes.
     *
     * `type="reset"` is elementary HTML and the browser answers it by returning each control to its
     * `value` *attribute* — which this renderer never writes, since it keeps the box in step with
     * the model. Unbound, Cancel emptied the boxes and left the value the form would send untouched:
     * what a person saw stopped being what they submitted. `bindFormReset` is what closes that.
     */
    const enclosing = document.createElement("form");
    enclosing.noValidate = true;
    enclosing.addEventListener("submit", (event) => { event.preventDefault(); });
    work.append(enclosing);

    const area = grid(enclosing);
    const dispose = FIELDS.map((f) => renderField(area, f, form.f[f.name], form.reactivity));

    const cancel = document.createElement("button");
    cancel.type = "reset";
    cancel.textContent = "Cancel (the browser's own reset)";
    cancel.dataset.action = cancel.textContent;
    enclosing.append(cancel);

    const unbindReset = bindFormReset({ element: cancel, reset: () => form.reset() });

    /**
     * Values written into the boxes by something that never says so, told to the model.
     *
     * Type something, follow a link away, and press Back: one browser puts the typing straight into
     * the boxes and tells nobody, so the field showed what was written while the form still held
     * what it was built with. Autofill does the same at a different moment. Reading one value and
     * submitting another is the state this closes.
     *
     * `renderField` already does this for a form it mounts. It is here explicitly because the panel
     * builds its own form, and because a reader should see what the call looks like.
     */
    const stopAdopting = adoptSilentWrites({ root: enclosing });

    action(bar, "Undo", () => form.undo());
    action(bar, "Redo", () => form.redo());
    action(bar, "Reset", () => form.reset());
    action(bar, "Deactivate", () => form.deactivate());
    action(bar, "Activate", () => form.activate());
    action(bar, "Clear the draft", () => form.clearDraft());
    // Three writes, one entry: what a person did once should undo once.
    action(bar, "Three writes, one undo step", () =>
      form.mutate(() => {
        form.f.title.set("A title");
        form.f.notes.set("Some notes");
        form.f.secret.set("not stored");
      }));
    action(bar, "Submit", () => form.submit(() => {}));

    const print = readoutPrinter(readout, () => ({
      value: form.getValue(),
      changes: form.getChanges(),
      canUndo: form.canUndo(),
      canRedo: form.canRedo(),
      hasDraft: form.hasDraft(),
      // Read from storage rather than from the form: whether `secret` is excluded is a claim about
      // what was written, and the form would answer about what it holds.
      stored: readStoredDraft(),
      formValid: form.state.valid(),
      // What a native submit would send, beside what the form holds. The two are the same question
      // asked of two different owners, and the panel exists to show where they disagree.
      submits: Object.fromEntries(FIELDS.map((f) => [
        f.name,
        { shape: submissionFor(f.kind).form, keys: Object.values(submissionNames(f.kind, f.name)) },
      ])),
      sent: new URLSearchParams(new FormData(enclosing)).toString(),
    }));

    /**
     * The draft is written after a pause, so the readout is printed twice: once for what the form
     * holds now, and once after the pause for what reached storage. A single print would show the
     * form's new value beside the *previous* draft and read as though `exclude` had failed.
     */
    let afterTheWrite = null;
    const effect = form.reactivity.effect(() => {
      form.state.valid();
      form.canUndo();
      form.canRedo();
      form.hasDraft();
      for (const f of FIELDS) form.f[f.name].value();
      print();
      clearTimeout(afterTheWrite);
      afterTheWrite = setTimeout(print, 250);
    });

    return () => { effect.destroy(); clearTimeout(afterTheWrite); print.cancel(); unbindReset(); stopAdopting(); for (const d of dispose) d?.(); form.destroy(); };
  },
};

/** The field names that actually reached storage — the claim `exclude` makes is about this, not about the form. */
function readStoredDraft() {
  try {
    const raw = localStorage.getItem("modyra-lab-draft");
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    const value = parsed && typeof parsed === "object" && "value" in parsed ? parsed.value : parsed;
    return value && typeof value === "object" ? Object.keys(value) : [];
  } catch {
    return "unreadable";
  }
}
