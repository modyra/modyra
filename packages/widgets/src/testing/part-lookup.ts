/**
 * Finding a widget's parts in a rendered tree, from the contract and nothing else.
 *
 * A conformance harness that hardcodes where a part lives knows the widget from outside the
 * contract, and every such place is a rule the specification does not actually express — the suite
 * passes because the tester was told the answer, not because the contract said it.
 *
 * The hard case, and the reason this exists rather than a plain class lookup: a kind may declare two
 * parts with the same classes. A date range's `startControl` and `endControl` are the same input
 * twice, and no selector separates them. What separates them is already in the contract — the
 * anatomy declares their `order` — so they are resolved by their declared position among the
 * elements that share their classes, rather than by a harness counting to two.
 */
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "../catalog.js";
import type { MdyPartContract } from "../contract.js";
import { dynamicParts } from "../ssr.js";
import { MDY_SEMANTIC_ELEMENTS, partsSharingClassesWith } from "./dom-tests.js";

/**
 * A kind's parts keyed by name.
 *
 * Each kind's `parts` is typed with its own closed set of part names, and this module is
 * deliberately generic over all of them — a lookup that only accepted one kind's names could not
 * serve a harness iterating the catalogue.
 */
const partsOf = (kind: MdyWidgetKind): Readonly<Record<string, MdyPartContract | undefined>> =>
  MDY_WIDGET_CONTRACTS[kind].parts as Readonly<Record<string, MdyPartContract | undefined>>;

/**
 * Escapes a class name for use in a selector.
 *
 * Hand-rolled rather than `CSS.escape`, which is a browser global this package must not require:
 * `@modyra/widgets` loads and computes in a process with no DOM, and a bare `CSS.escape` reference
 * turns that into a `ReferenceError` the moment a selector is built.
 */
function escapeClassName(name: string): string {
  return name.replace(/[^\w-]/g, (character) => `\\${character}`);
}

/** The CSS selector the contract's declared classes amount to, or `null` where it declares none. */
export function partSelector(kind: MdyWidgetKind, part: string): string | null {
  const classes = partsOf(kind)[part]?.classes ?? [];
  if (classes.length === 0) return null;
  return classes.map((name) => `.${escapeClassName(name)}`).join("");
}

/**
 * This widget's popup, when the renderer lifted it out of the field.
 *
 * Found through the relation the contract declares — the opener's `aria-controls` — because a class
 * selector cannot tell two widgets of the same kind apart, nor a datepicker's popup from the
 * daterange's beside it. Returns null when the popup is inside the root, where the ordinary scope
 * already covers it, or when the widget is not open.
 */
function portalledPopup(
  root: ParentNode,
  kind: MdyWidgetKind,
  portalRoots: readonly ParentNode[],
): ParentNode | null {
  const relation = MDY_POPUP_OPENERS[kind];
  if (!relation || portalRoots.length === 0) return null;

  const opener = findPartElement(root, kind, relation.opener);
  const id = opener?.getAttribute("aria-controls");
  if (!id) return null;

  for (const scope of portalRoots) {
    const controlled = scope.querySelector(`#${escapeClassName(id)}`);
    if (!controlled) continue;
    // The opener may name the listbox inside the popup rather than the popup itself; the part being
    // looked up can be either, so the whole overlay container is the scope.
    const popupSelector = partSelector(kind, "popup");
    return (popupSelector ? controlled.closest(popupSelector) : null) ?? controlled;
  }
  return null;
}

export interface MdyPartLookupOptions {
  /**
   * Where a portalled popup went, when it is not inside the root.
   *
   * An adapter may lift its overlay to the document — a legitimate choice the contract does not
   * constrain — and a lookup that could not see it would report every portalled part as absent.
   */
  readonly portalRoots?: readonly ParentNode[];
}

/**
 * Every element rendered for a kind's part.
 *
 * The plural exists for the parts the anatomy marks `repeated` — options, grid cells, error items.
 * Mapping one of many makes each of its children look mis-parented, because the child belongs to a
 * sibling of the element that was mapped.
 *
 * Same derivation as {@link findPartElement}, and it deliberately does **not** apply the declared-
 * order tie-break: that picks one element out of a group sharing a class, which is the opposite of
 * what a caller asking for all of them wants.
 */
export function findPartElements(
  root: ParentNode,
  kind: MdyWidgetKind,
  part: string,
  options: MdyPartLookupOptions = {},
): readonly Element[] {
  const selector = partSelector(kind, part);
  if (selector === null) {
    const single = findPartElement(root, kind, part, options);
    return single ? [single] : [];
  }
  // A part sharing its classes with another is not repeated in the sense this serves — the group
  // would include the sibling part's elements too, so fall back to the single, ordered answer.
  if (partsSharingClassesWith(kind, part).length > 1) {
    const single = findPartElement(root, kind, part, options);
    return single ? [single] : [];
  }

  for (const scope of scopesFor(root, kind, part, options)) {
    const found = Array.from(scope.querySelectorAll(selector));
    const self = scope as Partial<Element>;
    const all = typeof self.matches === "function" && self.matches(selector)
      ? [scope as Element, ...found]
      : found;
    if (all.length > 0) return all;
  }
  return [];
}

/** Where a part may legitimately be looked for: the root, plus this widget's popup if portalled. */
function scopesFor(
  root: ParentNode,
  kind: MdyWidgetKind,
  part: string,
  options: MdyPartLookupOptions,
): readonly ParentNode[] {
  if (!dynamicParts(kind).includes(part)) return [root];
  const popup = portalledPopup(root, kind, options.portalRoots ?? []);
  return popup ? [root, popup] : [root];
}

/**
 * The element rendered for a kind's part, or `null` when it is not in the tree.
 *
 * Document order is the tie-break, matched against the anatomy's declared order, because that is
 * the only thing distinguishing two parts a renderer draws with the same classes. A renderer that
 * emits them the other way round is reporting a different widget, and this returns the wrong
 * element for both — which is the correct outcome: the anatomy says which comes first.
 *
 * Where a part declares **no classes**, its declared semantic element answers instead: a text
 * field's `control` is a bare `<input>` with nothing to select on, and the anatomy already says it
 * is an `input`. Falling back to the semantic is still deriving from the contract — the alternative
 * is a harness naming the tag itself, which is the thing this function exists to remove.
 */
export function findPartElement(
  root: ParentNode,
  kind: MdyWidgetKind,
  part: string,
  options: MdyPartLookupOptions = {},
): Element | null {
  // A portal moves the **popup**, so only a part inside the popup subtree can be outside the root —
  // and it is found by *following the contract's own relation* to it, not by searching the document.
  //
  // Both shortcuts were tried and both returned another widget's element. Scanning the portal roots
  // for the part's class reported a field's `suffix` as living outside its own wrapper, and then
  // reported a datepicker's `actions` present because the *daterange* next to it renders one under
  // the same class. `MDY_POPUP_OPENERS` says which part opens the overlay and which it controls;
  // `aria-controls` on that opener is the only thing that identifies *this* widget's popup.
  const scopes = scopesFor(root, kind, part, options);
  const selector = partSelector(kind, part);

  if (selector === null) {
    // No declared class. The semantic element is the only thing left the contract says about it, and
    // it is enough exactly when the part is the kind's single control of that shape — which is why
    // a match is taken only if there is one.
    const semantic = MDY_WIDGET_CONTRACTS[kind].structure.nodes.find((node) => node.part === part)?.element;
    const tags = semantic ? MDY_SEMANTIC_ELEMENTS[semantic]?.tags ?? [] : [];
    if (tags.length === 0) return null;
    for (const scope of scopes) {
      const matches = scope.querySelectorAll(tags.join(","));
      if (matches.length === 1) return matches[0] ?? null;
    }
    return null;
  }

  const siblings = partsSharingClassesWith(kind, part);
  const index = siblings.indexOf(part);
  if (index < 0) return null;

  for (const scope of scopes) {
    // The scope itself counts. When the part being looked up *is* the portalled popup, the scope
    // resolved for it is that very element — and `querySelectorAll` never returns the node it was
    // called on, so searching inside the popup for the popup found nothing.
    //
    // Duck-typed rather than `instanceof Element`: this package computes in processes with no DOM
    // globals, and a bare `Element` reference is a `ReferenceError` the moment a selector is built.
    const within = Array.from(scope.querySelectorAll(selector));
    const self = scope as Partial<Element>;
    const matchesItself = typeof self.matches === "function" && self.matches(selector);
    const matches = matchesItself ? [scope as Element, ...within] : within;
    if (matches.length > index) return matches[index] ?? null;
  }
  return null;
}
