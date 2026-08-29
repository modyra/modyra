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
import { MDY_FIELD_KINDS } from "@modyra/core";
import {
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
    "MDY_FIELD_KINDS",
    "dynamicParts",
    "isFullyServerRenderable",
    "isWidgetKind",
    "kindsWithAffordances",
    "overlayOnlyParts",
    "partsRequiringName",
    "staticParts",
    "stateCarriers",
    "trailingAffordances",
    "transitionsFrom",
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
      kindsWithAnAffordance: kindsWithAffordances(),
    }));

    print();
    return undefined;
  },
};
