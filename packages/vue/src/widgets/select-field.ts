/**
 * The select, in the shape that has a panel of ours: a trigger, a filter box and a list.
 *
 * The other shape is the platform's own chooser — `variantOf` answers `native` whenever the field
 * does not filter — and it is not drawn here: it has no popup, no landing place for focus and no
 * keyboard model this file could add without taking one away.
 *
 * **Every behaviour below is read from a door, not decided here.** Where focus goes when the panel
 * opens is `focusPartOnOpen`; which key opens, moves, commits or cancels is `keyBindingFor`; whether
 * Tab stays inside is `popupHoldsAnAction`, which answers `false` for this kind, so Tab leaves and
 * the panel closes behind it. A renderer that instead lists key names drifts from the contract the
 * moment the contract gains one, and nothing tells it.
 */
import { Teleport, defineComponent, h, nextTick, onScopeDispose, ref, shallowRef, triggerRef, watch, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createSelectFieldController,
  defaultWidgetIdFactory,
  focusPartOnOpen,
  keyBindingFor,
  variantOf,
  defaultOptionKey,

  visibleErrorsOf,} from "@modyra/widgets";
import { observerFor } from "@modyra/core";
import type { MdyFieldHandle, MdySelectOption } from "@modyra/core";
import { partProps, rootClasses } from "./part.js";
import { drawErrors } from "./errors.js";
import { useKeyboardInPlay } from "./keyboard-in-play.js";
import { useCloseWhenFieldLeaves } from "./field-teardown.js";
import { useDismissOnFocusOutside } from "./dismiss-on-focus-outside.js";
import { useOverlayOpen } from "./overlay-open.js";
import { useAnchoredPanel } from "./anchored-panel.js";
import { useLightDismiss } from "./light-dismiss.js";
import { useCommands } from "./commands.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.select;
const classesOf = (part: string): string =>
  (CONTRACT.parts as Readonly<Record<string, { classes: readonly string[] } | undefined>>)[part]?.classes.join(" ") ?? "";

/**
 * The errors part this kind's projection does not publish.
 *
 * `createSelectFieldController` projects the trigger, the filter and the list, and none of the
 * shell — no label, no description, no errors. Every renderer therefore spells those ids itself,
 * which this file already does for the first two; this is the third. The id is the factory's, so it
 * matches what `aria-describedby` points at.
 *
 * A finding rather than a design: a kind whose shell parts are absent from its projection cannot be
 * drawn from the contract, and four renderers each invent the same three ids.
 */
const errorsPartFor = (widgetId: string) => ({
  id: defaultWidgetIdFactory.part(widgetId, "errors"),
  classes: CONTRACT.parts.errors?.classes ?? [],
  attributes: {},
});

export const MdySelectField = defineComponent({
  name: "MdySelectField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<string | null>>, required: true },
    options: { type: Array as PropType<readonly MdySelectOption<string>[]>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
    placeholder: { type: String, default: "Select…" },
    /**
     * Whether this select filters. It decides the shape rather than an option on it: `variantOf`
     * answers `custom` for a select that filters and `native` for one that does not, and the two
     * are different controls — a combobox this package draws, and the chooser the platform draws
     * and owns the keyboard of. The default is the contract's default, so a field configured the
     * same way is the same control in every adapter.
     */
    searchable: { type: Boolean, default: false },
  },
  setup(props) {
    // The runtime the handle already owns, never a fresh one: two instances of the same factory
    // are two different owners, and the second is refused the first's signals at runtime with
    // nothing rendered to show for it.
    const reactivity = observerFor(props.field);
    const controller = createSelectFieldController<string>({
      handle: props.field,
      widgetId: props.widgetId,
      options: props.options,
      searchable: props.searchable,
      // The panel's open/closed, the filter text and the reading position live inside the
      // controller, not on the field handle, so this component has to hand it the runtime that
      // makes them observable here. Without it the controller still works and every read is
      // correct — and nothing re-renders, which looks exactly like a renderer that ignores a click.
    }, reactivity);
    // The panel's open/closed, the filter text and the reading position live inside the controller
    // rather than on the field handle. A `computed` over them reads correctly once and never again:
    // it has nothing of vue's to track, so the first render is right and every later one is stale —
    // which on screen is a control that ignores the click that opened it.
    // The panel leaves the field and is positioned against the trigger: inside, it inherits the
    // `overflow` and the stacking of every ancestor, and a list clipped by a scrolling pane is a
    // list a person cannot finish reading. ADR 0130.
    // The branch a dismissal starts from; the contract reaches out to the panel itself.
    const root = ref<HTMLElement | null>(null);
    useKeyboardInPlay(props.field as never, root);
    // And what the field holds open, when the field itself goes. This package draws its panels
    // outside the field, so nothing carries them away with it.
    useCloseWhenFieldLeaves(root, () => run(controller.dispatch({ type: "close", restoreFocus: false })));
    const panel = ref<HTMLElement | null>(null);
    const anchor = ref<HTMLElement | null>(null);

    const state = shallowRef(controller.state());
    // And when the keyboard settles somewhere else: every kind with a popup declares it, and this
    // package honoured it nowhere.
    // Shown through the door that also makes it a popover, which is what the foundation reads
    // to lay it out against the viewport — the system `anchorOverlay` measured in.
    useOverlayOpen(panel, () => state.value.open);

    useDismissOnFocusOutside({
      kind: "select",
      root,
      panel,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close", restoreFocus: false })),
    });
    const view = shallowRef(controller.view());
    // What the controller answers is half of every interaction, and the half a screenshot does not
    // show: `restore-focus` after a dismissal is what puts the person back on the control they
    // opened. Dropped, the keyboard is left on nothing and the next Tab starts at the top of the page.
    const run = useCommands("select", view, root);
    const watching = reactivity.effect(() => {
      // Which of the two texts under the field the trigger describes itself by, told to the
      // controller rather than decided here: the projection publishes the reference, and a renderer
      // that never says which one leaves the trigger describing the hint while the field is being
      // refused — the reason is on the page, correct, and announced to nobody.
      const errorsVisible = visibleErrorsOf(props.field, "select").length > 0;
      controller.setDescribedBy({ errorsVisible, descriptionVisible: !errorsVisible });
      state.value = controller.state();
      view.value = controller.view();
      triggerRef(state);
      triggerRef(view);
    });
    onScopeDispose(() => { watching.destroy(); controller.destroy(); });

    /**
     * Focus follows the panel, and where it lands is the contract's answer rather than this file's.
     * It is applied after the panel is in the document: focusing a part that is still one render
     * away silently does nothing, and the field then looks like a renderer that ignores the rule.
     */
    /**
     * Focus follows the panel opening, wherever the opening came from.
     *
     * Driven by the state rather than called from each handler: the controller's signals reach vue
     * a beat after the dispatch, so a handler that focuses straight after opening looks for an
     * element the renderer has not drawn yet and finds nothing — silently, because there is nothing
     * wrong with the lookup. Watching the state means the search happens after the panel exists,
     * and it covers every way of opening, including the ones this component does not handle.
     */
    useLightDismiss({
      kind: "select",
      root,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close", restoreFocus: false })),
    });

    useAnchoredPanel({ kind: "select", panel, anchor, isOpen: () => state.value.open });

    watch(() => state.value.open, async (open) => {
      const part = open ? focusPartOnOpen("select", { searchable: props.searchable }) : null;
      if (part === null) return;
      await nextTick();
      // By the id the projection publishes, never by class: two selects carry the same classes and
      // different ids, and the id is the one the trigger already points at.
      const id = (view.value.parts as Record<string, { readonly id?: string } | undefined>)[part]?.id;
      const target = id === undefined ? null : document.getElementById(id);
      if (target instanceof HTMLElement) target.focus();
    });

    const onKeydown = (event: KeyboardEvent): void => {
      const binding = keyBindingFor("select", event, state.value.open);
      if (!binding) return;
      const wasOpen = state.value.open;
      switch (binding.intent) {
        case "open":
          run(controller.dispatch({ type: "open", source: "keyboard" }));
          event.preventDefault();
          return;
        case "cancel":
          // Tab is a cancel here, and the one key that must keep its own meaning: the panel closes
          // and the browser moves on. Swallowing it would make this field a place a person can
          // enter and not leave. `popupHoldsAnAction` is what says this kind has nothing in its
          // panel worth staying for.
          // Escape leaves the person on the control they opened, and says so; Tab is on its way
          // somewhere and pulling focus back would strand it on the field just left. The shared
          // policy states the difference, and the panel closes after focus is settled either way.
          run(controller.dispatch({ type: "close", restoreFocus: event.key !== "Tab" }));
          if (event.key !== "Tab") event.preventDefault();
          return;
        case "move":
          if (!wasOpen) return;
          run(controller.dispatch({ type: "move", target: (binding.by ?? 1) > 0 ? "next" : "previous" }));
          event.preventDefault();
          return;
        case "commit": {
          // What "commit" means for a list is "take the one the reading position is on"; the
          // controller names that key itself, so no second copy of "which option is active".
          const active = state.value.activeKey;
          if (!wasOpen || active === null) return;
          run(controller.dispatch({ type: "select", optionKey: active }));
          event.preventDefault();
          return;
        }
        default:
          return;
      }
    };

    /**
     * The platform's chooser.
     *
     * A `<select>` is the control, the list and the keyboard model at once, so there is nothing here
     * to open and nothing to put focus into — which is why `focusPartOnOpen` answers `null` for this
     * shape. It must not claim otherwise either: `aria-expanded`, `aria-controls` and
     * `aria-haspopup` on a `<select>` describe a combobox that is not there, and the projection
     * leaves them out for a field that does not filter.
     *
     * The entry for "nothing chosen" has to exist, because a native chooser can only show that state
     * by having an option for it: without one, index 0 is a real choice, the control reads the first
     * label while the form holds nothing, and the field looks answered when it is not.
     */
    const drawNative = (): VNode => {
      const parts = view.value.parts;
      const children: VNode[] = [];
      if (props.label !== "") {
        children.push(h("label", {
          id: defaultWidgetIdFactory.part(props.widgetId, "label"),
          for: defaultWidgetIdFactory.part(props.widgetId, "trigger"),
          class: classesOf("label"),
        }, props.label));
      }
      children.push(h("div", { class: classesOf("inputWrapper") }, [
        h("select", partProps(parts.trigger, {
          name: props.widgetId,
          onChange: (event: Event) =>
            run(controller.dispatch({ type: "select", optionKey: (event.target as HTMLSelectElement).value })),
        }), [
          h("option", { class: classesOf("placeholder"), value: "", disabled: true,
            selected: state.value.selectedKey === null }, props.placeholder),
          ...state.value.options.map((option) => h("option", {
            value: String(option.value),
            selected: String(option.value) === state.value.selectedKey,
          }, option.label)),
        ]),
        // The foundation takes the platform's arrow off every native chooser so a page of them
        // reads as one page, and a kind that removes an affordance owes one back. Beside the
        // control, never inside it: an `<option>` is the only thing a `<select>` may contain.
        h("span", { class: classesOf("arrow"), "aria-hidden": "true" }),
      ]));
      children.push(h("p", {
        id: defaultWidgetIdFactory.part(props.widgetId, "description"),
        class: classesOf("supportingText"),
      }));
      // The same list the combobox shape draws. A kind does not stop owing an explanation because
      // the platform draws its chooser: `invalid` requires the part in both shapes, and only one of
      // them had it.
      children.push(drawErrors(errorsPartFor(props.widgetId), props.field, "select"));
      return h("div", { class: rootClasses(CONTRACT, { touched: props.field.touched() }) }, children);
    };

    return () => {
      if (variantOf("select", { searchable: props.searchable }) === "native") return drawNative();
      const parts = view.value.parts;
      const open = state.value.open;
      // The controller's list, not the prop: it has already reconciled a held value the options do
      // not contain, and looking in the prop list leaves that value invisible — the field shows a
      // placeholder while holding something a person can neither see nor replace.
      const selected = state.value.options.find((option) => String(option.value) === state.value.selectedKey);
      const children: VNode[] = [];

      // The trigger's name is a relation to this element, and the projection points it at the id
      // the factory spells. Left off, `aria-labelledby` names nothing and the control has no name
      // at all — worse than an unlabelled one, because the markup looks answered.
      if (props.label !== "") {
        children.push(h("label", {
          id: defaultWidgetIdFactory.part(props.widgetId, "label"),
          // The label names the trigger both ways: the relation the projection points at, and the
          // `for` that makes the caption itself a way to reach the control.
          for: defaultWidgetIdFactory.part(props.widgetId, "trigger"),
          class: classesOf("label"),
        }, props.label));
      }

      children.push(h("div", { class: classesOf("inputWrapper") }, [
        h("button", partProps(parts.trigger, {
          ref: anchor,
          type: "button",
          onClick: () => {
            run(controller.dispatch(open ? { type: "close", restoreFocus: false } : { type: "open", source: "pointer" }));
          },
        }), [
          selected === undefined
            ? h("span", { class: classesOf("placeholder") }, props.placeholder)
            : h("span", { class: classesOf("value") }, selected.label),
        ]),
        // Beside the trigger, because that is where the contract puts it: `arrow` declares
        // `inputWrapper` as its parent, and moving it inside the button contradicted a rule the
        // suite guards. The press reaching the button is a matter of geometry instead — the trigger
        // stretches under the caret, and the caret takes no pointer.
        h("span", { class: classesOf("arrow"), "aria-hidden": "true" }),
      ]));

      {
        // Out of the field and against the trigger. Inside, the panel inherits the `overflow` and
        // the stacking of every ancestor: a list clipped by a scrolling pane is a list a person
        // cannot finish reading. ADR 0130.
        // Shut until it is opened. The panel stays in the document while it is closed, so that what
        // names it keeps naming something — and without this it stayed *shown* as well: the list
        // was on the page from the moment the field was mounted while the trigger said it was
        // closed, so a person looking and a person listening were told different things.
        children.push(h(Teleport, { to: "body" }, [h("div", { ref: panel, class: classesOf("popup"), hidden: !open, onKeydown }, [
          h("input", partProps(parts.search, {
            value: state.value.query,
            onInput: (event: Event) =>
              run(controller.dispatch({ type: "search", query: (event.target as HTMLInputElement).value })),
          })),
          h("ul", partProps(parts.options),
            // The controller's list, not the prop: it is the one that has already reconciled a held
            // value the options do not contain, and drawing the prop instead hides it from the
            // person holding it.
            state.value.options.map((option) => h("li", partProps(parts[defaultOptionKey(option.value)], {
                onClick: () => run(controller.dispatch({ type: "select", optionKey: defaultOptionKey(option.value) })),
            }), option.label))),
        ])]));
      }

      // Named by `aria-describedby` on every render, so it exists on every render: a description a
      // renderer draws only when it has text is a reference to nothing the rest of the time.
      children.push(h("p", {
        id: defaultWidgetIdFactory.part(props.widgetId, "description"),
        class: classesOf("supportingText"),
      }));
      // The list and what is in it. Framed and left empty, it was a reference `aria-describedby`
      // points at that explains nothing.
      // The same list the platform-chooser shape draws, and from the same place: this kind's
      // projection publishes no shell parts, so the id is the factory's in both shapes.
      children.push(drawErrors(errorsPartFor(props.widgetId), props.field, "select"));

      return h("div", { class: rootClasses(CONTRACT, { touched: props.field.touched(), open: state.value.open }), ref: root, onKeydown }, children);
    };
  },
});
