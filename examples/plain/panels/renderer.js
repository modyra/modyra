/**
 * What a renderer has to know about a kind, asked of the contract rather than read from a source.
 *
 * A fourth renderer is built against these answers: which parts it must always draw, which exist only
 * while a panel is open, which of them owe a name, what sits at the field's trailing edge, which state
 * classes the kind wears, what a phase's transitions are, and whether the whole thing can be rendered
 * on a server. Every one of those is a published question with a published answer, and until this page
 * existed the only way to see what they say was to read the package.
 *
 * **It answers, it does not assert.** The panel shows what the contract returns for the kind a person
 * picks; whether a renderer *obeys* those answers is the browser suite's question and not this page's.
 * The value here is that somebody writing an adapter can see the whole shape at once, for any kind,
 * without a build.
 */
import {
  isContextRef,
  isExpression,
  isPathRef,
  isRootRef,
  isSelfRef,
  composeFirst,
  completeRange,
  createForm,
  draftShapeMatches,
  field as mdyField,
  handleFormOf,
  MdyActivationError,
  MdyAdapterContractError,
  MdyCrossRuntimeObservationError,
  MdyDestroyedScopeError,
  MdyUnsupportedCapabilityError,
  valueShape,
  createConsoleDiagnostics,
  eachOneOf,
  evaluateExpression,
  expressionContextKeys,
  expressionPaths,
  integer,
  max,
  min,
  oneOf,
  validateExpression,
  createSilentDiagnostics,
  MDY_FIELD_KINDS,
} from "@modyra/core";
import {
  affordanceClasses,
  browserRuntimeCapabilities,
  dialNumberAngle,
  dynamicParts,
  isFullyServerRenderable,
  isWidgetKind,
  kindsWithAffordances,
  overlayOnlyParts,
  partsRequiringName,
  staticParts,
  stateCarriers,
  trailingAffordances,
  transitionsFrom,
  optionNavigationIndex,
  overlayCloseCommands,
  overlayStyleProperties,
  popupAlignmentClass,
  timepickerDialNumbers,
  bindingForIntent,
  calendarViewAfterPick,
  createCatalogWidgetController,
  dialHandLength,
  focusWhenShown,
  openPlatformChooser,
  stepOutOfOverlay,
  timeInputTransition,
  timepickerDialGhost,
  timepickerDialKeyIntent,
  chipDropIndex,
  fieldCommandHandlers,
  MDY_I18N_MESSAGES_DEFAULT,
  timepickerPartSelector,
  widgetKeyGuide,
  widgetScopeOf,
  chipStripWheelDelta,
  closeOverlay,
  focusTrigger,
  openOverlay,
  restoreFocusTrigger,
  scrollOptionIntoView,
  submissionDefects,
  timepickerDialPick,
  timepickerDialUnavailableArcs,
  timepickerTabTarget,
  clearFileSelection,
  comparableControllerOptions,
  createFocusCustodian,
  createPointerDrag,
  dateDraftTransition,
  dateRangeDraftTransition,
  dragPointOf,
  elementByDataKey,
  fileSelectionTransition,
  reconcileSelectValue,
  shouldCloseMultiselectOverlay,
  timeDraftTransition,
  inputWasRefused,
  layoutSlotStyle,
  minutesOfDay,
  partSelector,
  partStates,
  sameControllerOptions,
  stableControllerOptions,
  submitFalsePart,
  undoIsOnOffer,
  viewIsActive,
  widgetKeyIntent,
  workIsInFlight,
  timepickerDialTolerance,
  timepickerTabOrder,
  typeaheadMatch,
  validateTimeGranularity,
  widgetStateClasses,
} from "@modyra/widgets";

import { action, readoutPrinter, toolbar } from "./shell.js";

/** The states a kind can be asked to carry, named by the contract's own vocabulary. */
const STATES = ["disabled", "error", "readonly", "open", "touched"];

export const rendererPanel = {
  id: "renderer",
  title: "Renderer",

  /** The public names this panel drives. */
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
    "MdyActivationError",
    "MdyAdapterContractError",
    "MdyCrossRuntimeObservationError",
    "MdyDestroyedScopeError",
    "MdyFormEngine",
    "MdyTypedForm",
    "MdyTypedFormBase",
    "MdyUnsupportedCapabilityError",
    "NO_CONSTRAINTS",
    "affordanceClasses",
    "bindingForIntent",
    "browserRuntimeCapabilities",
    "calendarViewAfterPick",
    "chipDropIndex",
    "chipStripWheelDelta",
    "clearFileSelection",
    "closeOverlay",
    "comparableControllerOptions",
    "completeRange",
    "composeFirst",
    "createCatalogWidgetController",
    "createCommandRuntime",
    "createConsoleDiagnostics",
    "createFocusCustodian",
    "createForm",
    "createMdyAnnouncer",
    "createPointerDrag",
    "createSilentDiagnostics",
    "dateDraftTransition",
    "dateRangeDraftTransition",
    "defaultWidgetIdFactory",
    "dialHandLength",
    "dialNumberAngle",
    "draftShapeMatches",
    "dragPointOf",
    "dynamicParts",
    "eachOneOf",
    "elementByDataKey",
    "evaluateExpression",
    "expressionContextKeys",
    "expressionPaths",
    "factsOf",
    "field",
    "fieldCommandHandlers",
    "fileSelectionTransition",
    "focusTrigger",
    "focusWhenShown",
    "formScopeOf",
    "handleFormOf",
    "inputWasRefused",
    "integer",
    "isContextRef",
    "isExpression",
    "isFullyServerRenderable",
    "isOnStep",
    "isPathRef",
    "isRootRef",
    "isSafeFieldPath",
    "isSelfRef",
    "isWidgetKind",
    "keyBindingFor",
    "kindsWithAffordances",
    "layoutSlotStyle",
    "max",
    "mergeFacts",
    "min",
    "minutesOfDay",
    "oneOf",
    "openOverlay",
    "openPlatformChooser",
    "optionNavigationIndex",
    "overlayCloseCommands",
    "overlayOnlyParts",
    "overlayStyleProperties",
    "partClasses",
    "partSelector",
    "partStates",
    "partsRequiringName",
    "popupAlignmentClass",
    "reconcileSelectValue",
    "registerHandleForm",
    "registerHandleOwner",
    "restoreFocusTrigger",
    "sameControllerOptions",
    "scrollOptionIntoView",
    "shouldCloseMultiselectOverlay",
    "ssrRuntimeCapabilities",
    "stableControllerOptions",
    "stateCarriers",
    "stateClass",
    "staticParts",
    "stepOutOfOverlay",
    "stepTimeField",
    "submissionDefects",
    "submitFalsePart",
    "timeDraftTransition",
    "timeFieldBounds",
    "timeInputTransition",
    "timepickerDialGhost",
    "timepickerDialKeyIntent",
    "timepickerDialNumbers",
    "timepickerDialPick",
    "timepickerDialTolerance",
    "timepickerDialUnavailableArcs",
    "timepickerPartSelector",
    "timepickerPlaceholder",
    "timepickerTabOrder",
    "timepickerTabTarget",
    "trailingAffordances",
    "transitionsFrom",
    "typeaheadMatch",
    "undoIsOnOffer",
    "validateExpression",
    "validateTimeGranularity",
    "valueShape",
    "vanillaReactivity",
    "viewIsActive",
    "widgetKeyGuide",
    "widgetKeyIntent",
    "widgetScopeOf",
    "widgetStateClasses",
    "withFacts",
    "workIsInFlight",
  ],

  invariant:
    "Everything a renderer needs about a kind is a published question. A page that has to read the "
    + "package to find out what to draw is a page whose author is guessing.",

  mount(work, readout) {
    const bar = toolbar(work);
    let kind = "select";
    // One field, so the questions a handle answers have a handle to be asked of.
    const aHandle = createForm({ example: mdyField("") }).f.example;

    // Three doors that act on the page rather than answer about it, so each is behind a command: a
    // demonstration that fires on load is a page doing things to somebody who only opened it.
    action(bar, "step out", () => stepOutOfOverlay(work, () => undefined));
    action(bar, "focus when shown", () => focusWhenShown(() => work.querySelector("button")));
    action(bar, "platform chooser", () => openPlatformChooser(work.querySelector("input")));

    // One command per kind rather than a chooser, so the page states its own alphabet: a reader sees
    // every kind the catalogue has without opening anything.
    for (const one of MDY_FIELD_KINDS) {
      action(bar, one, () => { kind = one; print(); });
    }

    const print = readoutPrinter(readout, () => ({
      kind,
      isAKind: isWidgetKind(kind),
      // What must be there whatever state the field is in, and what only exists while it is open.
      always: staticParts(kind),
      whileOpen: overlayOnlyParts(kind),
      changing: dynamicParts(kind),
      // The parts a reader is owed a name for, and what sits at the field's inline end.
      owedAName: partsRequiringName(kind),
      atTheEdge: trailingAffordances(kind).map((one) => `${one.part}:${one.role}`),
      // Which part carries each state — the answer a renderer needs to put a class in the right place.
      carriedBy: Object.fromEntries(STATES.map((state) => [state, stateCarriers(kind, state)])),
      stateClasses: widgetStateClasses(kind),
      // What a press or a key does in each phase, which is the whole of the keyboard contract.
      whenClosed: transitionsFrom(kind, "closed").map((one) => `${one.trigger?.key ?? one.trigger?.part ?? "?"}→${one.to}`),
      whenOpen: transitionsFrom(kind, "open").map((one) => `${one.trigger?.key ?? one.trigger?.part ?? "?"}→${one.to}`),
      serverRenderable: isFullyServerRenderable(kind),
      // What this runtime can do, asked rather than assumed: a renderer that guesses at the platform
      // is a renderer that breaks on the one where the guess is wrong.
      runtime: browserRuntimeCapabilities(),
      diagnosticsDoors: [typeof createConsoleDiagnostics().warn, typeof createSilentDiagnostics().warn],
      // How a rule written in a document names what it is about — the four kinds of reference an
      // expression can hold, told apart by the package rather than by reading the object's shape.
      // The arithmetic a renderer does not have to invent: where a panel goes once its anchor has been
      // measured, where a hand points, which option an arrow lands on, how close a finger has to be.
      arithmetic: {
        panelAt: overlayStyleProperties({ top: 10, left: 20, width: 100, height: 40, placement: "below", alignment: "start" }),
        alignmentClass: popupAlignmentClass(isWidgetKind(kind) ? kind : "select", "start"),
        onClose: overlayCloseCommands(true).map((one) => one.type),
        handAt: dialNumberAngle(timepickerDialNumbers("24h")[1]),
        withinAFinger: Math.round(timepickerDialTolerance("outer", 100)),
        arrowLandsOn: optionNavigationIndex("End", 0, 5),
        granularityProblems: validateTimeGranularity({ hour: 1, minute: 5 }).length,
      },
      // The rules a document may put on a value, asked what they say about three of them. A validator
      // is a function from a value to a complaint or to nothing, so calling one is using it.
      rules: (() => {
        const between = composeFirst(integer(), min(3), max(9));
        const say = (rule, value) => (rule(value) === null ? "accepted" : "refused");
        return {
          threeToNine: [2, 5, 12].map((one) => `${one}:${say(between, one)}`),
          fromTheList: ["a", "z"].map((one) => `${one}:${say(oneOf(["a", "b"]), one)}`),
          everyOneFromTheList: [["a"], ["a", "z"]].map((one) => `${one.join("+")}:${say(eachOneOf(["a", "b"]), one)}`),
        };
      })(),
      // A rule written in a document, read by the three doors that read one: what it is about, what
      // it needs from the surroundings, whether it is well formed, and what it answers today.
      rule: {
        wellFormed: validateExpression({ op: "and", operands: [{ path: "total" }, true] }).length === 0,
        malformed: validateExpression({ op: "gt", operands: [{ path: "total" }, 1] }),
        about: expressionPaths({ op: "and", operands: [{ path: "total" }, true] }),
        needs: expressionContextKeys({ op: "and", operands: [{ context: "locale" }, true] }),
        answersToday: evaluateExpression({ op: "and", operands: [{ path: "total" }, true] }, { total: true }),
      },
      // Three more a renderer asks and nothing else answers.
      indicatorClasses: affordanceClasses("indicator"),
      clockTabOrder: timepickerTabOrder("24h"),
      hiddenFalse: submitFalsePart(kind) === undefined ? "none" : "declared",
      halfPastTen: minutesOfDay("10:30"),
      typedAl: typeaheadMatch([{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }], "al", 0)?.label ?? "no match",
      // A part, a key and a moment: the three things a renderer asks about while it is drawing, each
      // answered by the package rather than worked out from the markup it happens to have produced.
      aPart: {
        states: partStates(kind, staticParts(kind)[1] ?? "root"),
        selector: partSelector(kind, staticParts(kind)[1] ?? "root"),
        slotStyle: layoutSlotStyle({ span: 2 }),
      },
      aKey: {
        whatEnterMeans: widgetKeyIntent(kind, "Enter", false),
        whichBindingOpens: bindingForIntent(kind, "open", "closed"),
      },
      aMoment: {
        undoOnOffer: undoIsOnOffer({ removed: null }),
        working: workIsInFlight({ submitting: false }),
        viewShowing: viewIsActive("days", "days"),
        refused: inputWasRefused({ refused: [] }),
      },
      // Whether two mounts are the same mount, which is what decides a rebuild from a re-render.
      sameOptions: sameControllerOptions(
        comparableControllerOptions({ widgetId: "a" }),
        stableControllerOptions({ widgetId: "a" }),
      ),
      // What an act turns into. Each of these is a pure step from a state and something a person did
      // to the state that follows — the part a renderer does not write itself, and the reason two
      // renderers agree about what a half-made choice means.
      acts: {
        aTimeTakenAsADraft: Object.keys(timeDraftTransition({ draft: null }, "10:30").state),
        aDayTakenAsADraft: Object.keys(dateDraftTransition({ draft: null }, "2026-03-12", {}, {}).state),
        aRangeBegun: Object.keys(dateRangeDraftTransition({ start: null, end: null }, "2026-03-12").state),
        filesOffered: Object.keys(fileSelectionTransition([], [])),
        filesCleared: Object.keys(clearFileSelection()),
        aPressOutside: shouldCloseMultiselectOverlay({ open: true }, "outside"),
        aChoiceNoLongerOffered: reconcileSelectValue("a", [{ value: "a", label: "A" }]),
        aWheelOnTheStrip: chipStripWheelDelta(10, 0, 100, 50),
        wherePressed: dragPointOf({ clientX: 5, clientY: 6 }),
        dragDoor: typeof createPointerDrag({}),
        focusDoor: typeof createFocusCustodian({}),
        // Found by what it is, not by where it sits: a renderer that walks its own tree to find a
        // part has hard-coded the shape it happens to draw today.
        foundByKey: elementByDataKey(work, "panel", "renderer") === null ? "absent" : "found",
      },
      // The commands a renderer is handed rather than the code it writes: a widget says what it wants
      // done and something else does it, which is what lets one contract drive three renderers and a
      // fourth nobody has written.
      commands: [
        openOverlay(kind),
        closeOverlay(kind),
        focusTrigger(kind),
        restoreFocusTrigger(kind),
        scrollOptionIntoView(kind, 0),
      ].map((one) => one.type),
      // The clock face and the calendar, asked what a press lands on and where a view goes next.
      face: {
        atThirtyDegrees: timepickerDialPick(30, { ring: "outer" }),
        unreachableArcs: timepickerDialUnavailableArcs("24h").length,
        tabLandsOn: timepickerTabTarget("24h", 0),
        afterPickingAMonth: calendarViewAfterPick("months"),
      },
      // Whether a kept draft still fits the form it was kept for, and what a submission is refused
      // for — two questions a page asks before it trusts what it holds.
      draftStillFits: draftShapeMatches({ a: 1 }, { a: 1 }),
      submissionRefusedFor: submissionDefects({}).length,
      // Two more rules a document may put on a value, and the one sentence that says how a control is
      // operated — derived from the key table rather than written beside it, so it cannot go stale.
      moreRules: {
        rangeMustBeWhole: typeof completeRange("both ends"),
        valueMustBeShaped: typeof valueShape("text"),
      },
      howItIsOperated: widgetKeyGuide(kind, MDY_I18N_MESSAGES_DEFAULT),
      // What a handle knows about where it lives, and what a widget may ask of it. A renderer holds
      // one of these and nothing else, so what it can reach through it is the whole of its reach.
      throughAHandle: {
        itsForm: handleFormOf(aHandle) === undefined ? "none" : "found",
        itsScope: typeof widgetScopeOf(aHandle),
        whatAWidgetMayAsk: Object.keys(fieldCommandHandlers(aHandle)).slice(0, 4),
      },
      // Where a dragged chip would land, and the selector for a segment of the clock.
      chipWouldLandAt: chipDropIndex([0, 20, 40], 25, 0),
      clockSegment: timepickerPartSelector("hourControl"),
      // What the library throws, and what each refusal is called. A consumer catching one wants to
      // know the name before it happens, not after.
      refusals: [
        new MdyActivationError("a widget was used before it was activated").name,
        new MdyAdapterContractError("plain", "an adapter answered for a door it does not have").name,
        new MdyCrossRuntimeObservationError("a", "b").name,
        new MdyDestroyedScopeError("a scope answered after it was destroyed").name,
        new MdyUnsupportedCapabilityError("select", "a capability this kind does not offer").name,
      ],
      // The clock, asked what a key means on its face and where a half-made pick would show.
      clock: {
        typed: timeInputTransition("10:30", (value) => value),
        arrowUpOnTheHour: timepickerDialKeyIntent("ArrowUp", "hour", "24h", 10),
        ghostAtThirty: timepickerDialGhost(30, { value: 5, angle: 30, ring: "outer" }) === null ? "none" : "shown",
        handLength: Math.round(dialHandLength(work)),
      },
      // A controller with no field behind it — the shape an adapter wraps.
      catalogController: typeof createCatalogWidgetController(kind),
      references: {
        path: isPathRef({ path: "total" }),
        root: isRootRef({ root: "total" }),
        self: isSelfRef({ self: true }),
        context: isContextRef({ context: "locale" }),
        anExpression: isExpression({ op: ">", operands: [{ path: "total" }, 10] }),
      },
      kindsWithAnAffordance: kindsWithAffordances(),
    }));

    print();
    return undefined;
  },
};
