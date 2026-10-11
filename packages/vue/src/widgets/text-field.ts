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
import { computed, defineComponent, h, onScopeDispose, ref, shallowRef, triggerRef, type PropType, type VNode } from "vue";
import { labelContent } from "./label.js";
import {
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_WIDGET_CONTRACTS,
  blocksValueChange,
  createTextFieldController,
  narrowConstraints,
  type MdyPartContract,
  type MdyTextFieldController,

  numberEntered,} from "@modyra/widgets";
import { observerFor } from "@modyra/core";
import type { MdyFieldConstraints, MdyFieldHandle } from "@modyra/core";
import { partProps, rootClasses, labelStateClasses, shellStateOf, wrapperClasses } from "./part.js";
import { drawErrors } from "./errors.js";
import { useKeyboardInPlay } from "./keyboard-in-play.js";
import { useFormReset } from "./form-reset.js";
import { iconOf } from "./icon.js";
import { widgetIdOf } from "./widget-id.js";

const NUMBER = MDY_WIDGET_CONTRACTS.number;

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
    /**
     * The field this control is bound to.
     *
     * A union of handles, not a handle of unions: one component draws both shapes — the text kinds
     * hold a string and `number` holds a number, which is what its own value contract says — and a
     * handle's type argument is invariant, so `MdyFieldHandle<string>` is not a
     * `MdyFieldHandle<string | number>`. Written the second way, every document already passing a
     * string handle would have stopped compiling for a change it does not make.
     *
     * Declared as `string` alone, the component could not convert what a person typed without
     * contradicting its own type — so it did not, and the model held `"1"` where every rule about
     * bounds expected `1`.
     */
    field: {
      type: Object as PropType<MdyFieldHandle<string> | MdyFieldHandle<number | null>>,
      required: true,
    },
    label: { type: String, default: "" },
    /**
     * What every part's id is built from. Derived from the field's path when a document says
     * nothing, so two forms built from one document do not both claim `when__label`.
     */
    widgetId: { type: String, required: false, default: undefined },
    /** Which form on the page this widget belongs to, where a host renders more than one. */
    idScope: { type: String, required: false, default: undefined },
    /** Which of the kinds that share this anatomy is being drawn. */
    kind: { type: String as PropType<"text" | "email" | "password" | "textarea" | "number">, default: "text" },
    /** The name a control has when nothing on the page captions it. */
    ariaLabel: { type: String, default: "" },
    /**
     * The words under the control — a format, a limit, why the field is there.
     *
     * Handed to the projection, which names the element holding them in `aria-describedby` only
     * when there are words: a reference to an empty element costs a reader the move and teaches
     * them not to follow the next one.
     */
    supportingText: { type: String, required: false, default: undefined },
    placeholder: { type: String, default: "" },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    step: { type: Number, default: undefined },
  },
  setup(props) {
    // Every part's id comes from here: what the document named, or the field's own path with the
    // form's scope in front — two forms built from one document would otherwise both claim
    // `when__label`, and a reference from the second resolves into the first.
    const widgetId = computed(() => widgetIdOf({ widgetId: props.widgetId, idScope: props.idScope, field: props.field }));
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
    const controller: MdyTextFieldController<string | number | null> = createTextFieldController<string | number | null>({
      supportingText: () => props.supportingText ?? null,
      handle: props.field,
      widgetId: widgetId.value,
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
    useFormReset(props.field as object, root);
    const view = shallowRef(controller.view());
    const watching = reactivity.effect(() => {
      view.value = controller.view();
      triggerRef(view);
    });
    onScopeDispose(() => { watching.destroy(); controller.destroy(); });

    /**
     * One of the two controls a number field is declared to have.
     *
     * Without them the kind's trailing promise was kept by the platform's own spinner or by nothing,
     * depending on the browser. A press steps through the same intent typing does, by the field's
     * step and within its bounds, so a stepped value meets the field's rules on the way in. Out of the
     * tab order: the box itself takes the arrows, and two more stops per number field would charge a
     * keyboard user for an affordance the pointer needed.
     */
    const stepper = (direction: 1 | -1, part: MdyPartContract, label: string): VNode =>
      h("button", {
        type: "button",
        class: part.classes.join(" "),
        tabindex: -1,
        "aria-label": label,
        // Out of play with the field: a stepper that still answers beside a disabled box is disabled
        // in appearance only.
        disabled: blocksValueChange(controller.state().interactivity),
        onClick: () => {
          if (blocksValueChange(controller.state().interactivity)) return;
          const rules = narrowConstraints(props.field.constraints(), narrowing());
          const by = typeof rules.step === "number" && rules.step > 0 ? rules.step : 1;
          const from = typeof props.field.value() === "number" ? props.field.value() as number : 0;
          const min = typeof rules.min === "number" ? rules.min : -Infinity;
          const max = typeof rules.max === "number" ? rules.max : Infinity;
          controller.dispatch({ type: "input", value: Math.min(max, Math.max(min, from + by * direction)) });
        },
      }, [iconOf(direction === 1 ? "SPIN_UP" : "SPIN_DOWN")]);

    return () => {
      const parts = view.value.parts;
      // What the field is in, once per render: the root, the wrapper and the caption all reflect it.
      const shell = shellStateOf(props.kind, props.field);
      const children: VNode[] = [];

      // Drawn only when the field was given words to show, which is what the contract's `optional`
      // says about it — not omitted to save an element.
      if (props.label !== "") {
        children.push(h("label", partProps(parts.label, { class: labelStateClasses(shell) }), labelContent(props.label, props.field)));
      }

      const control = h(tag, partProps(parts.input, {
          // The value the model holds, on the control that shows it.
          //
          // Left unbound, the box showed only what a person had typed into it: a value arriving from
          // anywhere else — a draft restored, a server correction, a cross-field rule — reached the
          // form and never the screen. That is the whole of what a field handle is for, and this is
          // the renderer that was not delivering it.
          value: props.field.value() ?? "",
          // Two the projection does not carry, and both belong on the control a person types into:
          // a hint shown inside the empty box, and the name it has where nothing captions it.
          ...(props.placeholder === "" ? {} : { placeholder: props.placeholder }),
          ...(props.ariaLabel === "" ? {} : { "aria-label": props.ariaLabel }),
          // Three lines at rest, said in lines rather than a length, so it still means three lines
          // when a person has enlarged their text. ADR 0181.
          ...(tag === "textarea" ? { rows: 3 } : {}),
          onInput: (event: Event) => controller.dispatch({
            type: "input",
            // A numeric field holds a number, so the box's text is converted before it reaches the
            // model. Left as it was typed, the model held `"1"` where the contract says `1`, and
            // every rule about bounds was judging text — which compares by spelling, so `"10"` is
            // below `"9"`.
            value: props.kind === "number"
              ? numberEntered((event.target as HTMLInputElement).value)
              : (event.target as HTMLInputElement).value,
          }),
        }));
      children.push(h("div", { class: wrapperClasses(contract.parts.inputWrapper.classes, shell) }, [
        props.kind === "number" ? h("span", { class: NUMBER.presentationClasses.spinner }, [
          control,
          stepper(1, NUMBER.parts.increment, MDY_I18N_MESSAGES_DEFAULT.increase),
          stepper(-1, NUMBER.parts.decrement, MDY_I18N_MESSAGES_DEFAULT.decrease),
        ]) : control,
      ]));

      if (parts.description !== undefined) children.push(h("p", partProps(parts.description), parts.description.content?.text ?? ""));
      // The list and what is in it. Framed and left empty, it was a reference `aria-describedby`
      // points at that explains nothing.
      if (parts.error !== undefined) {
        children.push(drawErrors(parts.error, props.field, props.kind));
      }

      return h("div", { class: rootClasses(contract, shell), ref: root }, children);
    };
  },
});
