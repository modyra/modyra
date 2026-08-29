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
  comparableControllerOptions,
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
    "affordanceClasses",
    "bindingForIntent",
    "browserRuntimeCapabilities",
    "comparableControllerOptions",
    "createCommandRuntime",
    "createConsoleDiagnostics",
    "createMdyAnnouncer",
    "createSilentDiagnostics",
    "dialNumberAngle",
    "dynamicParts",
    "evaluateExpression",
    "expressionContextKeys",
    "expressionPaths",
    "factsOf",
    "inputWasRefused",
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
    "mergeFacts",
    "minutesOfDay",
    "optionNavigationIndex",
    "overlayCloseCommands",
    "overlayOnlyParts",
    "overlayStyleProperties",
    "partClasses",
    "partSelector",
    "partStates",
    "partsRequiringName",
    "popupAlignmentClass",
    "sameControllerOptions",
    "stableControllerOptions",
    "stateCarriers",
    "stateClass",
    "staticParts",
    "submitFalsePart",
    "timeFieldBounds",
    "timepickerDialNumbers",
    "timepickerDialTolerance",
    "timepickerPlaceholder",
    "timepickerTabOrder",
    "trailingAffordances",
    "transitionsFrom",
    "typeaheadMatch",
    "undoIsOnOffer",
    "validateExpression",
    "validateTimeGranularity",
    "viewIsActive",
    "widgetKeyIntent",
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
