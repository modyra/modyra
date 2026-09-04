/**
 * The radio group and the segmented control, which are the same widget with two coats of paint.
 *
 * `segmented` has said so in the catalogue for a long time — *"the same anatomy as `radio`, because
 * it is the same control: a choice in a radiogroup"* — and until this release the two disagreed about
 * one part anyway: `optionControl` named the real `<input type=radio>` in one and the painted circle
 * in the other. Now both declare the input, so this file can draw them with no branch, and the only
 * thing that differs between the kinds is the *name* of the part carrying the option's words.
 *
 * **The arrows are the platform's, not this file's.** A group of native radios sharing a `name` is
 * a radiogroup the browser already rovings: the declared arrow keys move focus and the selection
 * without a listener, which is why the reference renderer has none either. A handler that answered
 * those keys would have to call `preventDefault` to avoid acting twice, and would then owe the whole
 * behaviour back — focus included — in exchange for nothing. The keys stay declared; what honours
 * them here is the element the contract asks for.
 *
 * **That name is derived, not listed.** One kind calls it `optionLabel` and the other `optionText`,
 * and both declare it as the `text` child of `option`. Asking the structure which child that is costs
 * one line and survives a third kind of the same shape; naming the two costs the same line and stops
 * being true the moment one arrives.
 */
import { computed, defineComponent, h, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createOptionFieldController,
  defaultOptionKey,
  type MdyOptionFieldVariant,
} from "@modyra/widgets";
import type { MdyFieldHandle, MdySelectOption } from "@modyra/core";
import { partProps } from "./part.js";

export const MdyOptionField = defineComponent({
  name: "MdyOptionField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<unknown>>, required: true },
    options: { type: Array as PropType<readonly MdySelectOption<unknown>[]>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
    kind: { type: String as PropType<MdyOptionFieldVariant>, default: "radio" },
  },
  setup(props) {
    const contract = MDY_WIDGET_CONTRACTS[props.kind];
    /**
     * The key the contract derives, not `String()`.
     *
     * Every plain object renders through `String` as `[object Object]`, so an object-valued list
     * gives every option one key: two different choices become one, and a group holding one value
     * marks all of them. For a primitive the two answers agree exactly, which is why a fixture built
     * on strings cannot tell them apart.
     */
    const keyFor = (option: MdySelectOption<unknown>): string => defaultOptionKey(option.value);
    const controller = createOptionFieldController<unknown>({
      handle: props.field,
      widgetId: props.widgetId,
      label: props.label === "" ? null : props.label,
      variant: props.kind,
      options: props.options,
      keyFor,
    });
    const view = computed(() => controller.view());
    const state = computed(() => controller.state());

    const classesOf = (part: string): string =>
      (contract.parts as Readonly<Record<string, { classes: readonly string[] }>>)[part]?.classes.join(" ") ?? "";
    /** Which part carries an option's words: the `text` child of `option`, whatever the kind calls it. */
    const wordsPart = String(contract.structure.nodes
      .find((node) => node.parent === "option" && node.element === "text")?.part);

    return () => {
      const parts = view.value.parts;
      const children: VNode[] = [];
      if (props.label !== "") children.push(h("label", partProps(parts.label), props.label));

      children.push(h("div", partProps(parts.group),
        props.options.map((option) => {
          const key = keyFor(option);
          return h("label", { class: classesOf("option") }, [
            // The control the submission table names, carrying the option's projected id and state.
            // The projection describes the choice; its ARIA and its identity go to the native
            // control, which is what assistive tech reads and what a form submits. Its *classes*
            // belong to the row instead — the contract paints the option on the `option` element —
            // so the control carries only the classes its own part declares.
            h("input", partProps({ ...parts[key], classes: [] }, {
              type: "radio",
              class: classesOf("optionControl"),
              name: props.widgetId,
              value: key,
              // Compared by key, not by value: two structurally equal objects are two choices, and
              // `===` between the held value and a fresh option object marks neither.
              checked: state.value.selectedKey === key,
              onChange: () => controller.dispatch({ type: "select", optionKey: key }),
            })),
            h("span", { class: classesOf("optionCheck") }),
            h("span", { class: classesOf(wordsPart) }, option.label),
          ]);
        })));

      if (parts.description !== undefined) children.push(h("p", partProps(parts.description)));
      if (parts.error !== undefined) children.push(h("ul", partProps(parts.error)));
      return h("div", { class: contract.rootClasses.join(" ") }, children);
    };
  },
});
