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
  createConsoleDiagnostics,
  createSilentDiagnostics,
  MDY_FIELD_KINDS,
} from "@modyra/core";
import {
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
  timepickerDialTolerance,
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
    "browserRuntimeCapabilities",
    "createCommandRuntime",
    "createConsoleDiagnostics",
    "createMdyAnnouncer",
    "createSilentDiagnostics",
    "dialNumberAngle",
    "dynamicParts",
    "isContextRef",
    "isExpression",
    "isFullyServerRenderable",
    "isOnStep",
    "isPathRef",
    "isRootRef",
    "isSelfRef",
    "isWidgetKind",
    "kindsWithAffordances",
    "optionNavigationIndex",
    "overlayCloseCommands",
    "overlayOnlyParts",
    "overlayStyleProperties",
    "partsRequiringName",
    "popupAlignmentClass",
    "stateCarriers",
    "stateClass",
    "staticParts",
    "timeFieldBounds",
    "timepickerDialNumbers",
    "timepickerDialTolerance",
    "timepickerPlaceholder",
    "trailingAffordances",
    "transitionsFrom",
    "validateTimeGranularity",
    "widgetStateClasses",
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
