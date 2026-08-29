/**
 * What the form does to a value it did not like.
 *
 * The client's checks are defence in depth — the server is the authority — and what they are for is
 * the value that arrives from somewhere nobody controls: a draft written by another script on the
 * origin, a server response, a paste. Every interception is reported rather than performed quietly,
 * because a value silently changed under a person is a bug they cannot see.
 */
import { createForm, field as mdyField } from "@modyra/core";
import { renderField } from "@modyra/plain";
import { MDY_I18N_DEFAULT_TAGS, MDY_I18N_PRESETS, messagesForLocale } from "@modyra/widgets";
import { action, grid, readoutPrinter, toolbar } from "./shell.js";

const MARKUP = '<img src=x onerror="alert(1)">Hello <b>there</b>';
const LONG = "x".repeat(300);

const FIELDS = [
  { name: "bio", kind: "textarea", label: "Bio (strict: no < > or quotes)" },
  { name: "nickname", kind: "text", label: "Nickname (capped at 24)" },
  // Kinds that actually say something: a calendar and a clock carry most of the words a widget owns.
  { name: "when", kind: "datepicker", label: "When" },
  { name: "at", kind: "timepicker", label: "At" },
  { name: "upload", kind: "file", label: "Attachment" },
];

export const securityPanel = {
  id: "security",
  title: "Security and i18n",
  blurb:
    "Paste markup or press the buttons. The policy here is `strict`, which removes the characters markup is made of; `text` is the milder profile and removes only what is invisible. Every interception appears in the readout with what it did and why.",
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
    "bindLightDismiss",
    "calendarDayId",
    "calendarViewOnToggle",
    "capabilityOf",
    "createCommandRuntime",
    "createDatepickerFieldController",
    "createFileFieldController",
    "createForm",
    "createLightDismiss",
    "createMdyAnnouncer",
    "createTextFieldController",
    "createTimepickerFieldController",
    "defaultWidgetIdFactory",
    "field",
    "fieldAccessibleName",
    "fieldCanBeInvalid",
    "inlineDirectionOf",
    "isOnStep",
    "mdyEmptyValueFor",
    "measureOverlayContent",
    "messagesForLocale",
    "observerFor",
    "overlayAnchoringFor",
    "overlayControlledId",
    "partClasses",
    "popupPlacementClass",
    "projectCalendarPeriodCellA11y",
    "projectCalendarViewA11y",
    "projectFieldShellA11y",
    "reactivityRunsEffects",
    "renderField",
    "setOverlayOpen",
    "shellStateClasses",
    "shownErrorsOf",
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
    "viewportSize",
    "visibleErrorsOf",
  ],

  invariant:
    "The words a widget shows come from the contract's tables, so five renderers cannot answer in five Englishes — and a locale a table does not carry falls back to English rather than to blanks. A widget does not repair the model. Sanitizing happens at the boundary where a value enters the form, once, and it is reported — not applied again by each renderer and not applied silently.",

  mount(work, readout) {
    const violations = [];
    const form = createForm(
      { bio: mdyField(""), nickname: mdyField(""), when: mdyField(null), at: mdyField(null), upload: mdyField(null) },
      {
        security: {
          sanitize: "strict",
          maxValueLength: 24,
          onViolation: (violation) => { violations.push(violation); print(); },
        },
        // The platform's own storage, handed over as it is: the guide names `localStorage` as the
        // default, so this is the object a reader reaches for when they want their own key. It
        // speaks `getItem`/`setItem`/`removeItem` — `MdyWebStorageLike` — and the draft option takes
        // either that or this package's `{read, write, remove}`.
        ...(typeof localStorage !== "undefined"
          ? { draft: { key: "modyra-lab-draft", storage: localStorage, exclude: ["bio"] } }
          : {}),
      },
    );

    const bar = toolbar(work);
    const area = grid(work);

    // The words are re-read, not re-decided: switching locale re-renders the same fields with a
    // different table, which is the whole of what a host has to do.
    let locale = "en-US";
    let dispose = [];
    const draw = () => {
      for (const d of dispose) d?.();
      area.replaceChildren();
      const messages = messagesForLocale(locale);
      dispose = FIELDS.map((f) => renderField(area, f, form.f[f.name], form.reactivity, f.name, messages));
    };
    draw();

    for (const [code, tag] of Object.entries(MDY_I18N_DEFAULT_TAGS)) {
      action(bar, code.toUpperCase(), () => { locale = tag; draw(); print(); });
    }
    // A locale no table carries: English, and visibly so, because a missing translation must not
    // render as an empty button.
    action(bar, "PT", () => { locale = "pt-BR"; draw(); print(); });

    action(bar, "Paste markup", () => form.f.bio.set(MARKUP));
    action(bar, "Paste 300 characters", () => form.f.nickname.set(LONG));
    // A draft is storage another script on this origin can write to. Restoring one whose shape does
    // not match the schema is refused rather than merged, which is the structural half of the policy
    // and is on whether or not sanitizing is.
    action(bar, "Forge the stored draft", () => {
      try { localStorage.setItem("modyra-lab-draft", JSON.stringify({ value: { notAField: 1 } })); } catch { /* storage may be unavailable */ }
      print();
    });
    action(bar, "Clear the report", () => { violations.length = 0; print(); });

    const print = readoutPrinter(readout, () => ({
      value: form.getValue(),
      lengths: Object.fromEntries(FIELDS.map((f) => [f.name, String(form.f[f.name].value() ?? "").length])),
      violations: violations.map((v) => `${v.kind} at ${v.path ?? "(form)"} — ${v.detail}`),
      // What reached the DOM. The point of sanitizing at the boundary is that no renderer has to be
      // trusted to do it, so this is the number that proves it happened upstream.
      elementsInjected: area.querySelectorAll("img, script, b").length,
      locale,
      // Read off the page, not off the table: this is the number that says the words arrived.
      wordsOnScreen: {
        openTheClock: area.querySelector(".mdy-timepicker__toggle")?.getAttribute("aria-label") ?? "",
        openTheCalendar: area.querySelector(".mdy-datepicker__toggle")?.getAttribute("aria-label") ?? "",
        chooseAFile: area.querySelector(".mdy-file-content .mdy-button")?.textContent ?? "",
      },
      translated: MDY_I18N_PRESETS[locale.split("-")[0]] !== undefined,
    }));

    const effect = form.reactivity.effect(() => {
      for (const f of FIELDS) form.f[f.name].value();
      print();
    });

    return () => { effect.destroy(); print.cancel(); for (const d of dispose) d?.(); form.destroy(); };
  },
};
