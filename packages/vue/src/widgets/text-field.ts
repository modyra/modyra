/**
 * The fields whose anatomy is the text field's, drawn from what the contract declares and nothing
 * else.
 *
 * Every element here answers a question the catalogue already answers: which parts exist, which
 * classes each carries, which is required, where each sits. The component asks rather than decides —
 * `MDY_WIDGET_CONTRACTS.text` for the anatomy, the field controller's view for the ids, names and
 * ARIA relations. Nothing below chooses a class name or an attribute on its own, which is the whole
 * point: a renderer that decided would be a fourth opinion about a widget three already agree on.
 *
 * **The wrapper is not decoration.** `inputWrapper` is required by the contract and is the box the
 * shipped themes lay the control out in; a renderer that skipped it because it draws nothing itself
 * would render a field the themes cannot arrange.
 *
 * **One component for several kinds, because the catalogue says they are one shape.** `text`,
 * `email`, `password`, `textarea` and `number` declare the same *required* parts in the same places;
 * what separates them is a native type and, for one of them, a tag. The number field also declares
 * two stepper buttons, and they are optional: the platform draws its own, so a renderer that omits
 * them leaves the kind with the keyboard and the native affordance rather than with nothing. Both are declared — `controlType` and the control
 * part's element — so this reads them instead of branching on the kind. A component that branched
 * would be deciding again what the catalogue decided, and would need editing the day a fifth kind
 * joins the shape rather than simply accepting it.
 */
import { defineComponent, h, onScopeDispose, ref, shallowRef, triggerRef, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createTextFieldController,
  type MdyTextFieldController,
} from "@modyra/widgets";
import { observerFor } from "@modyra/core";
import type { MdyFieldConstraints, MdyFieldHandle } from "@modyra/core";
import { partProps } from "./part.js";
import { drawErrors } from "./errors.js";
import { useKeyboardInPlay } from "./keyboard-in-play.js";

/**
 * Which tag a control is, asked of the semantic the part declares.
 *
 * `input` admits an `<input>`, a `<textarea>` and a `<select>` — most kinds do not care which, and
 * the one that does says so by narrowing its semantic. Reading it here is what lets the same
 * component draw a textarea without a branch naming the kind.
 */
const TAG_FOR_ELEMENT: Readonly<Record<string, string>> = Object.freeze({ input: "input", textarea: "textarea" });

export const MdyTextField = defineComponent({
  name: "MdyTextField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<string>>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
    /** Which of the kinds that share this anatomy is being drawn. */
    kind: { type: String as PropType<"text" | "email" | "password" | "textarea" | "number">, default: "text" },
    /** The name a control has when nothing on the page captions it. */
    ariaLabel: { type: String, default: "" },
    placeholder: { type: String, default: "" },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    step: { type: Number, default: undefined },
  },
  setup(props) {
    const contract = MDY_WIDGET_CONTRACTS[props.kind];
    const controlNode = contract.structure.nodes.find((node) => node.part === "control");
    const tag = TAG_FOR_ELEMENT[String(controlNode?.element)] ?? "input";
    // `inputType` comes from the catalogue, not from this file: `controlType` is what the contract
    // says a text field's native input is, and a renderer spelling "text" here would be a second
    // statement of it — the one that stops moving when the declaration does.
    /**
     * What this control asks for on top of the field's own rules.
     *
     * Handed to the controller rather than written onto the element: the projection composes the
     * two and puts the attributes on the control part, so a bound is decided in one place. The
     * `kind` is what tells it which native constraints this control may carry at all.
     *
     * Read inside the function, not captured: a document may narrow a field while it is on screen.
     */
    const narrowing = (): Partial<MdyFieldConstraints> => ({
      min: props.min ?? null,
      max: props.max ?? null,
      step: props.step ?? null,
    });
    const controller: MdyTextFieldController<string> = createTextFieldController<string>({
      handle: props.field,
      widgetId: props.widgetId,
      inputType: contract.controlType,
      kind: props.kind,
      constraints: narrowing,
    });
    // Observed through the runtime that owns the handle, never through a Vue `computed`.
    //
    // The controller's signals belong to the handle's runtime, and a `computed` has nothing of
    // Vue's to track inside one: the first render is correct and every later one is stale. That is
    // invisible in the value, because the control is uncontrolled and shows what was typed — and
    // total for everything only a render writes, so `aria-invalid` and every state class stay at
    // whatever they were when the field was mounted.
    const reactivity = observerFor(props.field);
    // The widget's own element, held so the keyboard has a place to be put back to.
    const root = ref<HTMLElement | null>(null);
    useKeyboardInPlay(props.field as never, root);
    const view = shallowRef(controller.view());
    const watching = reactivity.effect(() => {
      view.value = controller.view();
      triggerRef(view);
    });
    onScopeDispose(() => { watching.destroy(); controller.destroy(); });

    return () => {
      const parts = view.value.parts;
      const children: VNode[] = [];

      // Drawn only when the field was given words to show, which is what the contract's `optional`
      // says about it — not omitted to save an element.
      if (props.label !== "") {
        children.push(h("label", partProps(parts.label), props.label));
      }

      children.push(h("div", { class: contract.parts.inputWrapper.classes.join(" ") }, [
        h(tag, partProps(parts.input, {
          // Two the projection does not carry, and both belong on the control a person types into:
          // a hint shown inside the empty box, and the name it has where nothing captions it.
          ...(props.placeholder === "" ? {} : { placeholder: props.placeholder }),
          ...(props.ariaLabel === "" ? {} : { "aria-label": props.ariaLabel }),
          onInput: (event: Event) => controller.dispatch({
            type: "input",
            value: (event.target as HTMLInputElement).value,
          }),
        })),
      ]));

      if (parts.description !== undefined) children.push(h("p", partProps(parts.description)));
      // The list and what is in it. Framed and left empty, it was a reference `aria-describedby`
      // points at that explains nothing.
      if (parts.error !== undefined) {
        children.push(drawErrors(parts.error, props.field, props.kind));
      }

      return h("div", { class: contract.rootClasses.join(" "), ref: root }, children);
    };
  },
});
