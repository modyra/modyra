/**
 * What a field's caption contains.
 *
 * A label is the words the document wrote and, on a field that must be filled, the mark that says
 * so. The mark is a declared part — `requiredMarker`, present when the field is required — and it
 * comes from the same answer that puts `aria-required` on the control: a star and an announcement
 * that disagree describe two different fields, and only one of them is on the page.
 *
 * Composed here rather than at each caption, because a rule written once per kind is a rule that
 * holds until one of the copies is corrected.
 */
import { h, type VNode } from "vue";
import { MDY_FIELD_SHELL_CLASSES, fieldIsRequired } from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";

/**
 * The caption's children: its words, followed by the required mark where one is owed.
 *
 * The field is asked as a whole rather than for its `required` flag alone — a field out of play
 * cannot be filled in, so the mark is not owed of it however the rule reads.
 */
export function labelContent(
  text: string,
  field: MdyFieldHandle<unknown>,
): (string | VNode)[] {
  const mark = requiredMark(field);
  return mark === null ? [text] : [text, mark];
}

/**
 * The mark alone, for a caption that composes its own children.
 *
 * `null` where none is owed, so a caller appends the answer rather than deciding it: a caption that
 * asked whether the field was required would be a second reading of the rule, free to drift from
 * the one the control announces.
 */
export function requiredMark(field: MdyFieldHandle<unknown>): VNode | null {
  const owed = fieldIsRequired({
    required: field.required(),
    interactivity: field.interactivity(),
  });
  return owed ? h("span", { class: MDY_FIELD_SHELL_CLASSES.requiredMarker }, "*") : null;
}
