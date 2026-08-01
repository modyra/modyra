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
    const opener = MDY_POPUP_OPENERS[kind]?.opener;
    if (!opener) return [];
    const classes = definition.parts[opener as keyof typeof definition.parts]?.classes ?? [];
    if (!classes.length) return [];
    const selector = classes.map((className: string) => `.${escapeClass(className)}`).join("");
    const element = root.matches?.(selector) ? root : root.querySelector(selector);
    const controls = element?.getAttribute("aria-controls");
    const named = controls ? root.ownerDocument?.getElementById(controls) : null;
    if (!named || root.contains(named)) return [];
    // The whole portalled tree, not just the element the id names. A relation may point at the
    // *listbox* while the popup that holds it is an ancestor, so scoping to the named element alone
    // reports the popup as absent on exactly the kinds whose relation is most precise.
    let outermost: Element = named;
    for (
      let cursor = named.parentElement;
      cursor && cursor !== root.ownerDocument?.body && !root.contains(cursor);
      cursor = cursor.parentElement
    ) {
      outermost = cursor;
    }
    return [outermost];
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

  /** The elements a state can be expressed on: whatever the kind uses to take input. */
  const operable: readonly Element[] = ["control", "startControl", "endControl", "trigger", "searchButton", "group", "toggle"]
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
}

export const MDY_CANONICAL_AT_REST: Readonly<Partial<Record<MdyWidgetKind, MdyCanonicalExpectation>>> =
  Object.freeze({
    text: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "prefix", "suffix", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    email: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "prefix", "suffix", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    password: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "prefix", "suffix", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    textarea: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    number: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    slider: Object.freeze({
      parts: Object.freeze(["root", "label", "track", "control", "value"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    checkbox: Object.freeze({
      parts: Object.freeze(["root", "inputWrapper", "control", "indicator", "label"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "errors", "errorItem"]),
      relationships: Object.freeze([

      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    toggle: Object.freeze({
      parts: Object.freeze(["root", "inputWrapper", "control", "track", "thumb", "label"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([

      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    radio: Object.freeze({
      parts: Object.freeze(["root", "label", "group", "option", "optionControl", "optionLabel"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "group", attribute: "aria-labelledby", to: "label" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    segmented: Object.freeze({
      parts: Object.freeze(["root", "label", "group", "option", "optionCheck", "optionText"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "group", attribute: "aria-labelledby", to: "label" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    select: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "trigger", "placeholder", "arrow"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "value", "popup", "search", "listbox", "option", "loading", "empty", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "trigger" },
        { from: "trigger", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
    }),
    multiselect: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "header", "searchButton", "options", "option", "optionCheck", "optionLabel"]),
      optional: Object.freeze(["optionWrapper", "supportingText", "requiredMarker", "chips", "chip", "placeholder", "optionStep", "optionCount", "popup", "search", "listbox", "loading", "empty", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "searchButton" },
        { from: "searchButton", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
    }),
    datepicker: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control", "toggle"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "actions", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
        { from: "control", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
    }),
    timepicker: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "control", "toggle"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "popup", "dialog", "container", "content", "header", "hour", "minute", "period", "clock", "dialFace", "dialHand", "dialNumber", "modeToggle", "actions", "action", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
        { from: "control", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
    }),
    daterange: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "startControl", "separator", "endControl", "toggle"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "popup", "dialogHeader", "calendar", "grid", "weekdays", "weekday", "row", "gridcell", "actions", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "startControl" },
        { from: "toggle", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
    }),
    file: Object.freeze({
      parts: Object.freeze(["root", "label", "dropzone", "control", "content"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "fileList", "fileItem", "clear", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "control" },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "absent" as const,
    }),
    colors: Object.freeze({
      parts: Object.freeze(["root", "label", "inputWrapper", "nativePicker", "preview", "control", "hexInput", "toggle"]),
      optional: Object.freeze(["supportingText", "requiredMarker", "popup", "presets", "swatch", "inlineError", "errors", "errorItem"]),
      relationships: Object.freeze([
        { from: "label", attribute: "for", to: "hexInput" },
        { from: "toggle", attribute: "aria-controls", to: null },
      ] as readonly MdyCanonicalRelationship[]),
      overlay: "closed" as const,
    }),
  });

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
  return differences;
}
