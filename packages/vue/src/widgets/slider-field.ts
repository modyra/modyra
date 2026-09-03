/**
 * The slider, which is a numeric field wearing a track.
 *
 * Its control is a native range input — `controlType` says so — and what makes it a different shape
 * from the fields before it is where that control sits: inside a required `track`, beside a required
 * `value` that shows the number. No wrapper, no indicator; a third arrangement of the same pieces.
 *
 * **The arrangement is read, not written.** The control's declared parent is what says which element
 * holds it, and the track's other required children are drawn by the same walk the checkbox and the
 * toggle use. This component names `control` and `value` because it has something to put in them —
 * a projection and a number — and names no container at all.
 */
import { computed, defineComponent, h, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createTextFieldController,
  type MdyTextFieldController,
} from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";
import { drawDeclaredUnder, partProps } from "./part.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.slider;

export const MdySliderField = defineComponent({
  name: "MdySliderField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<number>>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
  },
  setup(props) {
    const controller: MdyTextFieldController<number> = createTextFieldController<number>({
      handle: props.field,
      widgetId: props.widgetId,
      inputType: CONTRACT.controlType,
    });
    const view = computed(() => controller.view());
    /** Which element the contract puts the control inside — asked, so no container is named here. */
    const holder = String(CONTRACT.structure.nodes.find((node) => node.part === "control")?.parent);

    return () => {
      const parts = view.value.parts;
      const children: VNode[] = [];
      if (props.label !== "") children.push(h("label", partProps(parts.label), props.label));

      children.push(h("div", { class: CONTRACT.parts[holder as "track"].classes.join(" ") }, [
        h("input", partProps(parts.input, {
          class: CONTRACT.parts.control.classes.join(" "),
          onInput: (event: Event) => controller.dispatch({
            type: "input",
            // The control speaks in strings and the field holds a number; the conversion belongs
            // where the DOM stops, not inside the controller, which is typed on the field's value.
            value: Number((event.target as HTMLInputElement).value),
          }),
        })),
        // The rest of what the contract puts in that holder, drawn as declared. For this kind that is
        // the value readout; a kind that declared two would get both without an edit here.
        ...(drawDeclaredUnder(CONTRACT, holder, (tag, attrs, kids) => h(tag, attrs, kids as VNode[]), new Set(["control"])) as VNode[]),
      ]));

      if (parts.description !== undefined) children.push(h("p", partProps(parts.description)));
      if (parts.error !== undefined) children.push(h("ul", partProps(parts.error)));
      return h("div", { class: CONTRACT.rootClasses.join(" ") }, children);
    };
  },
});
