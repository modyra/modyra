/**
 * Every kind, driven into the states where defects hide.
 *
 * A control at rest is the state a screenshot catches and the one nothing goes wrong in. What goes
 * wrong is the combination: failing *and* out of play, read-only *and* reachable, required *and*
 * untouched. Four toggles drive all seventeen kinds at once, because a rule that holds for the
 * datepicker and not the timepicker is exactly the shape this library keeps producing.
 */
import { createForm, field as mdyField, group as mdyGroup, required as mdyRequired } from "@modyra/core";
import { renderField } from "@modyra/plain";
import { KINDS } from "./kinds.js";
import {
  MDY_WIDGET_CONTRACTS,
  fieldAccessibleName,
  fieldIsRequired,
  focusIsInsideField,
  nameIsAFallback,
  partIsOwed,
  sliderTrack,
  valueIsAbsent,
  valueIsPresent,
} from "@modyra/widgets";
import { grid, paintedAsFailing, readoutPrinter, toggle, toolbar } from "./shell.js";

export const statesPanel = {
  id: "states",
  title: "Kind × state",
  blurb:
    "The seventeen kinds the catalogue declares, driven together. Every field is required, so `invalid` is a state the widget can actually be in — a field with no rule can never fail, and a panel that looks right about an unreachable state proves nothing.",
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
    "NO_CONSTRAINTS",
    "anchorOverlay",
    "applyOverlayProperties",
    "applyPart",
    "applySubmissionNames",
    "beginChipReorder",
    "bindLightDismiss",
    "blocksValueChange",
    "capabilityOf",
    "chipActionName",
    "chipFocusAfterRemoval",
    "chipMovedAnnouncement",
    "chipTooltipOffset",
    "chosenKeyOrder",
    "colorPresetsOf",
    "colorValueEquals",
    "createBooleanFieldController",
    "createColorsFieldController",
    "createCommandRuntime",
    "createDatepickerFieldController",
    "createDaterangeFieldController",
    "createFileFieldController",
    "createForm",
    "createLightDismiss",
    "createMdyAnnouncer",
    "createMultiselectFieldController",
    "createOptionFieldController",
    "createSelectFieldController",
    "createTextFieldController",
    "createTimepickerFieldController",
    "createTypeahead",
    "defaultOptionKey",
    "defaultWidgetIdFactory",
    "errorsVisible",
    "field",
    "fieldAccessibleName",
    "fieldCanBeInvalid",
    "fieldIsRequired",
    "fieldShellPartIds",
    "focusIsInsideField",
    "group",
    "groupSubmitName",
    "hiddenChipCount",
    "holdsUneditedValue",
    "inlineDirectionOf",
    "isOnStep",
    "keepFocusedChipInView",
    "mdyEmptyValueFor",
    "measureOverlayContent",
    "messagesForLocale",
    "multiselectAnnouncement",
    "multiselectChipClasses",
    "nameIsAFallback",
    "narrowConstraints",
    "observerFor",
    "overlayAnchoringFor",
    "overlayControlledId",
    "partIsOwed",
    "popupPlacementClass",
    "projectCalendarViewA11y",
    "projectFieldShellA11y",
    "projectOverlayOpenerA11y",
    "reactivityRunsEffects",
    "renderField",
    "required",
    "setOverlayOpen",
    "settledVoice",
    "shellStateClasses",
    "shownErrorsOf",
    "sliderFillRatio",
    "sliderTrack",
    "ssrRuntimeCapabilities",
    "stateClass",
    "syncOverlayBackdrop",
    "syncSubmitValues",
    "timeFieldBounds",
    "timeStepsAt",
    "timepickerDialNumbers",
    "timepickerEntryText",
    "timepickerPlaceholder",
    "timepickerSelectedDialValue",
    "timepickerSelectedRing",
    "trackAnchoredOverlay",
    "valueIsAbsent",
    "valueIsPresent",
    "viewportSize",
    "visibleErrorsOf",
    "wayBackActionName",
  ],

  invariant:
    "Out of play, no verdict. A field the form is not asking about shows no error class, no aria-invalid and no error text — and loses neither its value nor its errors, which return the moment it is back in play.",

  mount(work, readout) {
    const form = createForm({
      inPlay: mdyField(true),
      all: mdyGroup(
        Object.fromEntries(KINDS.map(([kind, empty]) => [kind, mdyField(empty, [mdyRequired()])])),
        { when: (_section, value) => value.inPlay === true },
      ),
    });

    const bar = toolbar(work);
    const area = grid(work);
    // Each renderer hands back its own teardown. Dropping it leaves an effect observing a form that
    // has been destroyed, which is silent until the next panel mounts and the console fills.
    const rendered = KINDS.map(([kind, , extra]) => {
      const cell = document.createElement("div");
      area.append(cell);
      return renderField(cell, { name: `all.${kind}`, kind, ...extra }, form.f.all[kind], form.reactivity);
    });

    // `setDisabled`/`setReadonly` take a predicate the form re-reads, so a toggle states the rule
    // rather than pushing a value once and leaving the form to disagree with the checkbox.
    toggle(bar, "Disabled", (on) => { for (const [kind] of KINDS) form.setDisabled(`all.${kind}`, () => on); });
    toggle(bar, "Read-only", (on) => { for (const [kind] of KINDS) form.setReadonly(`all.${kind}`, () => on); });
    toggle(bar, "Touched", (on) => { if (on) form.markAllTouched(); });
    toggle(bar, "Out of play", (on) => form.f.inPlay.set(!on));

    const print = readoutPrinter(readout, () => ({
      formValid: form.state.valid(),
      inPlay: form.f.inPlay.value(),
      submitted: Object.keys(form.submitValue()),
      // What the form still holds for a field it is not asking about: the errors are not forgotten,
      // they are not being shown to someone who cannot act on them.
      errorsHeld: KINDS.reduce((n, [kind]) => n + form.f.all[kind].errors().length, 0),
      partsPaintedAsFailing: paintedAsFailing(area),
      // Which field the keyboard is in, asked of the contract rather than of the document tree. A
      // panel drawn outside its field — to escape a scrolling ancestor — is still part of that
      // field, and the link that says so is the opener's `aria-controls`. Open a picker, put the
      // keyboard inside it, and the field named here is still the one that opened it.
      // Which optional parts the contract owes each kind right now — both halves of the question,
      // asked through the one door: a capability the page asked for before the widget existed, and a
      // state the widget is in. This panel asks for no capabilities, so a reorder grip is owed to
      // nothing here however many values a multiselect holds.
      partsOwed: KINDS
        .map(([kind]) => [kind, MDY_WIDGET_CONTRACTS[kind].structure.nodes.filter((node) => partIsOwed(node, {
          holds: (condition) => {
            const held = form.f.all[kind].value();
            if (condition === "valueIsPresent") return valueIsPresent(kind, held);
            if (condition === "valueIsAbsent") return valueIsAbsent(kind, held);
            if (condition === "fieldIsRequired") return fieldIsRequired(form.f.all[kind].required());
            // Every other condition is a state this panel does not drive, and answering it "yes"
            // would print an owing nobody can check.
            return false;
          },
          offers: () => false,
        }) && node.optional === true).map((node) => node.part)])
        .filter(([, parts]) => parts.length > 0)
        .map(([kind, parts]) => `${kind}: ${parts.join(", ")}`),
      focusIsInside: KINDS
        .map(([kind]) => kind)
        .filter((kind) => {
          const root = area.querySelector(`[data-mdy-field="${kind}"]`);
          return root !== null && focusIsInsideField(root, work.ownerDocument.activeElement);
        }),
      // The track a slider is drawn on, printed beside what the form holds. A slider spans something
      // whether or not a document declares a range, and the default is not a licence to
      // misrepresent: a value past it widens the track rather than moving the thumb somewhere the
      // form is not. The two numbers here have to agree.
      sliderHolds: form.f.all.slider.value(),
      sliderTrack: sliderTrack(form.f.all.slider.constraints(), form.f.all.slider.value()),
      // What names each control, and whether the name is one somebody wrote or the field's own. A
      // document may leave a label out, and a control with no name is announced as its role alone.
      namedByTheField: KINDS
        .filter(([, , extra]) => nameIsAFallback({ label: extra?.label }))
        .map(([kind]) => kind),
      // And the name each control ends up carrying — what a screen reader announces.
      controlNames: Object.fromEntries(
        KINDS.map(([kind, , extra]) => [kind, fieldAccessibleName({ label: extra?.label, name: kind })]),
      ),
    }));

    const effect = form.reactivity.effect(() => {
      form.state.valid();
      form.f.inPlay.value();
      for (const [kind] of KINDS) form.f.all[kind].errors();
      print();
    });

    return () => { effect.destroy(); print.cancel(); for (const d of rendered) d?.(); form.destroy(); };
  },
};
