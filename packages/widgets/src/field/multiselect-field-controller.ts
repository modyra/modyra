/**
 * Headless multiselect field controller.
 *
 * Two selection semantics over one value, which is always an array. `"single"` is a toggle-set: an
 * option is in or out. `"multi"` lets the same option be taken more than once, so the value carries
 * repeats and the chip shows a count.
 *
 * Searching narrows what the host renders rather than what the field holds: `filteredOptions` is the
 * list to draw once a query exists, and the selection survives a query that hides it. The filter is
 * `filterOptionsByQuery`, shared with select so one search behaves the same in both.
 */
import { blocksFocus, blocksValueChange } from "../interactivity.js";
import { closeOverlayWhenOutOfPlay } from "./leaving-play.js";
import type { MdyReactivity, MdySelectOption, MdySignal } from "@modyra/core";
import { observerFor } from "@modyra/core";
import { filterOptionsByQuery, defaultOptionKey } from "../options-utils.js";
import { listboxNextIndex } from "../keyboard.js";
import { createTypeahead, typeaheadMatch } from "../typeahead.js";

import { multiselectValueTransition, overlayLifecycleTransition } from "../behavior.js";
import { optionsWithUnrecognizedValues } from "../options-reconciliation.js";
import type { MdyUiCommand } from "../commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "../contract.js";
import { projectMultiselectFieldA11y } from "./multiselect-field-a11y.js";
import { showsAsInvalid } from "./verdict.js";
import type {
  MdyMultiselectWayBack,
  MdyMultiselectFieldControllerOptions,
  MdyMultiselectFieldIntent,
  MdyMultiselectFieldState,
} from "./multiselect-field-types.js";

export interface MdyMultiselectFieldController<TValue>
  extends MdyWidgetController<MdyMultiselectFieldState<TValue>, MdyMultiselectFieldIntent> {
  /** Options remaining after `state().query` filters them, through the `filterOptionsByQuery`
   * search shared with select. Once a search intent has narrowed the list, the host renders this
   * rather than the full `options` array. */
  readonly filteredOptions: MdySignal<readonly MdySelectOption<TValue>[]>;
  /** Set the selected values programmatically without producing a command. */
  setValue(values: ReadonlyArray<TValue>): void;
  /** Update the readonly state. */
  setReadonly(readonly: boolean): void;
  /**
   * Replace the option list.
   *
   * A host whose options arrive later, or change, tells the controller rather than building a new
   * one: a fresh controller forgets the query and which option the keyboard was on.
   */
  setOptions(options: readonly MdySelectOption<TValue>[]): void;
}

export function createMultiselectFieldController<TValue>(
  options: MdyMultiselectFieldControllerOptions<TValue>,
  reactivity?: MdyReactivity,
): MdyMultiselectFieldController<TValue> {
  // Observed through the runtime that owns the handle. A caller that supplies one keeps it
  // and is told when it does not match — a fresh runtime over another form's handle is the
  // defect this registry was added for, and it fails by rendering nothing rather than by
  // raising.
  reactivity = observerFor(options.handle, reactivity);
  const {
    widgetId,
    handle,
    options: initialOptions,
    keyFor = (option) => defaultOptionKey(option.value),
    mode = "single",
    readonly: initialReadonly = false,
  } = options;

  // The declared list is a signal because everything below is derived from it: what is painted,
  // what a query narrows, what the projection names. A host that replaces it moves all of them.
  const optionList = reactivity.signal<readonly MdySelectOption<TValue>[]>(initialOptions);
  const allOptions = (): readonly MdySelectOption<TValue>[] => optionList();

  /**
   * What this widget paints: the declared options, plus every held value they do not contain.
   *
   * Recomputed from the value, so a value that arrives after the widget was built — a record
   * loading, a draft coming back — brings its own option with it. Nothing is added while the list
   * is empty: options that have not loaded are not a list that refuses the value.
   */
  const effectiveOptions = reactivity.computed(() =>
    optionsWithUnrecognizedValues(allOptions(), heldValues()),
  );

  const indexOf = (options: readonly MdySelectOption<TValue>[]) => {
    const byKey = new Map<string, MdySelectOption<TValue>>();
    for (const option of options) byKey.set(keyFor(option), option);
    return byKey;
  };

  const keysOf = (
    values: ReadonlyArray<TValue>,
    byKey: ReadonlyMap<string, MdySelectOption<TValue>>,
  ): string[] =>
    values
      .map((value) => [...byKey.entries()].find(([, o]) => o.value === value)?.[0])
      .filter((key): key is string => key !== undefined);

  const readonly = reactivity.signal(initialReadonly);
  const query = reactivity.signal("");
  /** Where the keyboard is inside the open popup. A cursor, not a selection. */
  const activeKey = reactivity.signal<string | null>(null);
  /** The letters typed at the open list, and the idle window that ends a word. */
  const typeahead = createTypeahead();
  const open = reactivity.signal(false);
  // A field taken out of play does not keep an overlay open over it: the popup looked live, said
  // `aria-expanded="true"` to a screen reader, and answered nothing.
  const stopWatchingPlay = closeOverlayWhenOutOfPlay(reactivity, () => handle.interactivity(), open);

  // A field that has never been set holds null, not an empty list — a document-declared control and
  // a registry-backed one both start there. Read once, so nothing below has to remember it.
  //
  // And a value that is not a list at all is one value. `patchValue` is public and a draft is data,
  // so a string, a number or an object reaches this control; read as a list it threw from inside the
  // computed the widget draws from, and an effect that throws stops running — the control kept what
  // it was showing, reported itself valid, and the page had nothing to correct. Holding it as one
  // value is what the shape gate then has something to object to.
  /**
   * The last destructive act and the value it would put back.
   *
   * The value is private: an offer a host can read is an offer a host can apply to a different
   * moment. What is published is what the act *was*, which is what an affordance has to say.
   */
  const wayBack = reactivity.signal<
    (MdyMultiselectWayBack & { readonly value: ReadonlyArray<TValue> }) | null
  >(null);

  const heldValues = (): ReadonlyArray<TValue> => {
    const held = handle.value() as unknown;
    if (held === null || held === undefined) return [];
    return Array.isArray(held) ? held as ReadonlyArray<TValue> : [held as TValue];
  };

  const state: MdySignal<MdyMultiselectFieldState<TValue>> = reactivity.computed(() => {
    const selectedValues = heldValues();
    const options = effectiveOptions();
    const keys = keysOf(selectedValues, indexOf(options));
    const counts = new Map<string, number>();
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    return {
      options,
      selectedValues,
      selectedKeys: new Set(keys),
      counts,
      query: query(),
      activeKey: activeKey(),
      open: open(),
      // Out of play, no verdict: a disabled field is not validated by the form, so painting it as
    // failing would show a verdict the form itself ignores. See verdict.ts.
    invalid: showsAsInvalid({ valid: handle.valid(), disabled: handle.disabled() }),
      disabled: handle.disabled(),
      // The form owns this state; `setReadonly()` is an imperative override for a renderer with no
    // form behind it.
    readonly: handle.readonly() || readonly(),
    // `disabled`/`readonly` above are the derived halves of this one value.
    //
    // The imperative override can only ever narrow what is permitted: `setReadonly()` serves a
    // renderer with no form behind it, and must not re-enable a field the form disabled.
    interactivity: handle.interactivity() === "enabled" && readonly()
      ? ("readonly" as const)
      : handle.interactivity(),
      required: handle.required(),
      touched: handle.touched(),
      dirty: handle.dirty(),
      pending: handle.pending(),
      wayBack: (() => {
        const offer = wayBack();
        return offer === null ? null : { act: offer.act, optionKey: offer.optionKey, count: offer.count };
      })(),
    };
  });

  const filteredOptions: MdySignal<readonly MdySelectOption<TValue>[]> = reactivity.computed(() =>
    filterOptionsByQuery(effectiveOptions(), query()),
  );

  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => {
    const currentState = state();
    const a11y = projectMultiselectFieldA11y(currentState, handle.errors(), { widgetId });

    // A null prototype, because these keys are data: an option valued `__proto__` assigned into a
    // plain object sets that object's prototype instead of adding a member, so the part vanished and
    // the renderer was handed `undefined` — the control disappeared from the page mid-draw.
    const parts: Record<string, ReturnType<typeof a11yOption>> = Object.create(null);
    // What is painted, not what was declared: a choice the list no longer offers is kept — that is
    // this widget's rule — and building parts from the declared list left it with no id, no
    // `role="option"` and nothing `aria-activedescendant` could point at. The one entry the user
    // needs in order to take their choice back is the one that could not be bound.
    for (const option of effectiveOptions()) {
      const key = keyFor(option);
      parts[key] = a11yOption(key, option, currentState);
    }

    return {
      root: a11y.root,
      parts: {
        label: a11y.label,
        trigger: a11y.trigger,
        placeholder: a11y.placeholder,
        chips: a11y.chips,
        popup: a11y.popup,
        search: a11y.search,
        group: a11y.group,
        description: a11y.description,
        error: a11y.error,
        announcement: a11y.announcement,
        ...parts,
      },
    };
  });

  function a11yOption(key: string, option: MdySelectOption<TValue>, currentState: MdyMultiselectFieldState<TValue>) {
    const selected = currentState.selectedKeys.has(key);
    const count = currentState.counts.get(key) ?? 0;
    const disabled = option.disabled || blocksValueChange(currentState.interactivity);
    // Filtering is the contract's: an option the query does not match is hidden here, so every
    // renderer filters identically by applying the part rather than reimplementing the match.
    const visible = filteredOptions().some((candidate) => keyFor(candidate) === key);
    return {
      id: `${widgetId}__opt__${key}`,
      // The shared chip vocabulary, projected once here so every
      // renderer draws the same chip: `--centered` reserves the check's width in toggle mode,
      // `--counter` is the bag mode with its step buttons.
      classes: [
        "mdy-chip",
        mode === "multi" ? "mdy-chip--counter" : "mdy-chip--centered",
        ...(selected ? ["mdy-chip--selected"] : []),
        ...(disabled ? ["mdy-chip--disabled"] : []),
      ],
      attributes: {
        ...(mode === "single" ? { "aria-pressed": String(selected) } : { "data-count": count }),
        "aria-disabled": String(disabled),
        hidden: !visible,
        // The native attribute asks the focus question, not the write question: a read-only chip
        // stays reachable.
        disabled: option.disabled || blocksFocus(currentState.interactivity),
      },
    };
  }

  function withOption(key: string, run: (option: MdySelectOption<TValue>) => readonly MdyUiCommand[]): readonly MdyUiCommand[] {
    // The painted list, not the declared one: a chip the user can see is a chip they can act on,
    // and the one standing for an unrecognised value is the only way to remove that value.
    const option = indexOf(effectiveOptions()).get(key);
    if (!option || option.disabled) return [];
    const commands = run(option);
    handle.markAsDirty();
    handle.markAsTouched();
    return commands;
  }

  function toggle(key: string): readonly MdyUiCommand[] {
    return withOption(key, (option) => {
      // Through the published transition rather than around it. `option[]` is a multi-set on
      // purpose — a counter chip raises and lowers a quantity — and the two presses mean different
      // things: `decrement` removes one occurrence, a toggle removes the option. This spliced one
      // out, so a chip a person pressed once stayed selected with two of the three still held.
      //
      // It also compared by identity while the rest of the widget keys an option by what it holds
      // (ADR 0051), so an object option could never be switched off.
      handle.set(multiselectValueTransition(
        heldValues(),
        { type: "toggle", value: option.value },
        (value) => defaultOptionKey(value),
      ) as TValue[]);
      return [{ type: "mark-dirty" }, { type: "mark-touched" }];
    });
  }

  /**
   * One more of a value, beside the ones already held.
   *
   * Inserted after the **last occurrence of the same value**, not at the end of the array. A
   * quantity is one chip in one place, and appending split its occurrences: `["a","b"]` incremented
   * on `a` became `["a","b","a"]`, so the value a form submits had an order nothing on screen ever
   * showed — the strip draws each value once, at its first position, and stayed where it was while
   * the array behind it did not. A value not held yet starts its own group at the end, which is
   * where a first choice goes.
   */
  function increment(key: string): readonly MdyUiCommand[] {
    return withOption(key, (option) => {
      const values = [...heldValues()];
      const last = values.reduce(
        (found, value, index) => (keysOf([value], indexOf(effectiveOptions()))[0] === key ? index : found),
        -1,
      );
      if (last === -1) values.push(option.value);
      else values.splice(last + 1, 0, option.value);
      handle.set(values);
      return [{ type: "mark-dirty" }, { type: "mark-touched" }];
    });
  }

  function decrement(key: string): readonly MdyUiCommand[] {
    const option = indexOf(effectiveOptions()).get(key);
    if (!option) return [];
    // The last of the group, so the ones that remain keep the positions they had. Taking the first
    // moves every later occurrence up by one, which is the same silent reordering incrementing at the
    // end used to cause.
    const values = [...heldValues()];
    const key_ = indexOf(effectiveOptions());
    const index = values.reduce(
      (found, value, at) => (keysOf([value], key_)[0] === key ? at : found),
      -1,
    );
    if (index === -1) return [];
    values.splice(index, 1);
    handle.set(values);
    handle.markAsDirty();
    handle.markAsTouched();
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  /**
   * Moves one chosen value to another position, carrying its quantity with it.
   *
   * Operates on the *distinct* values in the order they were chosen, which is the order the strip
   * draws, so `to` is an index a person can point at. A value taken three times is one chip and
   * moves as one thing — splitting its occurrences would move a thing nobody is looking at.
   *
   * `to` is clamped rather than refused: a control asking for one past either end means "as far as
   * it goes", which is what holding an arrow down does.
   */
  function moveSelected(optionKey: string, to: number): readonly MdyUiCommand[] {
    const held = heldValues();
    const key = indexOf(effectiveOptions());
    const order: string[] = [];
    const groups = new Map<string, TValue[]>();
    for (const value of held) {
      const k = keysOf([value], key)[0]!;
      if (!groups.has(k)) { groups.set(k, []); order.push(k); }
      groups.get(k)!.push(value);
    }
    const from = order.indexOf(optionKey);
    if (from === -1) return [];
    const target = Math.max(0, Math.min(order.length - 1, to));
    if (target === from) return [];
    order.splice(from, 1);
    order.splice(target, 0, optionKey);
    handle.set(order.flatMap((k) => groups.get(k) ?? []));
    handle.markAsDirty();
    handle.markAsTouched();
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  function clear(): readonly MdyUiCommand[] {
    const before = heldValues();
    if (before.length === 0) return [];
    handle.set([]);
    wayBack.set({ act: "clear", optionKey: null, count: before.length, value: before });
    handle.markAsDirty();
    handle.markAsTouched();
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  /**
   * Puts back what the last destructive act took.
   *
   * Nothing when there is no offer, and the offer is spent once taken: depth is one, so a second
   * press must not walk further back into a history this control does not keep.
   */
  function undo(): readonly MdyUiCommand[] {
    const offer = wayBack();
    if (offer === null) return [];
    handle.set(offer.value);
    wayBack.set(null);
    handle.markAsDirty();
    handle.markAsTouched();
    return [{ type: "mark-dirty" }, { type: "mark-touched" }];
  }

  /**
   * Records what a value-changing act just did, from the value on either side of it.
   *
   * Shorter is destructive and offers a way back; longer, or the same length, is constructive and
   * withdraws whatever was offered — an offer left standing across an addition reverses something
   * the person did not just lose, which is the failure a depth-one stack invites.
   */
  function record(act: MdyMultiselectWayBack["act"], before: ReadonlyArray<TValue>, optionKey: string | null): void {
    const after = heldValues();
    if (act === "move") {
      wayBack.set({ act, optionKey, count: after.length, value: before });
      return;
    }
    if (after.length < before.length) {
      wayBack.set({ act, optionKey, count: before.length - after.length, value: before });
      return;
    }
    wayBack.set(null);
  }

  /**
   * Runs an overlay intent through the one lifecycle policy every popup widget shares, so
   * "does this open", "does focus return" never means something different here.
   */
  function overlay(intent: Parameters<typeof overlayLifecycleTransition>[1]): readonly MdyUiCommand[] {
    const transition = overlayLifecycleTransition({ open: open() }, intent);
    if (transition.effect === "none") return [];
    open.set(transition.state.open);
    if (transition.effect === "teardown") {
      // A closed popup keeps no query: reopening must show the whole list, not the last filter.
      query.set("");
      const commands: MdyUiCommand[] = [{ type: "close-overlay" }];
      if (transition.restoreFocus) commands.push({ type: "restore-focus", target: { part: "trigger" } });
      return commands;
    }
    return [
      { type: "open-overlay", anchor: { part: "trigger" } },
      { type: "focus", target: { part: "search" } },
    ];
  }

  function dispatch(intent: MdyMultiselectFieldIntent): readonly MdyUiCommand[] {
    if (intent.type === "blur") {
      handle.markAsTouched();
      return [{ type: "mark-touched" }];
    }
    if (intent.type === "search") {
      query.set(intent.query);
      // The cursor cannot survive a filter that may not contain what it was on. Cleared rather than
      // clamped: "the first match" is a guess about what somebody typing meant, and the next arrow
      // asks for it plainly.
      activeKey.set(null);
      typeahead.clear();
      return [];
    }
    if (intent.type === "move") {
      // The options as painted, which is what the person can see: a cursor that walked the declared
      // list would stop on rows the filter has hidden.
      const visible = filteredOptions();
      if (visible.length === 0) return [];
      const at = visible.findIndex((option) => keyFor(option) === activeKey());
      const to = intent.target === "first" ? 0
        : intent.target === "last" ? visible.length - 1
        : listboxNextIndex(intent.target === "next" ? "ArrowDown" : "ArrowUp", at, visible.length);
      const landed = visible[to ?? at];
      if (landed) activeKey.set(keyFor(landed));
      return [];
    }
    if (intent.type === "typeahead") {
      // The buffer is the controller's, and so is the window that decides whether two keystrokes are
      // one word. Walked over the options a person can see, for the same reason the cursor is.
      const landed = typeaheadMatch(filteredOptions(), typeahead.push(intent.character));
      if (landed) activeKey.set(keyFor(landed));
      return [];
    }
    if (intent.type === "select") {
      const key = intent.optionKey ?? activeKey();
      return key === null || key === undefined ? [] : toggle(key);
    }
    if (intent.type === "focus") {
      return [];
    }
    const disabled = blocksValueChange(state().interactivity);
    // A cursor belongs to one showing of the list. Carried over, the next opening starts wherever
    // the last one was left, which is a position this person never chose.
    if (intent.type === "open" || intent.type === "toggleOpen" || intent.type === "close") {
      activeKey.set(null);
      typeahead.clear();
    }
    if (intent.type === "open") return overlay({ type: "open", disabled, available: true });
    if (intent.type === "toggleOpen") return overlay({ type: "toggle", disabled, available: true });
    if (intent.type === "close") return overlay({ type: "close", restoreFocus: intent.restoreFocus });

    if (blocksValueChange(state().interactivity)) {
      return [];
    }

    switch (intent.type) {
      case "toggle": {
        const before = heldValues();
        const commands = toggle(intent.optionKey);
        record("remove", before, intent.optionKey);
        return commands;
      }
      case "increment": {
        const commands = increment(intent.optionKey);
        wayBack.set(null);
        return commands;
      }
      case "decrement": {
        const before = heldValues();
        const commands = decrement(intent.optionKey);
        record("remove", before, intent.optionKey);
        return commands;
      }
      case "clear":
        return clear();
      case "undo":
        return undo();
      case "move-selected": {
        const before = heldValues();
        const commands = moveSelected(intent.optionKey, intent.to);
        if (commands.length > 0) record("move", before, intent.optionKey);
        return commands;
      }
    }
  }

  function setValue(values: ReadonlyArray<TValue>): void {
    handle.set(values);
  }

  function setOptions(next: readonly MdySelectOption<TValue>[]): void {
    optionList.set(next);
  }

  function setReadonly(nextReadonly: boolean): void {
    readonly.set(nextReadonly);
  }

  function destroy(): void {
    stopWatchingPlay();
    // No owned effects; the handle lifecycle belongs to the form engine.
  }

  return {
    state,
    view,
    dispatch,
    filteredOptions,
    setValue,
    setReadonly,
    setOptions,
    destroy,
  };
}
