/**
 * Answering the reset of the `<form>` a field sits in.
 *
 * A consumer's Cancel button is `type="reset"`. The browser's reset returns each box to its `value`
 * *attribute*, which this renderer never writes, and the model that holds the field hears nothing:
 * without this, Cancel leaves both the model and what is drawn holding the changed values.
 *
 * The deciding is `bindFormReset`'s: which form is resetting, whether it contains this field, and
 * when to write. This only says which element to watch and what returning to the beginning means
 * here, which is the reset of the form the field's handle belongs to.
 *
 * Every field in the form binds its own, and the form's reset returns all of them, so the write runs
 * once per field and does the same thing each time. Idempotent by construction rather than by
 * coordination.
 */
import { onMounted, onScopeDispose, type Ref } from "vue";
import { bindFormReset } from "@modyra/widgets";
import { handleFormOf } from "@modyra/core";

export function useFormReset(field: object, root: Ref<HTMLElement | null>): void {
  let stop: (() => void) | null = null;
  // After the element exists: the binding reads the document it lives in, and resolves the
  // enclosing form at each reset, so a field moved into a form after mounting is answered too.
  onMounted(() => {
    const element = root.value;
    const form = handleFormOf(field) as { reset?: () => void } | undefined;
    if (element === null || form?.reset === undefined) return;
    stop = bindFormReset({ element, reset: () => { form.reset?.(); } });
  });
  onScopeDispose(() => { stop?.(); stop = null; });
}
