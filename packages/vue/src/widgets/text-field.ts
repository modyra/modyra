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
 * `email`, `password` and `textarea` declare the same parts in the same places; what separates them
 * is a native type and, for one of them, a tag. Both are declared — `controlType` and the control
 * part's element — so this reads them instead of branching on the kind. A component that branched
 * would be deciding again what the catalogue decided, and would need editing the day a fifth kind
 * joins the shape rather than simply accepting it.
 */
import { computed, defineComponent, h, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createTextFieldController,
  type MdyTextFieldController,
} from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";
import { partProps } from "./part.js";

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
    kind: { type: String as PropType<"text" | "email" | "password" | "textarea">, default: "text" },
  },
  setup(props) {
    const contract = MDY_WIDGET_CONTRACTS[props.kind];
    const controlNode = contract.structure.nodes.find((node) => node.part === "control");
    const tag = TAG_FOR_ELEMENT[String(controlNode?.element)] ?? "input";
    // `inputType` comes from the catalogue, not from this file: `controlType` is what the contract
    // says a text field's native input is, and a renderer spelling "text" here would be a second
    // statement of it — the one that stops moving when the declaration does.
    const controller: MdyTextFieldController<string> = createTextFieldController<string>({
      handle: props.field,
      widgetId: props.widgetId,
      inputType: contract.controlType,
    });
    const view = computed(() => controller.view());

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
          onInput: (event: Event) => controller.dispatch({
            type: "input",
            value: (event.target as HTMLInputElement).value,
          }),
        })),
      ]));

      if (parts.description !== undefined) children.push(h("p", partProps(parts.description)));
      if (parts.error !== undefined) children.push(h("ul", partProps(parts.error)));

      return h("div", { class: contract.rootClasses.join(" ") }, children);
    };
  },
});
