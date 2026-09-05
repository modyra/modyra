/**
 * The multiselect: chips for what is held, and a panel of chips for what can be.
 *
 * The largest kind in the catalogue, and the one where every rule this package learned has to hold
 * at once — the variant read from the mode, the repetition inherited from the parent, the reading
 * position announced through the projection, and the per-row key for the quantity.
 *
 * **The mode is the shape, and it is a closed set.** `single` is a set of toggles; `multi` is a bag
 * where a choice can be taken more than once, and it owes a stepper and a count on every row. The
 * contract names both, and a mode outside the two produces a variant name the catalogue does not
 * declare — which downstream means *no* variant requirements rather than a refusal, so the checks
 * for the shape quietly stop applying. That is why this component takes the declared type rather
 * than a string.
 */
import { computed, Teleport, defineComponent, h, ref, nextTick, onScopeDispose, shallowRef, triggerRef, watch, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createMultiselectFieldController,
  defaultWidgetIdFactory,
  focusPartOnOpen,
  keyBindingFor,

  MDY_CHIP_CLASSES,  MDY_POPUP_OPENERS,
  MDY_I18N_MESSAGES_DEFAULT,
  multiselectAnnouncement,
  chipMovedAnnouncement,
  quantityAnnouncement,
  chipActionName,
} from "@modyra/widgets";
import { observerFor } from "@modyra/core";
import type { MdyFieldHandle, MdyMultiselectMode, MdySelectOption } from "@modyra/core";
import { partProps, type MdyDeclaredPart, rootClasses } from "./part.js";
import { drawErrors } from "./errors.js";
import { useKeyboardInPlay } from "./keyboard-in-play.js";
import { useCloseWhenFieldLeaves } from "./field-teardown.js";
import { useDismissOnFocusOutside } from "./dismiss-on-focus-outside.js";
import { useOverlayOpen } from "./overlay-open.js";
import { useAnchoredPanel } from "./anchored-panel.js";
import { useLightDismiss } from "./light-dismiss.js";
import { useCommands } from "./commands.js";
import { widgetIdOf } from "./widget-id.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.multiselect;
const declared = CONTRACT.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";
/**
 * The part a pointer may press to open the panel, over and above the opener that carries the ARIA.
 *
 * Asked of the catalogue rather than named here: a kind that stops declaring a second door stops
 * getting a handler for it, and one that starts declaring it gets one without this file changing.
 *
 * The second door carries no relation of its own (ADR 0177) — `aria-expanded` and `aria-controls`
 * belong to the one opener, because two elements claiming them announce two comboboxes for one list.
 * That is the right decision and it has a consequence: **nothing shaped like a keyboard check or an
 * attribute check can see this door**, and the only question that reaches it is a pointer press.
 */
const POINTER_DOOR = MDY_POPUP_OPENERS.multiselect?.alsoOpensFrom;
const roleOf = (part: string): string | undefined => declared[part]?.role ?? undefined;

export const MdyMultiselectField = defineComponent({
  name: "MdyMultiselectField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<readonly string[]>>, required: true },
    options: { type: Array as PropType<readonly MdySelectOption<string>[]>, required: true },
    label: { type: String, default: "" },
    /**
     * What every part's id is built from. Derived from the field's path when a document says
     * nothing, so two forms built from one document do not both claim `when__label`.
     */
    widgetId: { type: String, required: false, default: undefined },
    /** Which form on the page this widget belongs to, where a host renders more than one. */
    idScope: { type: String, required: false, default: undefined },
    mode: { type: String as PropType<MdyMultiselectMode>, default: "single" },
    searchable: { type: Boolean, default: false },
  },
  setup(props) {
    // Every part's id comes from here: what the document named, or the field's own path with the
    // form's scope in front — two forms built from one document would otherwise both claim
    // `when__label`, and a reference from the second resolves into the first.
    const widgetId = computed(() => widgetIdOf({ widgetId: props.widgetId, idScope: props.idScope, field: props.field }));
    const reactivity = observerFor(props.field);
    const controller = createMultiselectFieldController<string>({
      handle: props.field,
      widgetId: widgetId.value,
      options: props.options,
      mode: props.mode,
    }, reactivity);

    // Measured and placed against the control that opens it, and drawn outside the field so it
    // does not inherit an ancestor's `overflow` or stacking. ADR 0130.
    // The branch a dismissal starts from; the contract reaches out to the panel itself.
    const root = ref<HTMLElement | null>(null);
    useKeyboardInPlay(props.field as never, root);
    // And what the field holds open, when the field itself goes. This package draws its panels
    // outside the field, so nothing carries them away with it.
    useCloseWhenFieldLeaves(root, () => run(controller.dispatch({ type: "close" })));
    const panel = ref<HTMLElement | null>(null);
    const anchor = ref<HTMLElement | null>(null);

    const state = shallowRef(controller.state());
    // And when the keyboard settles somewhere else: every kind with a popup declares it, and this
    // package honoured it nowhere.
    // Shown through the door that also makes it a popover, which is what the foundation reads
    // to lay it out against the viewport — the system `anchorOverlay` measured in.
    // The default table: this component declares no locale, so there is no document-declared
    // language to read one from. Every other kind that opens a panel has a `locale` prop and this
    // one does not — recorded rather than papered over, because a document that switches language
    // gets English here and nowhere else.
    useOverlayOpen(panel, () => state.value.open, () => MDY_I18N_MESSAGES_DEFAULT);

    useDismissOnFocusOutside({
      kind: "multiselect",
      root,
      panel,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close" })),
    });
    const view = shallowRef(controller.view());
    // What the controller answers is half of every interaction, and the half a screenshot does not
    // show: `restore-focus` after a dismissal is what puts the person back on the control they
    // opened. Dropped, the keyboard is left on nothing and the next Tab starts at the top of the page.
    const run = useCommands("multiselect", view, root, undefined, props.field as never);
    useLightDismiss({
      kind: "multiselect",
      root,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close", restoreFocus: false })),
    });

    useAnchoredPanel({ kind: "multiselect", panel, anchor, isOpen: () => state.value.open });
    /**
     * What was said last, so the next sentence can describe a change rather than a state.
     *
     * The policy needs both sides: it names what was added and what was taken since the reader was
     * last told, and a renderer that passed only the present would say the whole selection every
     * time anything moved.
     */
    let saidLast: readonly string[] = [...controller.state().selectedKeys].map(String);
    /** The order the values were in, and how many of each, when the reader was last told. */
    let orderLast = saidLast.join("\u0000");
    let countsLast = new Map(controller.state().counts);
    const announcement = ref("");

    const watching = reactivity.effect(() => {
      state.value = controller.state();
      view.value = controller.view();
      const chosen = [...state.value.selectedKeys].map(String);
      // A render describing no change leaves the region alone: writing "" over a sentence takes it
      // back before a reader has reached it, and a second pass over the same state is an ordinary
      // thing for a renderer to do.
      const sentence = multiselectAnnouncement(saidLast, chosen, {
        added: MDY_I18N_MESSAGES_DEFAULT.selectionAdded,
        removed: MDY_I18N_MESSAGES_DEFAULT.selectionRemoved,
        empty: MDY_I18N_MESSAGES_DEFAULT.selectionEmpty,
        removedLast: MDY_I18N_MESSAGES_DEFAULT.selectionRemovedLast,
        addedMany: MDY_I18N_MESSAGES_DEFAULT.selectionAddedMany,
        removedMany: MDY_I18N_MESSAGES_DEFAULT.selectionRemovedMany,
        removedManyLast: MDY_I18N_MESSAGES_DEFAULT.selectionRemovedManyLast,
      }, (key) => state.value.options.find((option) => String(option.value) === key)?.label ?? key);
      const labelOf = (key: string): string =>
        state.value.options.find((option) => String(option.value) === key)?.label ?? key;

      if (sentence !== null && sentence !== "") {
        announcement.value = sentence;
        saidLast = chosen;
        orderLast = chosen.join("\u0000");
        countsLast = new Map(state.value.counts);
      } else if (chosen.join("\u0000") !== orderLast) {
        // The same values in a different order: one of them was moved, and the sentence for that
        // names which and where it landed. Asked only where the selection did **not** change, so the
        // two policies never speak over each other about one act.
        const moved = chosen.find((key, at) => orderLast.split("\u0000")[at] !== key);
        if (moved !== undefined) {
          announcement.value = chipMovedAnnouncement(
            MDY_I18N_MESSAGES_DEFAULT.selectionMoved,
            labelOf(moved), chosen.indexOf(moved) + 1, chosen.length,
          );
        }
        orderLast = chosen.join("\u0000");
      } else {
        // A quantity that settled. Nothing is said for one that reached zero: the value is gone, and
        // its removal has its own sentence and its own way back.
        const stepped = chosen.find((key) => (state.value.counts.get(key) ?? 0) !== (countsLast.get(key) ?? 0));
        const count = stepped === undefined ? 0 : state.value.counts.get(stepped) ?? 0;
        if (stepped !== undefined && count > 0) {
          announcement.value = quantityAnnouncement(labelOf(stepped), count, {
            settled: MDY_I18N_MESSAGES_DEFAULT.quantitySettled,
            atMinimum: MDY_I18N_MESSAGES_DEFAULT.quantityAtMinimum,
          });
        }
        countsLast = new Map(state.value.counts);
      }
      triggerRef(state);
      triggerRef(view);
    });
    onScopeDispose(() => { watching.destroy(); controller.destroy(); });

    watch(() => state.value.open, async (open) => {
      if (!open) return;
      // The panel's primary unit: the filter box where there is one, and otherwise the first thing
      // that can be chosen. The contract answers which, per instance.
      const part = focusPartOnOpen("multiselect", { searchable: props.searchable });
      if (part === null) return;
      await nextTick();
      // Found through the panel element rather than a selector built from its id: an id needs
      // escaping to be a selector, `CSS.escape` is not everywhere, and the panel is already
      // addressable by the id the contract spells.
      const panel = document.getElementById(defaultWidgetIdFactory.part(widgetId.value, "popup"));
      const first = panel?.querySelector(`.${classesOf(part).split(" ")[0]}`);
      if (first instanceof HTMLElement) first.focus();
    });

    const onKeydown = (event: KeyboardEvent): void => {
      // Asked at the row first, then at the control. A binding declared `on` a part is invisible
      // from the control and is the only answer from that part, which is how one key means two
      // things without either declaration shadowing the other: ArrowLeft and ArrowRight step the
      // quantity of the row a person is on, and mean nothing at the control at all.
      const binding = keyBindingFor("multiselect", event, state.value.open, "option")
        ?? keyBindingFor("multiselect", event, state.value.open);
      if (!binding) return;
      switch (binding.intent) {
        case "open":
          run(controller.dispatch({ type: "open" }));
          break;
        case "cancel":
          // This panel holds nothing worth staying for, so Tab closes it and is left to the
          // browser; Escape closes it and is consumed.
          run(controller.dispatch({ type: "close", restoreFocus: event.key !== "Tab" }));
          if (event.key === "Tab") return;
          break;
        case "move":
          run(controller.dispatch({ type: "move", target: (binding.by ?? 1) > 0 ? "next" : "previous" }));
          break;
        case "toggle":
          run(controller.dispatch({ type: "select" }));
          break;
        case "step": {
          // The per-row quantity, and the reason this key exists: the steppers sit on a row, so a
          // tab stop cannot name which row it reaches — only a key pressed on the active one can.
          const active = state.value.activeKey;
          if (active === null) return;
          run(controller.dispatch((binding.by ?? 1) > 0
            ? { type: "increment", optionKey: active }
            : { type: "decrement", optionKey: active }));
          break;
        }
        default:
          return;
      }
      event.preventDefault();
    };

    /** One row in the panel. What it owes beyond its label is the variant's answer, not this file's. */
    const optionRow = (option: MdySelectOption<string>): VNode => {
      const key = String(option.value);
      const count = state.value.counts.get(key) ?? 0;
      return h("div", { class: classesOf("optionWrapper") }, [
        // The element is the variant's answer: a set of toggles draws each choice as a button,
        // while a bag draws a container with its own controls inside — and a button inside a button
        // is not a thing a browser will render.
        h(props.mode === "single" ? "button" : "div", partProps(view.value.parts[key], {
          ...(props.mode === "single" ? { type: "button" } : {}),
          onClick: () => run(controller.dispatch({ type: "toggle", optionKey: key })),
        }), [
          ...(props.mode === "single"
            ? [h("span", { class: classesOf("optionCheck"), "aria-hidden": "true" })]
            : [
              h("button", {
                type: "button", class: classesOf("optionStep"), "aria-label": `One fewer ${option.label}`,
                onClick: (event: Event) => {
                  event.stopPropagation();
                  run(controller.dispatch({ type: "decrement", optionKey: key }));
                },
              }, "−"),
              h("button", {
                type: "button", class: classesOf("optionStep"), "aria-label": `One more ${option.label}`,
                onClick: (event: Event) => {
                  event.stopPropagation();
                  run(controller.dispatch({ type: "increment", optionKey: key }));
                },
              }, "+"),
            ]),
          h("span", { class: classesOf("optionLabel") }, option.label),
          ...(props.mode === "multi" ? [h("span", { class: classesOf("optionCount") }, String(count))] : []),
        ]),
      ]);
    };

    return () => {
      const parts = view.value.parts;
      const children: VNode[] = [];

      if (props.label !== "") {
        children.push(h("label", {
          id: defaultWidgetIdFactory.part(widgetId.value, "label"),
          for: parts.trigger?.id,
          class: classesOf("label"),
        }, props.label));
      }

      // The controller's list, for the same reason: a chip is how a held value is seen and removed,
      // and a value missing from the declared options would otherwise be held with no chip at all.
      const held = state.value.options.filter((option) => state.value.selectedKeys.has(String(option.value)));
      children.push(h("div", { class: classesOf("inputWrapper") }, [
        h("div", {
          class: classesOf("box"),
          // Only when the press lands on the box itself. A chip inside it takes or moves that value,
          // and a press that did both would open the panel every time somebody removed something.
          ...(POINTER_DOOR === "box"
            ? {
              onClick: (event: Event) => {
                if (event.target !== event.currentTarget) return;
                run(controller.dispatch({ type: "toggleOpen" }));
              },
            }
            : {}),
        }, [
          // What is held, as a grid: one row of cells, which is how a screen reader counts them and
          // how the arrows walk them.
          h("div", partProps(parts.chips, { class: classesOf("chips"), role: roleOf("chips") }), [
            h("div", { class: classesOf("chipRow"), role: roleOf("chipRow") },
              held.map((option) => {
                const key = String(option.value);
                const held_ = state.value.counts.get(key) ?? 1;
                /** One of the chip's own controls, named for the act and the value it acts on. */
                const control = (part: "chipMove" | "chipStep" | "chipRemove", verb: string, act: () => void): VNode =>
                  h("button", {
                    type: "button", class: classesOf(part),
                    "aria-label": chipActionName(verb, option.label),
                    onClick: (event: Event) => { event.stopPropagation(); act(); },
                  });
                // **No handle to move a chip with, and that is deliberate.**
                //
                // `chipMove` is gated on the field offering `reorderable`, which this renderer has no
                // way to be told: the property exists on a field descriptor and this component takes
                // no such prop. Drawing the handles anyway put two buttons on every chip that could
                // not act — measured: pressing one, with the chip focused first, leaves the order
                // exactly as it was.
                //
                // The reason they cannot act is worth the sentence: `move` is resolved against the
                // *active* chip, which only the keyboard's roving focus sets — `focus` as an intent
                // returns nothing — so a pointer has no path to reordering at all. The renderers that
                // draw handles drive them by dragging, which this one does not implement.
                //
                // A control that says it does something and does nothing is the caret defect again,
                // one layer in. Until this offers reordering it draws no affordance for it.
                const moves: VNode[] = [];
                const later: VNode[] = [];
                // The quantity a chip holds is stepped on the chip. Two renderers drew these with the
                // class the contract reserves for a *list entry's* stepper and this one drew none —
                // an element nothing named, so nothing could ask for it.
                const steps = props.mode === "multi" ? [
                  control("chipStep", MDY_I18N_MESSAGES_DEFAULT.chipDecrementLabel,
                    () => run(controller.dispatch({ type: "decrement", optionKey: key }))),
                ] : [];
                const stepsUp = props.mode === "multi" ? [
                  control("chipStep", MDY_I18N_MESSAGES_DEFAULT.chipIncrementLabel,
                    () => run(controller.dispatch({ type: "increment", optionKey: key }))),
                ] : [];
                return h("span", { class: classesOf("chip"), role: roleOf("chip") }, [
                  ...moves, ...steps,
                  // The class the contract declares for it. Drawn bare, the words were a span nothing
                  // could address: the rule that truncates a chip's label on a narrow screen never
                  // matched, so the label sat at its text's width and the chip overflowed the row it
                  // had been capped to — the horizontal axis a page that already scrolls must not gain.
                  h("span", { class: MDY_CHIP_CLASSES.label }, option.label),
                  ...(props.mode === "multi"
                    ? [h("span", { class: classesOf("chipCount") }, held_ > 1 ? String(held_) : "")]
                    : []),
                  ...stepsUp, ...later,
                  control("chipRemove", MDY_I18N_MESSAGES_DEFAULT.chipRemoveLabel,
                    () => run(controller.dispatch({ type: "toggle", optionKey: key }))),
                ]);
              })),
          ]),
          // A button, not a text box: the placeholder lives *inside* it, and an `<input>` cannot
          // hold anything. What a person types goes in the panel's filter, not here.
          h("button", partProps(parts.trigger, {
            ref: anchor,
            type: "button",
            onClick: () => run(controller.dispatch({ type: "toggleOpen" })),
          }), [
            h("span", partProps(parts.placeholder, { class: classesOf("placeholder") }), "Choose…"),
          ]),
          // The way back from a destructive act, and the one control that must exist whether or not
          // there is anything to undo: a button that appears only once something is lost is a
          // button nobody knows is there.
          h("button", {
            type: "button", class: classesOf("wayBackAction"),
            // Drawn at all times, so it has to say whether it can act — and say it with
            // `aria-disabled`, which leaves it in the tree and announced, rather than with
            // `disabled`, which takes it out of the reading order the moment there is nothing to
            // undo. A control that comes and goes moves the one beside it under the hands of
            // somebody aiming at it.
            "aria-disabled": String(state.value.wayBack === null),
            onClick: () => run(controller.dispatch({ type: "undo" })),
          }, "Undo"),
          h("button", {
            type: "button", class: classesOf("clearAll"), "aria-label": "Clear all",
            "aria-disabled": String(state.value.selectedKeys.size === 0),
            onClick: () => run(controller.dispatch({ type: "clear" })),
          }),
          h("span", { class: classesOf("arrow"), "aria-hidden": "true" }),
          h("span", partProps(parts.announcement, { class: classesOf("announcement") }),
            announcement.value),
        ]),
      ]));

      children.push(h(Teleport, { to: "body" }, [h("div", partProps(parts.popup, { ref: panel, class: classesOf("popup"), onKeydown }), [
        ...(props.searchable
          ? [h("input", partProps(parts.search, {
            type: "text",
            value: state.value.query,
            onInput: (event: Event) =>
              run(controller.dispatch({ type: "search", query: (event.target as HTMLInputElement).value })),
          }))]
          : []),
        h("div", partProps(parts.group, { class: classesOf("options"), role: roleOf("options") }),
          state.value.options.map(optionRow)),
      ])]));

      children.push(h("p", {
        id: defaultWidgetIdFactory.part(widgetId.value, "description"),
        class: classesOf("supportingText"),
      }));

      // The list the description points at, and what is in it. Absent, `aria-describedby`
      // named an id no element had: a promise of an explanation, kept by nothing.
      if (parts.error !== undefined) children.push(drawErrors(parts.error, props.field, "multiselect"));

      return h("div", { class: rootClasses(CONTRACT, { touched: props.field.touched(), open: state.value.open }), ref: root, onKeydown }, children);
    };
  },
});
