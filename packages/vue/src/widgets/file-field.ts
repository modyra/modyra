/**
 * The file field, which is the deepest anatomy the catalogue declares among the native kinds.
 *
 * Its required parts nest three levels: a dropzone holds the control and a content box, and the
 * content box holds the button that clears a selection. Nothing before it went past two, so this is
 * where a walk over the declared structure either holds or is revealed as a trick that worked twice.
 *
 * **The component places two things and derives the rest.** The control goes where its projection
 * and its handler can reach it, and the dropzone carries what the projection says about it — both
 * are parts this file has something to put in. Everything else beneath them is drawn by the same walk
 * the other components use, at whatever depth the contract declares.
 */
import { computed, defineComponent, h, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createFileFieldController,
  type MdyFileFieldController,
} from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";
import { drawDeclaredUnder, partProps } from "./part.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.file;

export const MdyFileField = defineComponent({
  name: "MdyFileField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<readonly File[]>>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
  },
  setup(props) {
    const controller: MdyFileFieldController<File> = createFileFieldController<File>({
      handle: props.field,
      widgetId: props.widgetId,
    });
    const view = computed(() => controller.view());
    /** Which element holds the control, asked rather than named. */
    const holder = String(CONTRACT.structure.nodes.find((node) => node.part === "control")?.parent);

    return () => {
      const parts = view.value.parts;
      const children: VNode[] = [];
      // The caption names the control it belongs to, which `MDY_WIDGET_RELATIONS` declares and the
      // kit checks. The projection gives this kind's control no id of its own, so the label is given
      // the one the widget is identified by — the same id the control carries.
      if (props.label !== "") {
        children.push(h("label", partProps(parts.label, { for: props.widgetId }), props.label));
      }

      children.push(h("div", partProps(parts.dropzone, { class: CONTRACT.parts.dropzone.classes.join(" ") }), [
        h("input", partProps(parts.control, {
          id: props.widgetId,
          type: CONTRACT.controlType,
          class: CONTRACT.parts.control.classes.join(" "),
          onChange: (event: Event) => controller.dispatch({
            type: "select",
            files: Array.from((event.target as HTMLInputElement).files ?? []),
          }),
        })),
        // Everything else the dropzone declares, to whatever depth: the content box, the button
        // inside it, and any required part a later release adds beneath either.
        ...(drawDeclaredUnder(CONTRACT, holder, (tag, attrs, kids) => h(tag, attrs, kids as VNode[]), new Set(["control"]), "file", props.field.disabled?.() === true) as VNode[]),
      ]));

      if (parts.description !== undefined) children.push(h("p", partProps(parts.description)));
      if (parts.error !== undefined) children.push(h("ul", partProps(parts.error)));
      return h("div", { class: CONTRACT.rootClasses.join(" ") }, children);
    };
  },
});
