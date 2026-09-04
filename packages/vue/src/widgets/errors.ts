/**
 * The list a field's errors are read from, and the items inside it.
 *
 * The contract declares two parts, `errors` and `errorItem`, and this package drew at most the first
 * of them: an `<ul>` that was always empty, or — for five kinds — nothing at all, while
 * `aria-describedby` pointed at the id it would have had. A reference to an empty list is worse than
 * silence, because it promises an explanation and delivers none.
 *
 * Drawn on every render whether or not there is anything to say, so what names it keeps naming
 * something: a description a renderer creates only when it has text is a dangling reference the rest
 * of the time.
 *
 * Which errors are *shown* is the contract's answer, not this file's. A field that has not been
 * touched is not wrong yet, and `visibleErrorsOf` is where that rule lives — asked here so every
 * kind in this package answers it the same way, and the same way as every other renderer.
 */
import { h, type VNode } from "vue";
import { MDY_WIDGET_CONTRACTS, visibleErrorsOf, type MdyWidgetKind } from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";
import { partProps } from "./part.js";

/** The projection of the part that frames the list, as a component holds it. */
type ErrorsPart = Parameters<typeof partProps>[0];

export function drawErrors(
  part: ErrorsPart,
  handle: MdyFieldHandle<unknown>,
  kind: MdyWidgetKind,
): VNode {
  // The item's class is the kind's own, asked of the catalogue rather than passed in: a caller that
  // supplied it would be a second place the name lives, and the one that stops moving.
  const itemClass = (MDY_WIDGET_CONTRACTS[kind].parts as Readonly<Record<string, { classes: readonly string[] } | undefined>>)
    ["errorItem"]?.classes.join(" ") ?? "";
  return h(
    "ul",
    partProps(part),
    visibleErrorsOf(handle, kind).map((error) => h("li", { class: itemClass }, error.message)),
  );
}
