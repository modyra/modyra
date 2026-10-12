/**
 * How a field's value reaches the payload of the `<form>` it sits in.
 *
 * A control without a `name` is not serialised, so a native submit sends nothing for it. Which part
 * carries the value, and under what key, is `submissionFor`'s answer; this only says when to apply
 * it here, which is after every render of the field.
 *
 * After the render rather than in it, because the shared helpers write the DOM the other renderers
 * write: the key onto the part the contract names, or hidden inputs carrying the value for a kind
 * whose control is a presentation. A kind that sends its value from a hidden input sends the value
 * the model holds, never the text the box shows, because that text follows the reader's locale.
 *
 * A kind whose controls share one name — a set of radios — needs `groupKey`, the scoped id the set
 * groups by when no form owns it. Inside a form the set groups by its form and the path, and the path
 * is the key a native submit sends; outside one nothing is submitted and the scoped id keeps two sets
 * on one page from merging into one choice.
 */
import { onMounted, onUpdated, type Ref } from "vue";
import { applySubmissionNames, groupSubmitName, submissionFor, syncSubmission, type MdyWidgetKind } from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";

export function useNativeSubmission(
  kind: MdyWidgetKind,
  field: MdyFieldHandle<unknown>,
  root: Ref<HTMLElement | null>,
  groupKey?: () => string,
): void {
  const apply = (): void => {
    const element = root.value;
    if (element === null) return;
    const shape = submissionFor(kind);
    if (shape.form === "shared") {
      const name = groupSubmitName(element, field.path, groupKey?.() ?? field.path);
      for (const radio of Array.from(element.querySelectorAll<HTMLInputElement>('input[type="radio"]'))) radio.name = name;
    } else {
      applySubmissionNames(element, kind, field.path);
      syncSubmission(element, kind, field.path, field.value(), field.disabled());
    }
  };
  onMounted(apply);
  onUpdated(apply);
}
