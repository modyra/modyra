/**
 * The refusals the form shows for itself.
 *
 * Not every refusal belongs to a field. A failed network call, a service that is down, a cross-field
 * rule only a server can check: they arrive with no path, and a field-bound control has no reason to
 * show them. The engine keeps them in `state.lastSubmitErrors()`, and without somewhere to put them
 * the person who pressed the button sees their fields exactly as they left them.
 *
 * Placed by the host, because a form's shape is the host's: this component takes the form and says
 * what the form has to say about itself.
 *
 * ```ts
 * h(MdyFormErrors, { form })
 * ```
 *
 * Which errors belong here is `formErrorsOf`'s answer — the ones no field will show — so no refusal
 * is shown twice and none is shown nowhere.
 */
import { defineComponent, h, type PropType } from "vue";
import { formErrorsOf, MDY_FORM_SHELL_CLASSES as FORM } from "@modyra/widgets";
import type { MdyFormError } from "@modyra/core";

export const MdyFormErrors = defineComponent({
  name: "MdyFormErrors",
  props: {
    form: {
      type: Object as PropType<{ state: { lastSubmitErrors(): ReadonlyArray<MdyFormError> } }>,
      required: true,
    },
  },
  setup(props) {
    // Read inside the render function: a form built on Vue's reactivity holds its errors in a ref,
    // so the read is what subscribes the region to the next submission's answer.
    return () => {
      const shown = formErrorsOf(props.form.state.lastSubmitErrors());
      // Rendered empty rather than not at all: a region a screen reader is already watching
      // announces what arrives in it, and one that appears with its message in it may not.
      return h(
        "ul",
        { class: FORM.formErrors, role: "status", hidden: shown.length === 0 },
        shown.map((error) => h("li", { class: FORM.formErrorItem }, error.message)),
      );
    };
  },
});
