/**
 * The element vocabulary a conformance run judges against, and who shares a part's classes.
 *
 * A leaf: it reads the catalogue and nothing else in this directory reads it back. Both the DOM
 * contract and the part lookup need these two, and the lookup used to take them from the contract —
 * which made the contract unable to use the lookup, because that would have closed a cycle. Neither
 * of them owns these more than the other, so they live where both can reach them.
 */
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "../catalog.js";
import type { MdyPartContract } from "../contract.js";

/**
 * What each semantic element in the catalog admits. A part may satisfy its element by tag or by an
 * explicit role — a `div role="textbox"` is a control, and refusing it would forbid every composite
 * widget — but it may not satisfy it by carrying the right class and nothing else. A class is
 * styling; it tells an assistive technology nothing.
 *
 * `undefined` means the catalog declares no semantics for that element: a wrapper, a run of text.
 * Those are listed rather than defaulted, so an element name nobody thought about fails loudly
 * instead of silently admitting everything.
 */
export const MDY_SEMANTIC_ELEMENTS: Readonly<Record<string, { tags: readonly string[]; roles: readonly string[] } | undefined>> = Object.freeze({
  root: undefined,
  group: undefined,
  // Prose the user reads. Which block or inline element carries it is presentation, and renderers
  // differ freely; what it may not be is a control, a button or an interactive element pretending
  // to be a caption.
  text: { tags: ["p", "div", "span", "output", "strong", "em", "small", "abbr"], roles: ["presentation", "none"] },
  presentation: undefined,
  label: { tags: ["label"], roles: [] },
  // A multi-line control, and the only tag that is one. `input` admits three tags because most kinds
  // do not care which of them a renderer reaches for; this kind is named after its tag, so the
  // question "which element" has an answer and the contract should be able to give it. Without this
  // entry the kind declared `input`, which is true and does not discriminate: a generator reading it
  // learns "a native form control" and still has to guess between three.
  textarea: { tags: ["textarea"], roles: ["textbox"] },
  input: {
    tags: ["input", "textarea", "select"],
    roles: ["textbox", "searchbox", "combobox", "spinbutton", "slider", "checkbox", "radio", "switch"],
  },
  button: { tags: ["button"], roles: ["button", "switch"] },
  // An input that exists so a native submit has something to read. It carries no role, because a
  // role would put it in the accessibility tree, where it is a duplicate of a value the person can
  // already see and operate somewhere else.
  submission: { tags: ["input"], roles: [] },
  listbox: { tags: ["select"], roles: ["listbox", "grid"] },
  option: { tags: ["option"], roles: ["option", "gridcell"] },
  // A choice in a radiogroup. Native or by role, as everywhere else — the tag check below refuses an
  // `<input>` that is any other type, so this does not admit every input in the catalogue.
  radio: { tags: ["input"], roles: ["radio"] },
  // Holds controls and is not one. `presentation` cannot say this — it admits everything, which is
  // the point of it — and the distinction matters wherever a part's children are buttons: a button
  // inside a button is invalid, and nothing else in this table refuses it.
  container: { tags: ["div", "span", "li", "p", "section"], roles: ["presentation", "none", "group"] },
  dialog: { tags: ["dialog"], roles: ["dialog", "alertdialog"] },
  // The thing a pointer uses to reach a value the widget owns. A `<label>` wrapping a hidden native
  // input and a `<button>` beside one are both correct, and the second avoids nesting a focusable
  // control inside another — so this admits either rather than picking the pattern one renderer
  // happened to use first. It is not unconstrained: a bare div still fails.
  affordance: { tags: ["label", "button"], roles: ["button"] },
  // A popup is a positioning container. Its accessible semantics live on what it *contains* — the
  // listbox, the grid, the dialog — so constraining the box itself would only force a role that
  // says nothing. Declared unconstrained rather than left to fall through, so the omission is a
  // decision on the record. Nothing yet checks the contained element, so a popup framing the wrong
  // thing — or nothing — is invisible here.
  popup: undefined,
  grid: { tags: ["table"], roles: ["grid", "rowgroup", "presentation", "none"] },
  gridcell: { tags: ["td", "th"], roles: ["gridcell", "button"] },
  // The heading of a grid column — a weekday above a calendar. It is a cell, not prose, and saying
  // so is what keeps the grid navigable.
  columnheader: { tags: ["th"], roles: ["columnheader"] },
  // A run of errors is a list, an inline error is a span, a loading note is a paragraph. Named
  // rather than widened to "anything": this still rejects a control, a button or a bare div.
  status: { tags: ["output", "ul", "ol", "li", "p", "span"], roles: ["status", "alert", "log", "list", "listitem"] },
  // A graphic with an accessible name. The tag is whatever draws it, so the role is what counts.
  image: { tags: ["img", "svg"], roles: ["img"] },
});

/**
 * The parts of `kind` that carry exactly the classes `part` carries, in declared order.
 *
 * Length 1 for almost every part, which is the uninteresting case: the part is alone under its
 * selector and the first match is it. Where it is longer, the anatomy's order is the only thing
 * that tells the members apart, and every resolver must read it the same way — two derivations of
 * "which of these is which" would disagree the moment one of them was tightened.
 */
export function partsSharingClassesWith(kind: MdyWidgetKind, part: string): readonly string[] {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const parts = definition.parts as Readonly<Record<string, MdyPartContract | undefined>>;
  const key = (name: string): string => [...(parts[name]?.classes ?? [])].sort().join(" ");
  const target = key(part);
  if (target === "") return [part];

  return definition.structure.nodes
    .filter((node) => key(node.part) === target)
    .sort((a, b) => a.order - b.order)
    .map((node) => node.part);
}
