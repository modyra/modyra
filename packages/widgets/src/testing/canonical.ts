/**
 * What a widget looks like, said in a way no renderer can influence.
 *
 * Milestone C asks whether three renderers given the same schema, the same initial state and the
 * same actions produce the same observation. Comparing markup would answer a different question:
 * `outerHTML` equality promotes every wrapper and every attribute order into public API, and would
 * make the adapters equal by forbidding them to differ at all.
 *
 * So the comparison runs over this reduction instead. Two rules keep it honest:
 *
 * - **Nothing here may know which adapter it is looking at.** Parts are found by the classes the
 *   contract gives them, never by an adapter's own selectors. A snapshot that needed to be told
 *   would not be canonical, and the suite built on it would be three suites.
 * - **No ids.** Every adapter generates its own, so a relationship is recorded as the *part* an
 *   attribute lands on. That an id matches is an implementation detail; that the label points at the
 *   control is the contract.
 */
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "../catalog.js";
import { MDY_WIDGET_RELATIONS } from "../relations.js";
import { MDY_FIELD_STATE_CLASSES } from "../structure.js";
import { MDY_SEMANTIC_ELEMENTS } from "./dom-tests.js";
import { portalRootFor } from "../portal.js";

/** One part, as the contract can describe it without naming a framework. */
export interface MdyCanonicalPart {
  readonly part: string;
  /** The semantic the contract declares for it. */
  readonly element: string;
  /** Its role, explicit or implicit. `null` when it carries none. */
  readonly role: string | null;
  /** How many of it are on screen. A repeated part may have several; anything else must have one. */
  readonly count: number;
}

/** One reference, resolved to the part it names rather than to an id. */
export interface MdyCanonicalRelationship {
  readonly from: string;
  readonly attribute: string;
  /** The part the reference resolves to, or `null` when it resolves to nothing. */
  readonly to: string | null;
}

/** Whether the widget's overlay exists, and if so whether it is showing. */
export type MdyCanonicalOverlay = "absent" | "closed" | "open";

/**
 * A `focusOwner` expectation meaning "some part of this widget, and the contract does not say which".
 *
 * The difference between a requirement and an over-specification: after an overlay closes, focus
 * landing on the document body is always wrong, and which part catches it is the renderer's design.
 */
export const MDY_FOCUS_WITHIN = "somewhere in the widget";

export interface MdyCanonicalSnapshot {
  readonly kind: string;
  readonly parts: readonly MdyCanonicalPart[];
  readonly relationships: readonly MdyCanonicalRelationship[];
  /** The field states the root reflects, in the contract's own vocabulary. */
  readonly state: readonly string[];
  /** The value the form holds. Supplied by the caller: it is not a fact about the DOM. */
  readonly value: unknown;
  /** The part that owns focus, or `null` when focus is outside the widget. */
  readonly focusOwner: string | null;
  readonly overlay: MdyCanonicalOverlay;
}

export interface MdyCanonicalOptions {
  /** The value the form holds for this field. */
  readonly value?: unknown;
  /**
   * Where a portalled popup went, when it is not inside the root.
   *
   * An adapter may lift its overlay to the document, which is a legitimate choice the contract does
   * not constrain — but a snapshot that could not see it would report every portalled popup as
   * absent and call two identical widgets different.
   */
  readonly portalRoots?: readonly Element[];
}

/**
 * Whether an element is part of what the user observes.
 *
 * A renderer may mount its overlay eagerly and hide it, or build it on open; the contract leaves that
 * free, and a snapshot counting hidden elements as present would report the two strategies as a
 * difference in the widget itself.
 *
 * Only `hidden` excludes. `aria-hidden` does not: it means "do not announce this", not "do not render
 * it" — a select's arrow is decorative and unannounced, and it is still on screen and still part of
 * the anatomy two renderers have to agree on.
 */
function isObservable(element: Element, root: Element): boolean {
  for (let cursor: Element | null = element; cursor; cursor = cursor.parentElement) {
    if ((cursor as HTMLElement).hidden) return false;
    if (cursor === root) break;
  }
  return true;
}

/** Whether an element sits inside this widget's own popup while that popup is shut. */
function insideClosedOverlay(element: Element, root: Element): boolean {
  for (let cursor: Element | null = element; cursor && cursor !== root; cursor = cursor.parentElement) {
    if (cursor.classList.contains("mdy-popup")) return true;
  }
  return false;
}

/** A selector for the tags and roles a semantic admits, for parts the contract gives no class. */
function semanticSelector(element: string | undefined): string {
  const allowed = element ? MDY_SEMANTIC_ELEMENTS[element] : undefined;
  if (!allowed) return "";
  return [...allowed.tags, ...allowed.roles.map((role) => `[role="${role}"]`)].join(", ");
}

function escapeClass(value: string): string {
  return value.replace(/[^\w-]/g, (character) => `\\${character}`);
}

/** The role an element has from its tag alone, before any `role` attribute. */
function implicitRole(element: Element): string | null {
  const tag = element.tagName.toLowerCase();
  if (tag === "button") return "button";
  if (tag === "table") return "table";
  if (tag === "tr") return "row";
  if (tag === "th") return "columnheader";
  if (tag === "td") return "gridcell";
  if (tag === "option") return "option";
  if (tag !== "input") return null;
  const type = (element.getAttribute("type") ?? "text").toLowerCase();
  if (type === "checkbox") return "checkbox";
  if (type === "radio") return "radio";
  if (type === "range") return "slider";
  return null;
}

/**
 * Reduces a mounted widget to what the contract can say about it.
 *
 * The root is the element the adapter mounted; everything else is found from the catalogue.
 */
export function canonicalWidgetSnapshot(
  root: Element,
  kind: MdyWidgetKind,
  options: MdyCanonicalOptions = {},
): MdyCanonicalSnapshot {
  const definition = MDY_WIDGET_CONTRACTS[kind];

  /**
   * A portalled overlay, found the way the contract says to find it: the opener names it.
   *
   * Scanning the document for something popup-shaped would pick up a *neighbour's* overlay whenever
   * more than one widget is mounted, and report its parts as this one's. The relation is the only
   * thing that says which panel belongs to which field.
   */
  const ownPortal = (): readonly Element[] => {
    if (options.portalRoots) return options.portalRoots;
    const portal = portalRootFor(root);
    return portal ? [portal] : [];
  };


  /**
   * Whether the overlay is showing, taken from the relation rather than from the DOM's own hiding.
   *
   * Renderers hide a closed panel differently — one sets `hidden`, another leaves it attached with
   * `visibility: hidden`, a third detaches it — and only the first is visible to a DOM inspection
   * without layout. `aria-expanded` on the opener is the contract's own statement of open-ness and
   * the one signal every renderer carries, so it is what decides here.
   */
  const openerElement = (): Element | null => {
    const opener = MDY_POPUP_OPENERS[kind]?.opener;
    if (!opener) return null;
    const classes = definition.parts[opener as keyof typeof definition.parts]?.classes ?? [];
    if (!classes.length) return null;
    const selector = classes.map((className: string) => `.${escapeClass(className)}`).join("");
    return root.matches?.(selector) ? root : root.querySelector(selector);
  };
  const isOpen = definition.capabilities.overlay
    ? openerElement()?.getAttribute("aria-expanded") === "true"
    : false;

  // A closed overlay is not observed, however its renderer chose to hide it.
  const scopes: readonly Element[] = isOpen ? [root, ...ownPortal()] : [root];

  const nodeFor = new Map(definition.structure.nodes.map((node) => [node.part as string, node]));

  const find = (part: string): readonly Element[] => {
    if (part === "root") return [root];
    const classes = definition.parts[part as keyof typeof definition.parts]?.classes ?? [];
    // A part with no class of its own is still on screen — the free-text kinds' `control` is the
    // bare `<input>`. Falling back to the semantic is what keeps the most important part of a text
    // field in the observation rather than silently absent, and it stays renderer-blind: the tags and
    // roles come from the contract's own table.
    const selector = classes.length
      ? classes.map((className: string) => `.${escapeClass(className)}`).join("")
      : semanticSelector(nodeFor.get(part)?.element);
    if (!selector) return [];
    const found: Element[] = [];
    for (const scope of scopes) {
      if (scope !== root && scope.matches?.(selector)) found.push(scope);
      found.push(...Array.from(scope.querySelectorAll(selector)));
    }
    return found.filter(
      (element) => isObservable(element, root) && (isOpen || !insideClosedOverlay(element, root)),
    );
  };

  const resolved = new Map<string, readonly Element[]>();
  for (const node of definition.structure.nodes) resolved.set(node.part, find(node.part));

  const parts: MdyCanonicalPart[] = [];
  for (const node of definition.structure.nodes) {
    const elements = resolved.get(node.part) ?? [];
    if (elements.length === 0) continue;
    parts.push({
      part: node.part,
      element: node.element,
      role: elements[0]!.getAttribute("role") ?? implicitRole(elements[0]!),
      count: elements.length,
    });
  }

  /**
   * Which part an element belongs to, so a reference can be reported without its id.
   *
   * The *most specific* part, not the first that happens to contain it. Parts nest — a trigger sits
   * inside an input wrapper — so answering with any container would report `label[for]` as naming
   * the wrapper on every kind, and two renderers pointing at different elements would look alike.
   */
  const partOf = (element: Element): string | null => {
    // A reference landing on something the user cannot observe resolves to nothing. Climbing to an
    // ancestor that *is* observable would report an eagerly-mounted hidden popup as "the wrapper",
    // while a renderer that had not built it yet reports nothing — the same widget, two answers.
    if (!isObservable(element, root) || (!isOpen && insideClosedOverlay(element, root))) return null;
    let best: { part: string; depth: number } | null = null;
    for (const [part, elements] of resolved) {
      if (part === "root") continue;
      for (const candidate of elements) {
        if (candidate === element) return part;
        if (!candidate.contains(element)) continue;
        // Deeper containers are more specific: count the steps from the element up to this one.
        let depth = 0;
        for (let cursor = element.parentElement; cursor && cursor !== candidate; cursor = cursor.parentElement) depth += 1;
        if (!best || depth < best.depth) best = { part, depth };
      }
    }
    if (best) return best.part;
    // Not "root": a reference landing on something that is not an observable part resolves to
    // nothing, and saying it reached the widget at all would make an eagerly-mounted hidden panel
    // look like a target while a lazily-built one looks like a dangling id.
    return element === root ? "root" : null;
  };

  const document_ = root.ownerDocument;
  const relationships: MdyCanonicalRelationship[] = [];
  for (const relation of MDY_WIDGET_RELATIONS[kind]) {
    const carrier = (resolved.get(relation.from) ?? [])[0];
    if (!carrier) continue;
    const reference = carrier.getAttribute(relation.attribute);
    const named = reference
      ? reference.split(/\s+/).filter(Boolean).map((id) => document_?.getElementById(id)).find(Boolean)
      : undefined;
    relationships.push({
      from: relation.from,
      attribute: relation.attribute,
      to: named ? partOf(named) : null,
    });
  }

  // Each state read from the most universal signal it has, not from one place.
  //
  // A class is the only expression of `touched`, so that one is read from the root. `disabled` and
  // `invalid` are not: a checkbox, a toggle and a file field carry no `--disabled` class at all —
  // they are natively disabled, and a theme styles `:disabled` — while a radio and a slider put a
  // modifier on their wrapper. Reading either state from classes reported half the catalogue as
  // having no state, and reading it from the native and ARIA attributes reports every kind alike.
  const S = MDY_FIELD_STATE_CLASSES;
  const rootClasses = new Set(root.getAttribute("class")?.split(/\s+/).filter(Boolean) ?? []);

  /**
   * The elements a state can be expressed on: whatever the kind uses to take input.
   *
   * `hexInput` is here because a colour field's accessible control is not the one named `control`.
   * That part is the native picker — unfocusable in two renderers — while the text input beside it
   * is what the label names and what the user types in. Leaving it out reported a renderer that
   * exposes its state on the element a user actually reaches as exposing no state at all.
   */
  const operable: readonly Element[] = ["control", "startControl", "endControl", "trigger", "group", "toggle", "hexInput"]
    .flatMap((part) => [...(resolved.get(part) ?? [])]);
  const anyOperable = (test: (element: Element) => boolean): boolean => operable.some(test);

  const state: string[] = [];
  if (rootClasses.has(`${S.field}--touched`)) state.push("touched");
  if (isOpen) state.push("open");
  if (anyOperable((e) => e.hasAttribute("disabled") || e.getAttribute("aria-disabled") === "true")) {
    state.push("disabled");
  }
  if (anyOperable((e) => e.getAttribute("aria-invalid") === "true")) state.push("invalid");

  const active = document_?.activeElement ?? null;
  const focusOwner = active && active !== document_?.body ? partOf(active) : null;

  const overlay: MdyCanonicalOverlay = !definition.capabilities.overlay
    ? "absent"
    : isOpen
      ? "open"
      : "closed";

  return {
    kind,
    parts,
    relationships,
    state,
    value: options.value,
    focusOwner,
    overlay,
  };
}

/**
 * What every renderer must observably produce for a kind at rest.
 *
 * Declared once, here, rather than per adapter: the point of Milestone C is one expectation answered
 * by three renderers, and an expectation written inside an adapter's suite is three expectations that
 * happen to agree today.
 *
 * `parts` is what every renderer actually shows at rest, measured across all three rather than
 * reasoned about: an empirical floor, so one dropping a part is visible even where the contract
 * would permit it. `optional` is every other part the kind declares — presence there depends on a
 * free choice (eager or lazy mounting) or on what the consumer supplied (a supporting text, a
 * prefix, a custom option template), and two renderers disagreeing about one are both right.
 *
 * `aria-describedby` is deliberately absent from every `relationships` list. At rest, with no errors
 * and nothing supplied to describe, what it names depends on whether a renderer materialises an
 * empty description box — one does, another does not, and both conform. It becomes normative once
 * there is something to say, which belongs to the invalid state's expectation rather than this one.
 */
export interface MdyCanonicalExpectation {
  /** Parts every renderer shows at rest. */
  readonly parts: readonly string[];
  /** Parts a renderer may show or not, because the contract leaves the strategy free. */
  readonly optional: readonly string[];
  readonly relationships: readonly MdyCanonicalRelationship[];
  readonly overlay: MdyCanonicalOverlay;
  /**
   * The states the widget reflects, in the contract's own vocabulary, order-insensitive, and absent
   * when the contract does not constrain them.
   *
   * Absent only where renderers make different defensible choices — whether abandoning an
   * interaction counts as having touched the field is a product decision, not a rendering one.
   */
  readonly state?: readonly string[];
  /**
   * The value the field holds, and absent when the contract cannot name it.
   *
   * Absent only where no shared table could: a file field's filled value is a `File`, and two files
   * with the same bytes are still different values, so each fixture makes its own.
   */
  readonly value?: unknown;
  /**
   * The part focus rests on, `null` when focus is nowhere in the widget, and absent when the
   * contract does not constrain it.
   *
   * Left absent only where two renderers make different, defensible choices — a combobox may keep
   * focus on its input and drive the list with `aria-activedescendant`, or move focus into a search
   * field, and both are documented patterns. Freezing one of them here would buy agreement by
   * forbidding a legitimate implementation, which is the failure this contract is written to avoid.
   */
  readonly focusOwner?: string | null;
}

/**
 * The empty value of each kind: what a field holds before anyone has given it one.
 *
 * One table, consumed by every adapter's fixture, because "the same initial state" is half of what
 * Milestone C compares. Three fixtures that each decide for themselves are three different
 * questions: a number field started at `0` is filled and valid, one started at `null` is empty and
 * required-failing, and the two renderers were never asked the same thing.
 *
 * Not derivable from `MDY_VALUE_CONTRACTS`, which says a kind's shape and whether it is nullable —
 * `null` and `[]` are both legal for a multiselect and only one of them is what an untouched field
 * holds.
 */
export const MDY_CANONICAL_EMPTY: Readonly<Partial<Record<MdyWidgetKind, unknown>>> = Object.freeze({
  text: "",
  email: "",
  password: "",
  textarea: "",
  number: null,
  // A slider is never empty: its thumb is somewhere, and that somewhere is its minimum.
  slider: 0,
  checkbox: false,
  toggle: false,
  radio: null,
  segmented: null,
  select: null,
  multiselect: Object.freeze([]),
  datepicker: null,
  timepicker: null,
  daterange: Object.freeze({ start: null, end: null }),
  file: Object.freeze([]),
  colors: "",
});

/**
 * A widget at rest reflects no state at all.
 *
 * Not `touched`, because nobody has touched it; not `invalid`, because nothing has been validated
 * against it yet; not `open`, because an overlay opens on a user's action. A renderer that starts in
 * one of them has decided something on the user's behalf before the user arrived.
 */
const AT_REST: readonly string[] = Object.freeze([]);

export const MDY_CANONICAL_AT_REST: Readonly<Partial<Record<MdyWidgetKind, MdyCanonicalExpectation>>> =
  Object.freeze({
    text: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "prefix", "suffix", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.text,
      focusOwner: null,
    }),
    email: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "prefix", "suffix", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.email,
      focusOwner: null,
    }),
    password: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "prefix", "suffix", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.password,
      focusOwner: null,
    }),
    textarea: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.textarea,
      focusOwner: null,
    }),
    number: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control"]),
      // The two steppers the catalogue declares at this kind's trailing edge. Optional rather than
      // required: a renderer may leave the platform's own spinner in place, which is what the native
      // control draws when nothing replaces it.
      optional: Object.freeze(["supportingText", "requiredMarker", "inlineError", "errors", "errorItem", "increment", "decrement"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.number,
      focusOwner: null,
    }),
    slider: Object.freeze({
      parts: Object.freeze(["root", "label", "track", "control", "value"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.slider,
      focusOwner: null,
    }),
    checkbox: Object.freeze({
      parts: Object.freeze(["root", "inputWrapper", "control", "indicator", "label"]),
      // `submitFalse` is optional because it exists only where the field has a name to submit under:
      // a control mounted outside a form has nothing to serialise and needs no companion.
      optional: Object.freeze(["supportingText", "requiredMarker", "errors", "errorItem", "submitFalse"]),
      relationships: Object.freeze([

      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.checkbox,
      focusOwner: null,
    }),
    toggle: Object.freeze({
      parts: Object.freeze(["root", "inputWrapper", "control", "track", "thumb", "label"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "inlineError", "errors", "errorItem", "submitFalse"]),
      relationships: Object.freeze([

      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.toggle,
      focusOwner: null,
    }),
    radio: Object.freeze({
      parts: Object.freeze(["root", "label", "group", "option", "optionControl", "optionLabel"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "group", attribute: "aria-labelledby", to: "label" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.radio,
      focusOwner: null,
    }),
    segmented: Object.freeze({
      parts: Object.freeze(["root", "label", "group", "option", "optionControl", "optionCheck", "optionText"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "group", attribute: "aria-labelledby", to: "label" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.segmented,
      focusOwner: null,
    }),
    select: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "trigger", "placeholder", "arrow"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "value", "popup", "search", "options", "option", "loading", "empty", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "trigger" },
        { from: "trigger", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.select,
      focusOwner: null,
    }),
    multiselect: Object.freeze({
      // The control opens the popup and holds the value, so it is what the label names and what
      // announces the popup. `chips` — the grid of what was chosen — is optional at rest: an empty
      // grid announces contents it does not have, so it appears with the first value. ADR 0148.
      // The options live in the popup now, so at rest they are absent by construction — the same
      // reason every other overlay kind lists its popup's contents as optional.
      parts: Object.freeze(["root", "label", "inputWrapper", "box", "trigger", "arrow", "announcement"]),
      optional: Object.freeze(["options", "option", "optionCheck", "optionLabel", "optionWrapper", "supportingText", "requiredMarker", "chip", "chipRemove", "placeholder", "optionStep", "optionCount", "popup", "search", "loading", "empty", "inlineError", "errors", "errorItem", "clearAll", "overflowCount", "wayBack", "wayBackAction", "chipTooltip", "chips", "chipRow"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "trigger" },
        { from: "trigger", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.multiselect,
      focusOwner: null,
    }),
    datepicker: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control", "toggle"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "actions", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
        { from: "control", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.datepicker,
      focusOwner: null,
    }),
    timepicker: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control", "toggle"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "popup", "dialog", "container", "content", "header", "hour", "hourControl", "minute", "minuteControl", "period", "clock", "dialFace", "dialHand", "dialNumber", "modeToggle", "actions", "action", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
        { from: "control", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.timepicker,
      focusOwner: null,
    }),
    daterange: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "startControl", "separator", "endControl", "toggle"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "actions", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "startControl" },
        { from: "toggle", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.daterange,
      focusOwner: null,
    }),
    file: Object.freeze({
      parts: Object.freeze(["root", "label", "dropzone", "control", "content"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "fileList", "fileItem", "clear", "rejected", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.file,
      focusOwner: null,
    }),
    colors: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "nativePicker", "preview", "control", "hexInput", "toggle"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "popup", "presets", "swatch", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "hexInput" },
        { from: "toggle", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
      state: AT_REST,
      value: MDY_CANONICAL_EMPTY.colors,
      focusOwner: null,
    }),
  });

/**
 * The part that carries `aria-describedby` for a kind, read from the contract rather than restated.
 *
 * A table here would be a second source for one relation, which is the shape of the defect this
 * milestone keeps finding: two spellings that agree today and diverge the moment one moves.
 */
function describedByCarrier(kind: MdyWidgetKind): string {
  const relation = MDY_WIDGET_RELATIONS[kind]?.find(
    (candidate) => candidate.attribute === "aria-describedby",
  );
  if (!relation) throw new Error(`${kind} declares no aria-describedby relation`);
  return relation.from;
}

/**
 * What every renderer must observably produce for a kind the user has left invalid.
 *
 * Derived from the resting expectation rather than restated, because the invalid state *is* the
 * resting one plus what invalidity adds: the error list, the reference that names it, and the two
 * states the field now reflects. A second hand-written table would drift from the first the moment
 * a part moved, and the drift would look like a renderer defect.
 *
 * The three things invalidity changes:
 *
 * - **`errors` and `errorItem` stop being optional.** At rest a renderer may or may not materialise
 *   an empty list and both conform; once there is an error to show, a renderer that shows none is
 *   not making a free choice.
 * - **`aria-describedby` becomes normative.** At rest it may name an empty description box, or
 *   nothing, depending on whether the renderer builds one. Here it must reach the error list, or the
 *   error is rendered, styled, and announced to nobody.
 * - **The field reflects `invalid` and `touched`.** `invalid` because it is; `touched` because a
 *   field the user has not reached is not one they are being told is wrong.
 */
export const MDY_CANONICAL_INVALID: Readonly<Partial<Record<MdyWidgetKind, MdyCanonicalExpectation>>> =
  Object.freeze(Object.fromEntries(
    Object.entries(MDY_CANONICAL_AT_REST).map(([kind, rest]) => [
      kind,
      Object.freeze({
        parts: Object.freeze([...rest.parts, "errors", "errorItem"]),
        optional: Object.freeze(
          rest.optional.filter((part) => part !== "errors" && part !== "errorItem"),
        ),
        relationships: Object.freeze([
          ...rest.relationships,
          {
            from: describedByCarrier(kind as MdyWidgetKind),
            attribute: "aria-describedby",
            to: "errors",
          },
        ] as readonly MdyCanonicalRelationship[]),
        overlay: rest.overlay,
        state: Object.freeze(["invalid", "touched"]),
        value: rest.value,
        focusOwner: null,
      }),
    ]),
  ));

/**
 * What every renderer must produce for a kind the form has disabled.
 *
 * Rest plus one state, and deliberately nothing else. A disabled field that is also required and
 * empty is two states at once, and a renderer getting either wrong would be reported the same way —
 * so this is measured against a field no validator has judged, like rest itself.
 */
export const MDY_CANONICAL_DISABLED: Readonly<Partial<Record<MdyWidgetKind, MdyCanonicalExpectation>>> =
  Object.freeze(Object.fromEntries(
    Object.entries(MDY_CANONICAL_AT_REST).map(([kind, rest]) => [
      kind,
      Object.freeze({ ...rest, state: Object.freeze(["disabled"]) }),
    ]),
  ));

/**
 * Where focus goes when a kind's overlay opens.
 *
 * A calendar takes focus into its grid: a grid the keyboard cannot reach is a grid only a mouse can
 * use, and both calendar kinds are the same widget with a second endpoint.
 *
 * The kinds absent from this table are **unconstrained on purpose**:
 *
 * - A combobox may keep focus on its opener and drive the list with `aria-activedescendant`, or move
 *   focus into a search field. The authoring practices document both, so naming one here would make
 *   a renderer wrong for making a legitimate choice.
 * - A timepicker's overlay may open on its dial or on its inputs — it has a `modeToggle` precisely
 *   because both are modes. `timepickerDialKeyIntent` says the dial is keyboard-driven wherever it
 *   is shown, but nothing declares which mode a renderer opens in, and focus follows that.
 */
const FOCUS_ON_OPEN: Readonly<Partial<Record<MdyWidgetKind, string | null>>> = Object.freeze({
  datepicker: "gridcell",
  daterange: "gridcell",
  // The swatch row, for the reason written above the calendars: a list the keyboard cannot reach is
  // a list only a mouse can use. `MDY_WIDGET_KEYBOARD` declares the arrows, `Home` and `End` on an
  // open colour field, and the palette leaves no other way in — `Tab` is declared `cancel` and
  // dismisses it — so a table that kept focus outside made those four keys undeliverable by any
  // conforming renderer, and made the presets pointer-only.
  colors: "swatch",
});

/**
 * What every renderer must produce for a kind whose overlay is open.
 *
 * Only the kinds that have one: a text field has no open state to disagree about.
 *
 * `popup` stops being optional here. At rest a renderer may mount it eagerly or build it on demand
 * and both conform; once the widget is open, a renderer showing no popup is not making a free
 * choice.
 */
export const MDY_CANONICAL_OPEN: Readonly<Partial<Record<MdyWidgetKind, MdyCanonicalExpectation>>> =
  Object.freeze(Object.fromEntries(
    Object.entries(MDY_CANONICAL_AT_REST)
      .filter(([, rest]) => rest.overlay !== "absent")
      .map(([kind, { focusOwner: _restingFocus, ...rest }]) => [
        kind,
        Object.freeze({
          ...rest,
          parts: Object.freeze([...rest.parts, "popup"]),
          optional: Object.freeze(rest.optional.filter((part) => part !== "popup")),
          // Closed, the opener names nothing; open, it names what the contract says it controls.
          // The same relation with a target, not a second relation.
          relationships: Object.freeze(rest.relationships.map((relation) =>
            relation.attribute === "aria-controls"
              ? { ...relation, to: MDY_POPUP_OPENERS[kind as MdyWidgetKind]?.controls ?? null }
              : relation,
          )),
          overlay: "open" as const,
          state: Object.freeze(["open"]),
          // Present only for the kinds the contract constrains; omitted leaves the choice free.
          ...(kind in FOCUS_ON_OPEN
            ? { focusOwner: FOCUS_ON_OPEN[kind as MdyWidgetKind] ?? null }
            : {}),
        }),
      ]),
  ));

/**
 * The value each kind holds once something has been put in it.
 *
 * The counterpart to `MDY_CANONICAL_EMPTY`, and needed for the same reason: "the same actions" means
 * nothing unless every renderer is handed the same value to render.
 */
export const MDY_CANONICAL_FILLED: Readonly<Partial<Record<MdyWidgetKind, unknown>>> = Object.freeze({
  // An address the control would accept, because `email` is a kind whose rule the browser also
  // enforces: `"value"` is a filled field *and* a refused one, which is two states at once.
  text: "value", email: "someone@example.com", password: "value", textarea: "value",
  number: 7, slider: 7,
  checkbox: true, toggle: true,
  radio: "a", segmented: "a", select: "a",
  multiselect: Object.freeze(["a"]),
  datepicker: "2026-07-15",
  timepicker: "10:30",
  daterange: Object.freeze({ start: "2026-07-15", end: "2026-07-20" }),
  colors: "#004cff",
  // A file is the one kind whose filled value cannot be written down here: it is a `File`, and two
  // files with the same bytes are still two different values. Its fixture supplies its own.
});

/**
 * What every renderer must produce for a kind holding a value it was given from outside.
 *
 * The roadmap's *programmatic update*: a value set by the form rather than typed by the user. It is
 * the same widget as at rest with something in it, and the only anatomical difference measured
 * across the catalogue is the select's — a filled select shows its value, so the placeholder that
 * stands in for one becomes optional rather than required.
 *
 * No state is reflected. Putting a value in a field is not the user touching it, and a renderer that
 * marked it touched would show validation for an interaction that never happened.
 */
export const MDY_CANONICAL_FILLED_OBSERVATION: Readonly<Partial<Record<MdyWidgetKind, MdyCanonicalExpectation>>> =
  Object.freeze(Object.fromEntries(
    Object.entries(MDY_CANONICAL_AT_REST).map(([kind, { value: _restingValue, ...rest }]) => [
      kind,
      Object.freeze({
        ...rest,
        parts: Object.freeze(rest.parts.filter((part) => part !== "placeholder")),
        optional: Object.freeze([...rest.optional, "placeholder"]),
        // A kind the table cannot name drops the constraint rather than asserting the wrong thing.
        ...(kind in MDY_CANONICAL_FILLED
          ? { value: MDY_CANONICAL_FILLED[kind as MdyWidgetKind] }
          : {}),
      }),
    ]),
  ));

/**
 * What every renderer must produce once an open overlay has been dismissed from the keyboard.
 *
 * The first expectation in this file that describes the result of an *action* rather than a state
 * something was put into. Opening a widget and pressing Escape is one gesture every overlay kind
 * supports, and the contract declares the transition; this is what the widget must look like
 * afterwards.
 *
 * **Focus returns into the widget**, and the contract says no more than that. A dismissed overlay
 * that leaves focus on the document body drops the user at the top of the page with no way back to
 * where they were, which is the one outcome closing a popup must never have. *Which* part receives
 * it is a design choice: the opener the user activated is the obvious answer, and a range picker
 * putting them back in its start field so they can keep typing is a defensible one.
 *
 * **Abandoning an interaction does not touch the field.** A user who opens a picker, changes their
 * mind and presses Escape has decided nothing, and must not be shown a "required" error for a field
 * they never filled. Closing an overlay is therefore not a validation event, which is why the state
 * here is the resting one.
 */
export const MDY_CANONICAL_AFTER_ESCAPE: Readonly<Partial<Record<MdyWidgetKind, MdyCanonicalExpectation>>> =
  Object.freeze(Object.fromEntries(
    Object.entries(MDY_CANONICAL_AT_REST)
      .filter(([kind, rest]) => rest.overlay !== "absent" && MDY_POPUP_OPENERS[kind as MdyWidgetKind])
      .map(([kind, rest]) => [
        kind,
        Object.freeze({ ...rest, focusOwner: MDY_FOCUS_WITHIN }),
      ]),
  ));

/**
 * Value equality across the shapes a kind can hold.
 *
 * A daterange holds an object and a multiselect an array, so identity would report every renderer
 * as diverging from every other. Structural, one level deep, which is as deep as any kind's value
 * goes — a `File` is compared by identity because two files with the same bytes are still two
 * different values to the form.
 */
function sameValue(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.length === expected.length && actual.every((item, i) => Object.is(item, expected[i]));
  }
  if (typeof actual === "object" && typeof expected === "object" && actual && expected) {
    const a = actual as Record<string, unknown>;
    const b = expected as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => Object.is(a[key], b[key]));
  }
  return false;
}

/** A value as it reads in a divergence message. */
function describe(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value) ?? String(value);
  return String(value);
}

/** How a renderer's snapshot departs from the canonical expectation, in the contract's words. */
export function compareToCanonical(
  snapshot: MdyCanonicalSnapshot,
  expectation: MdyCanonicalExpectation,
): readonly string[] {
  const differences: string[] = [];
  const seen = new Set(snapshot.parts.map((part) => part.part));
  const free = new Set(expectation.optional);

  for (const part of expectation.parts) {
    if (!seen.has(part)) differences.push(`missing part: ${part}`);
  }
  for (const part of seen) {
    if (!expectation.parts.includes(part) && !free.has(part)) differences.push(`extra part: ${part}`);
  }
  for (const relation of expectation.relationships) {
    const actual = snapshot.relationships.find(
      (candidate) => candidate.from === relation.from && candidate.attribute === relation.attribute,
    );
    if (!actual) {
      differences.push(`missing relation: ${relation.from} ${relation.attribute}`);
    } else if (actual.to !== relation.to) {
      differences.push(
        `${relation.from} ${relation.attribute} names ${actual.to ?? "nothing"}, expected ${relation.to ?? "nothing"}`,
      );
    }
  }
  if (snapshot.overlay !== expectation.overlay) {
    differences.push(`overlay is ${snapshot.overlay}, expected ${expectation.overlay}`);
  }

  // Order is a renderer's own business — the contract says which states are reflected, not the
  // sequence a snapshot happened to collect them in. An expectation that omits `state` says the
  // contract leaves it free, which is not the same as expecting no state at all.
  if (expectation.state !== undefined) {
    const observedState = [...snapshot.state].sort().join(", ");
    const expectedState = [...expectation.state].sort().join(", ");
    if (observedState !== expectedState) {
      differences.push(`state is [${observedState}], expected [${expectedState}]`);
    }
  }

  if ("value" in expectation && !sameValue(snapshot.value, expectation.value)) {
    differences.push(`value is ${describe(snapshot.value)}, expected ${describe(expectation.value)}`);
  }

  // An expectation that omits `focusOwner` says the contract leaves it free, which is not the same
  // as expecting focus to be nowhere.
  if (expectation.focusOwner !== undefined) {
    const wrong = expectation.focusOwner === MDY_FOCUS_WITHIN
      ? snapshot.focusOwner === null
      : snapshot.focusOwner !== expectation.focusOwner;
    if (wrong) {
      differences.push(
        `focus rests on ${snapshot.focusOwner ?? "nothing"}, expected ${expectation.focusOwner ?? "nothing"}`,
      );
    }
  }
  return differences;
}
