/**
 * The checkbox and the toggle, which the catalogue declares as one shape wearing two affordances.
 *
 * Both put a native control and its false-carrying companion inside a wrapper, and both put the
 * painted part inside the label. What differs is only how deep that painted part goes: a checkbox
 * declares one node, a toggle declares a track with a thumb inside it. **Neither is named here.**
 * The label's children are built by walking the parts the structure declares under it, so the two
 * kinds differ in this file by nothing at all — and a third kind of the same shape would draw
 * correctly the day it is declared rather than the day somebody edits this.
 *
 * The companion that carries `false` is found rather than invented: it has a class and a semantic
 * that discriminates, so the projection is applied to it like any other part. Before it had those,
 * a renderer had to know to draw a hidden input and what to put on it.
 */
import { computed, defineComponent, h, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createBooleanFieldController,
  type MdyBooleanFieldController,
} from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";
import { partProps } from "./part.js";

/** What a declared element is drawn as, where the contract does not mean a real control. */
const TAG_FOR_ELEMENT: Readonly<Record<string, string>> = Object.freeze({
  group: "span", presentation: "span", container: "div", text: "span",
});

export const MdyBooleanField = defineComponent({
  name: "MdyBooleanField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<boolean>>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
    kind: { type: String as PropType<"checkbox" | "toggle">, default: "checkbox" },
  },
  setup(props) {
    const contract = MDY_WIDGET_CONTRACTS[props.kind];
    const controller: MdyBooleanFieldController = createBooleanFieldController({
      handle: props.field,
      widgetId: props.widgetId,
      // The variant is the control's declared role, not the kind's name. The controller knows this
      // distinction as `checkbox` or `switch`, and the catalogue already states which each kind is —
      // so mapping `toggle` to `switch` here by hand would be a second spelling of a fact the
      // contract holds, and the spelling that stops moving when the contract changes.
      variant: contract.parts.control.role === "switch" ? "switch" : "checkbox",
    });
    const view = computed(() => controller.view());

    /**
     * The parts the structure puts under one parent, drawn as declared.
     *
     * Required only: an optional part is one a renderer may leave out, and drawing every declared
     * node would put a required marker on a field that has none and an inline error where there is
     * no error. Recursive because the declaration is a tree — the toggle's thumb is inside its
     * track, and flattening the two would draw a shape the contract does not describe.
     */
    const drawUnder = (parent: string): VNode[] => contract.structure.nodes
      .filter((node) => node.parent === parent && node.optional !== true)
      .map((node) => h(
        TAG_FOR_ELEMENT[String(node.element)] ?? "span",
        // Indexed through a widened view of the map: the two kinds declare different parts under the
        // label, so the union of their keys is what a walk over either can reach.
        { class: (contract.parts as Readonly<Record<string, { classes: readonly string[] }>>)[node.part]?.classes.join(" ") },
        drawUnder(String(node.part)),
      ));

    return () => {
      const parts = view.value.parts;
      const children: VNode[] = [
        // The control's classes come from the catalogue, not from the projection: the projection
        // carries ids, names and ARIA, and for some kinds it carries no class at all. A text field's
        // control declares none, so a renderer reading only the projection is right there and wrong
        // wherever a kind dresses its control — which is every kind that paints one.
        h("input", partProps(parts.input, {
          class: contract.parts.control.classes.join(" "),
          // The intent the kind declares for a press, not a value written over the top: `check` and
          // `uncheck` are what the controller answers, and a renderer that set the value directly
          // would be deciding what the transition means.
          onChange: (event: Event) => controller.dispatch({
            type: (event.target as HTMLInputElement).checked ? "check" : "uncheck",
          }),
        })),
        // Between the control and the caption, where the contract places it — never ahead of the
        // control, since the first input in a field is the most obvious selector anybody writes.
        h("input", partProps(parts.submitFalse)),
        // The caption names the control it belongs to. `MDY_WIDGET_RELATIONS` declares that link and
        // the kit checks it; the id is the projection's, so this wires two declared things together
        // rather than inventing either. The text field's projection carries the `for` itself, this
        // kind's does not, and a renderer cannot tell which without looking — so it is set from the
        // control's own id, which is right in both cases.
        h("label", partProps(parts.label, { for: parts.input?.id }), [...drawUnder("label"), props.label]),
      ];

      const outer: VNode[] = [
        h("div", { class: contract.parts.inputWrapper.classes.join(" ") }, children),
      ];
      if (parts.description !== undefined) outer.push(h("p", partProps(parts.description)));
      if (parts.error !== undefined) outer.push(h("ul", partProps(parts.error)));

      return h("div", { class: contract.rootClasses.join(" ") }, outer);
    };
  },
});
