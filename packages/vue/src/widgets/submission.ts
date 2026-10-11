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
 */
import { onMounted, onUpdated, type Ref } from "vue";
import { applySubmissionNames, submissionFor, syncSubmitValues, type MdyWidgetKind } from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";

export function useNativeSubmission(
  kind: MdyWidgetKind,
  field: MdyFieldHandle<unknown>,
  root: Ref<HTMLElement | null>,
): void {
  const apply = (): void => {
    const element = root.value;
    if (element === null) return;
    if (submissionFor(kind).form === "hidden") {
      const value = field.value();
      const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
      syncSubmitValues(element, field.path, values, field.disabled());
    } else {
      applySubmissionNames(element, kind, field.path);
    }
  };
  onMounted(apply);
  onUpdated(apply);
}
