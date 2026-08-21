/**
 * Renders the "multiselect" kind via createMultiselectFieldController, in the anatomy the catalogue names: the options are chips in a grid in the field, and
 * the header's search button opens a popup holding the same grid over a filter box.
 *
 * The two grids are the same builder, and which classes a chip carries is `multiselectChipClasses`.
 * Nothing here decides what a chip looks like — that is the point of having a chip primitive: the
 * foundation styles `.mdy-chip` and its variants, and a renderer that spelled a variant itself would
 * be the reason a theme's rule silently stopped applying.
 */
import { observerFor, type MdyFieldHandle, type MdyMultiselectMode, type MdyReactivity, type MdySelectOption } from "@modyra/core";
import type { MdyDynamicOptionsField } from "@modyra/core";
import {
  MDY_WIDGET_CONTRACTS,
  createMultiselectFieldController,
  multiselectChipClasses,
  multiselectOverlayAction,
  overlayAnchoringFor,
  shownErrorsOf,
  type MdyElementLookup,
  MDY_I18N_MESSAGES_DEFAULT,
  type MdyI18nMessages,
  keyBindingFor,
  chipFocusAfterRemoval,
  multiselectAnnouncement,
  chipMovedAnnouncement,
  chipDropIndex,
  stateClass,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setText, setIcon } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { withControls, type MdyMountedField } from "../field-controls.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnOutsidePointer, positionOverlay, releaseOverlayPlacement, reflectOverlayOpen, trackOverlay } from "../overlay.js";

export function renderMultiselectField(
  container: HTMLElement,
  f: MdyDynamicOptionsField,
  handle: MdyFieldHandle<ReadonlyArray<unknown>>,
  reactivity?: MdyReactivity,
  mode: MdyMultiselectMode = "single",
  widgetId: string = f.name,
  /**
   * The words this control shows. The engine has no opinion about them, so they arrive from the
   * widget contract's tables rather than being written here — three renderers each spelling
   * "open the calendar" is three answers to one question.
   */
  messages: MdyI18nMessages = MDY_I18N_MESSAGES_DEFAULT,
): MdyMountedField {
  reactivity = observerFor(handle, reactivity);
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = overlayAnchoringFor("multiselect");
  const options = f.options as ReadonlyArray<MdySelectOption<unknown>>;
  const keyFor = (option: MdySelectOption<unknown>) => String(option.value);
  const searchable = (f as { readonly searchable?: boolean }).searchable === true;
  const reorderable = (f as { readonly reorderable?: boolean }).reorderable === true;
  const controller = createMultiselectFieldController({ widgetId: widgetId, handle, options, keyFor, mode }, reactivity);

  const parts = MDY_WIDGET_CONTRACTS.multiselect.parts;
  const shell = buildFieldShell(f.label, "multiselect", {}, f.ariaLabel, f.name, f.supportingText);

  // ── the field: a header with the search button, and the options as chips ──────────────────
  // The widget's own layout box, as the single-choice sibling has one. Not the `inputWrapper` part:
  // that is the shell's box, and it means the shell's box for every other kind — one name for two
  // different elements is how a height comparison came to be off by the border a theme draws.
  const control = el("div", "mdy-multiselect");

  /**
   * What a person presses to open the popup, and what holds what they chose.
   *
   * A button rather than the field's box: the box carries the field's state classes, and a node
   * with both jobs is a node two rules write to. The chips strip lives inside it, so the strip can
   * scroll within its own bounds while the box around it stays the height the host gives a control.
   */
  const trigger = el("button", parts.trigger.classes.join(" ")) as HTMLButtonElement;
  trigger.type = "button";
  const chipStrip = el("div", parts.chips.classes.join(" "));
  const placeholder = el("span", parts.placeholder.classes.join(" "));
  // The affordance at the trailing edge, as the single-choice sibling has. Decorative: the whole
  // control opens the popup, so this says which way it opens rather than being the way.
  const arrow = el("span", parts.arrow.classes.join(" "));
  arrow.setAttribute("aria-hidden", "true");
  // Waiting on its options: the indicator goes on the control, so the field says it is loading
  // without being opened.
  if (f.loading) {
    const loading = el("span", parts.loading.classes.join(" "));
    loading.setAttribute("role", "status");
    trigger.appendChild(loading);
  }
  trigger.append(chipStrip, placeholder, arrow);
  // Said rather than shown: a choice lands and the strip is the only confirmation, which is the one
  // a person using a screen reader does not get.
  const announcement = el("div", parts.announcement.classes.join(" "));
  control.append(trigger, announcement);

  // ── popup: the filter box over the same grid ──────────────────────────────────────────────
  const popup = el("div", `${parts.popup.classes.join(" ")} mdy-overlay`) as HTMLDivElement;
  const search = el("input", parts.search.classes.join(" ")) as HTMLInputElement;
  search.type = "search";
  search.placeholder = messages.searchPlaceholder;

  /**
   * One option chip, in whichever grid asked for it.
   *
   * Single mode gives a chip that is either taken or not, with room reserved for its tick; multi
   * mode gives the same chip with a count between two steppers. Both are `multiselectChipClasses`:
   * the mode picks the variant, selection is a state on top of it.
   */
  interface ChipHandle { readonly chip: HTMLElement; readonly count?: HTMLSpanElement }
  function buildChip(option: MdySelectOption<unknown>, key: string): ChipHandle {
    const label = el("span", parts.optionLabel.classes.join(" "));
    setText(label, option.label);
    const classes = multiselectChipClasses({ mode }).join(" ");

    if (mode === "multi") {
      const chip = el("div", classes);
      chip.title = option.label;
      const step = (icon: "MINUS" | "PLUS", intent: "decrement" | "increment", describe: string): HTMLButtonElement => {
        const button = el("button", parts.optionStep.classes.join(" ")) as HTMLButtonElement;
        button.type = "button";
        setIcon(button, icon);
        button.setAttribute("aria-label", `${describe} ${option.label}`);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          dispatch({ type: intent, optionKey: key });
        });
        return button;
      };
      const count = el("span", parts.optionCount.classes.join(" ")) as HTMLSpanElement;
      chip.append(step("MINUS", "decrement", "Decrease"), label, count, step("PLUS", "increment", "Increase"));
      return { chip, count };
    }

    const chip = el("button", classes) as HTMLButtonElement;
    chip.type = "button";
    chip.title = option.label;
    // Empty: the theme draws the tick for renderers that ship no icon set.
    const check = el("span", parts.optionCheck.classes.join(" "));
    check.setAttribute("aria-hidden", "true");
    chip.append(check, label);
    chip.addEventListener("click", () => dispatch({ type: "toggle", optionKey: key }));
    return { chip };
  }

  /** A grid of option chips: the one in the field, and the one in the popup. Filled by `syncGrids`. */
  function buildGrid(extraClasses: readonly string[]): { grid: HTMLElement; chips: Map<string, ChipHandle> } {
    const grid = el("div", [...parts.options.classes, ...extraClasses].join(" "));
    grid.setAttribute("role", "group");
    return { grid, chips: new Map<string, ChipHandle>() };
  }

  // One grid, in the popup. The closed control shows what was *chosen*, in the chips strip; the
  // options are seen where there is room for them. A second copy in the field made every option
  // reachable in two places and made the control's height follow the option count.
  const overlay = buildGrid([]);
  // Only when the field asked for it. The document has declared `searchable` all along and this
  // renderer built the box regardless, so a field that said it wanted no search got one — and one
  // that said nothing got one too, which made the flag look like it worked.
  popup.append(...(searchable ? [search] : []), overlay.grid);

  /** Every chip standing for an option, in both grids: one option, two elements to keep in step. */
  const optionEls = new Map<string, readonly ChipHandle[]>();

  /** A chip per chosen value, in the order they were chosen, drawn in the closed control. */
  const chosenEls = new Map<string, HTMLElement>();
  /**
   * Which chip the strip's single tab stop is on.
   *
   * A roving index: one stop for the whole strip, and the arrows move within it. One stop per chip
   * made the cost of tabbing past the field grow with what it holds — twelve chosen values were
   * twenty-six presses — and what a control holds must not decide how long it takes to leave.
   */
  let activeChip: string | null = null;
  /**
   * What the live region last spoke about, so the next change can be described as a change.
   *
   * Seeded from what the field already holds: a value that arrived with the form is not something
   * the person just did, and announcing it on the first paint tells them about a choice they never
   * made.
   */
  /** A sentence to say once, for a change no selection delta describes — a move. */
  let saySoon: string | null = null;
  let saidLast: readonly string[] = [...new Set(
    (controller.state().selectedValues as readonly unknown[]).map((value) => keyFor({ value } as MdySelectOption<unknown>)),
  )];

  /**
   * One chip in the strip: what was chosen, how many of it, and the controls for changing that.
   *
   * A container rather than a button, because it holds buttons. Focusable, because a chip a keyboard
   * cannot reach is a chip only a pointer can act on — and it is what the reordering keys will
   * address. Named as one thing, because a label and a count in two spans are read as one run of
   * text with nothing saying which is which.
   *
   * In counter mode the two steppers are here, so making a three into a two does not send a person
   * back into the popup to find the row among the others — the journey the strip exists to remove.
   */
  /**
   * Whether this chip offers the two steppers.
   *
   * Counter mode and nothing else. A repeated value can also arrive from a document —
   * `["a","a","a"]` on a field that declared no mode — and it is tempting to offer the steppers
   * there too, since the chip does say three. It is the wrong reading: a toggle-set holds membership,
   * so a repeat is a malformed value rather than a quantity, and steppers would invite making it
   * four. The chip states what is held and can be taken off whole, which is the correction that
   * mode admits.
   */
  function stepsFor(_count: number): boolean {
    return mode === "multi";
  }

  function buildValueChip(key: string, count: number): HTMLElement {
    const chip = el("div", parts.chip.classes.join(" "));
    chip.tabIndex = -1;
    chip.setAttribute("role", "group");
    chip.addEventListener("focus", () => { activeChip = key; syncRoving(); });
    // Rearranging what was chosen, from the chip a person is looking at. The keys are the
    // contract's — a renderer choosing its own is how three of them come to answer differently —
    // and the direction comes from the binding rather than from the key, because the strip runs in
    // the writing direction and `ArrowLeft` moves a chip *later* in a right-to-left document.
    chip.addEventListener("keydown", (event) => {
      const combo = `${event.altKey ? "Alt+" : ""}${event.key}`;
      const binding = keyBindingFor("multiselect", combo, controller.state().open);
      if (!binding) return;
      // The chip's keys are the chip's. Left to bubble, the control's own overlay handler answered
      // the same keys a second time — so `End` moved focus and then had the popup's answer applied
      // over it, and `Backspace` removed nothing because the second handler won.
      event.stopPropagation();
      const order = stripOrder();
      if (binding.intent === "move") {
        event.preventDefault();
        const at = order.indexOf(key);
        const to = binding.toEnd
          ? (binding.by === -1 ? 0 : order.length - 1)
          : Math.max(0, Math.min(order.length - 1, at + (binding.by ?? 1)));
        focusChip(order[to]);
        return;
      }
      if (binding.intent === "remove") {
        event.preventDefault();
        // Backspace goes back, Delete goes on — the convention every text field on every platform
        // has, and a strip of chips is close enough to a line of text that people bring it with them.
        const next = chipFocusAfterRemoval(order, key, event.key === "Backspace" ? "backward" : "forward");
        dispatch({ type: "toggle", optionKey: key });
        queueMicrotask(() => (next === null ? trigger : chosenEls.get(next) ?? trigger).focus());
        return;
      }
      // Only *reordering* is opt-in. Moving between chips and taking one off are how a keyboard
      // uses the strip at all, and gating them on `reorderable` made six declared keys do nothing
      // in the default configuration — which is every field that never asked to be rearranged.
      if (binding.intent !== "reorder" || !reorderable) return;
      event.preventDefault();
      // The order the *value* has, not the order these elements were created in: the map is keyed
      // by option and its insertion order never changes, so reading it moved the chip once and then
      // asked for the position it already had.
      // Said out loud, and set *before* dispatching: the dispatch runs the effect that reads this,
      // so a sentence written afterwards is a sentence the render has already been past.
      //
      // This way of reordering has no *grabbed* state to announce — nothing is picked up and nothing
      // put down — so the movement itself is the only thing there is to say, and unannounced a
      // reorder is invisible to somebody who cannot see the strip.
      const to = Math.max(0, Math.min(order.length - 1, order.indexOf(key) + (binding.by ?? 1)));
      saySoon = chipMovedAnnouncement(
        messages.selectionMoved,
        labelOfChip(key),
        to + 1,
        order.length,
      );
      dispatch({ type: "move-selected", optionKey: key, to });
      // The chip moved; focus goes with it, or the next key acts on whatever happens to be here.
      queueMicrotask(() => chosenEls.get(key)?.focus());
    });
    const step = (delta: -1 | 1, label: string) => {
      const button = el("button", parts.optionStep.classes.join(" ")) as HTMLButtonElement;
      button.type = "button";
      // Out of the tab order with the chip that holds it: the strip is one stop, and its controls
      // are reached with the keys the contract declares rather than by tabbing through every one.
      button.tabIndex = -1;
      button.setAttribute("aria-label", label);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        dispatch(delta === 1 ? { type: "increment", optionKey: key } : { type: "decrement", optionKey: key });
      });
      return button;
    };
    /**
     * The pointer's way to move a chip, which is not a drag.
     *
     * WCAG 2.5.7 asks for a single-pointer path independently of the keyboard's: somebody who
     * cannot hold and drag — a tremor, a head pointer, a switch — has no way to reorder otherwise,
     * and `Alt`+arrows does not discharge it. Not focusable, like every other control on the chip:
     * the chip is one tab stop and these are reached through it.
     */
    const move = (by: -1 | 1, label: string) => {
      const button = el("button", parts.chipMove.classes.join(" ")) as HTMLButtonElement;
      button.type = "button";
      button.tabIndex = -1;
      button.setAttribute("aria-label", label);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const order = stripOrder();
        const to = Math.max(0, Math.min(order.length - 1, order.indexOf(key) + by));
        saySoon = chipMovedAnnouncement(messages.selectionMoved, labelOfChip(key), to + 1, order.length);
        dispatch({ type: "move-selected", optionKey: key, to });
        // The subject stays the chip that moved, decided rather than inherited from the DOM. The
        // keyboard has this for free — focus travels with the chip — and a pointer does not: after
        // one press the chip a person was aiming at has slid out from under their finger, so a
        // second press on the same spot moves a different value back. Naming the subject at least
        // keeps everything downstream of it pointing at the right thing.
        activeChip = key;
        syncRoving();
      });
      return button;
    };
    if (reorderable) {
      /**
       * Dragging a chip to a new place — the door the brief named, on the same intent as the other
       * two so the three cannot answer differently.
       *
       * A threshold before it becomes a drag: a press that never travels is a press, and treating
       * every one as the beginning of a drag takes the chip's own controls away from anybody whose
       * finger moves a pixel. Pointer capture so leaving the strip does not drop the gesture, and
       * `pointercancel` puts it back untouched — the browser taking the gesture is not a decision
       * the person made.
       */
      chip.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const startX = event.clientX;
        let dragging = false;
        const onMove = (moveEvent: PointerEvent) => {
          if (!dragging && Math.abs(moveEvent.clientX - startX) < 6) return;
          dragging = true;
          chip.classList.add(stateClass(parts.chip.classes[0]!, "dragging"));
        };
        const onUp = (upEvent: PointerEvent) => {
          chip.removeEventListener("pointermove", onMove);
          chip.removeEventListener("pointerup", onUp);
          chip.removeEventListener("pointercancel", onCancel);
          chip.classList.remove(stateClass(parts.chip.classes[0]!, "dragging"));
          if (!dragging) return;
          const order = stripOrder();
          const midpoints = order.map((each) => {
            const box = chosenEls.get(each)?.getBoundingClientRect();
            return box ? box.left + box.width / 2 : 0;
          });
          const to = chipDropIndex(midpoints, upEvent.clientX, order.indexOf(key));
          if (to === order.indexOf(key)) return;
          saySoon = chipMovedAnnouncement(messages.selectionMoved, labelOfChip(key), to + 1, order.length);
          dispatch({ type: "move-selected", optionKey: key, to });
          activeChip = key;
          syncRoving();
        };
        const onCancel = () => {
          chip.removeEventListener("pointermove", onMove);
          chip.removeEventListener("pointerup", onUp);
          chip.removeEventListener("pointercancel", onCancel);
          chip.classList.remove(stateClass(parts.chip.classes[0]!, "dragging"));
        };
        chip.setPointerCapture(event.pointerId);
        chip.addEventListener("pointermove", onMove);
        chip.addEventListener("pointerup", onUp);
        chip.addEventListener("pointercancel", onCancel);
      });
      chip.appendChild(move(-1, messages.chipMoveEarlierLabel));
    }
    if (stepsFor(count)) chip.appendChild(step(-1, messages.chipDecrementLabel));
    chip.appendChild(el("span", parts.optionLabel.classes.join(" ")));
    chip.appendChild(el("span", parts.optionCount.classes.join(" ")));
    if (stepsFor(count)) chip.appendChild(step(1, messages.chipIncrementLabel));
    if (reorderable) chip.appendChild(move(1, messages.chipMoveLaterLabel));
    const remove = el("button", parts.chipRemove.classes.join(" ")) as HTMLButtonElement;
    remove.type = "button";
    remove.tabIndex = -1;
    remove.setAttribute("aria-label", messages.chipRemoveLabel);
    remove.addEventListener("click", (event) => {
      // The strip sits inside the trigger, which opens the popup. Taking a value off is not asking
      // to see the options.
      event.stopPropagation();
      // Where focus goes is the contract's. Left to the browser it lands on whatever now occupies
      // that position, which is the next chip while one exists and the document at the end of the
      // strip — so clearing from the right loses your place on the first press.
      const next = chipFocusAfterRemoval([...chosenEls.keys()], key);
      dispatch({ type: "toggle", optionKey: key });
      queueMicrotask(() => {
        const landing = next === null ? trigger : chosenEls.get(next)?.querySelector<HTMLElement>(`.${parts.chipRemove.classes[0]}`);
        (landing ?? trigger).focus();
      });
    });
    chip.appendChild(remove);
    return chip;
  }

  /**
   * Brings the strip in line with what is chosen.
   *
   * Driven by `selectedValues` rather than by the option list, and never by the *filtered* list: the
   * order the strip shows is the order the value has, and a strip reading what the search matches
   * would empty itself as somebody typed.
   *
   * **A repeated value is a quantity, not a duplicate.** This kind carries counts — `increment`
   * takes `["a"]` to `["a","a","a"]` — so one chip per distinct value with the count beside it,
   * rather than one chip per entry. Three identical chips would be three things to remove one at a
   * time to undo one decision, and a chip with no count at all answers the same for one of
   * something as for three, which is the reading that loses the capability silently.
   */
  function syncChips(state: { readonly selectedValues: readonly unknown[]; readonly options: readonly MdySelectOption<unknown>[] }): void {
    const tally = new Map<string, { readonly label: string; count: number }>();
    for (const value of state.selectedValues) {
      const option = state.options.find((o) => keyFor(o) === keyFor({ value } as MdySelectOption<unknown>));
      const key = keyFor((option ?? { value, label: String(value) }) as MdySelectOption<unknown>);
      const seen = tally.get(key);
      if (seen) seen.count += 1;
      else tally.set(key, { label: option?.label ?? String(value), count: 1 });
    }
    const wanted: string[] = [];
    for (const [key, { label, count }] of tally) {
      wanted.push(key);
      let chip = chosenEls.get(key);
      // Rebuilt when the steppers come or go: the chip's controls depend on how many it stands for,
      // and a chip built at one is not the chip a person needs at three.
      if (chip && chip.dataset.stepped !== String(stepsFor(count))) { chip.remove(); chosenEls.delete(key); chip = undefined; }
      if (!chip) {
        chip = buildValueChip(key, count);
        chip.dataset.stepped = String(stepsFor(count));
        chosenEls.set(key, chip);
      }
      setText(chip.querySelector(`.${parts.optionLabel.classes[0]}`) as HTMLElement, label);
      const counter = chip.querySelector(`.${parts.optionCount.classes[0]}`) as HTMLElement;
      setText(counter, count > 1 ? String(count) : "");
      counter.hidden = count <= 1;
      // One name for the whole chip: a label and a count in two spans are read as one run of text,
      // so "A 3" arrives with nothing saying which half is which.
      chip.setAttribute("aria-label", count > 1 ? `${label}, ${count}` : label);
      // Where this chip sits and how many there are, stated on the chip itself. Independent of the
      // live region and of anything drawn: it survives a stripped stylesheet and a dropped
      // announcement, which the other two do not.
      chip.setAttribute("aria-posinset", String(wanted.length));
      chip.setAttribute("aria-setsize", String(tally.size));
      // The full name, for a chip the strip has narrowed to an ellipsis. `title` is the pointer's
      // half of that; a theme draws the other on focus and long press, which is what reaches a
      // keyboard and a touch.
      chip.title = label;
      // Appending an element already in the strip moves it, which keeps the order the value's.
      chipStrip.appendChild(chip);
    }
    for (const key of [...chosenEls.keys()]) {
      if (tally.has(key)) continue;
      chosenEls.get(key)?.remove();
      chosenEls.delete(key);
    }
    placeholder.hidden = tally.size > 0;
    syncRoving();
  }

  /** What a chip is called, for a sentence about it. */
  function labelOfChip(key: string): string {
    return chosenEls.get(key)?.querySelector(`.${parts.optionLabel.classes[0]}`)?.textContent ?? key;
  }

  /** The chips in the order the value has them, which is the order the strip draws. */
  function stripOrder(): readonly string[] {
    return [...new Set(controller.state().selectedValues.map((value) =>
      keyFor({ value } as MdySelectOption<unknown>)))];
  }

  /** Exactly one chip is reachable by Tab; the arrows decide which. */
  function syncRoving(): void {
    const order = stripOrder();
    if (activeChip === null || !order.includes(activeChip)) activeChip = order[0] ?? null;
    for (const [key, chip] of chosenEls) chip.tabIndex = key === activeChip ? 0 : -1;
  }

  function focusChip(key: string | undefined): void {
    if (key === undefined) return;
    activeChip = key;
    syncRoving();
    chosenEls.get(key)?.focus();
  }

  /**
   * Brings both grids in line with the list the controller says it paints.
   *
   * That list is not the one this renderer was handed: a held value the options do not contain is
   * painted as an option of its own, so the person who has to correct it can see it and take it
   * off. Building the chips once would leave such a value invisible and impossible to remove.
   */
  function syncGrids(painted: readonly MdySelectOption<unknown>[]): void {
    const wanted = new Set<string>();
    for (const option of painted) {
      const key = keyFor(option);
      wanted.add(key);
      if (!optionEls.has(key)) {
        const handles = [overlay].map((target) => {
          const handle = buildChip(option, key);
          const wrapper = el("div", parts.optionWrapper.classes.join(" "));
          wrapper.appendChild(handle.chip);
          target.grid.appendChild(wrapper);
          target.chips.set(key, handle);
          return handle;
        });
        optionEls.set(key, handles);
      }
      // Appending an element already in a grid moves it, which keeps the order the controller's.
      for (const target of [overlay]) {
        const chip = target.chips.get(key);
        if (chip?.chip.parentElement) target.grid.appendChild(chip.chip.parentElement);
      }
    }
    for (const key of [...optionEls.keys()]) {
      if (wanted.has(key)) continue;
      for (const target of [overlay]) {
        target.chips.get(key)?.chip.parentElement?.remove();
        target.chips.delete(key);
      }
      optionEls.delete(key);
    }
  }
  syncGrids(controller.state().options);

  insertControl(shell, control);
  container.appendChild(shell.root);
  // Document-level so no scroll container or renderer frame can clip the popup, exactly as the
  // select renderer portals its own listbox.
  document.body.appendChild(popup);

  const lookup: MdyElementLookup = (part, key) => {
    // The search button is what opened the popup, so it is what focus goes back to.
    if (part === "trigger") return trigger;
    if (part === "search") return search;
    if (part === "option" && key) return optionEls.get(key)?.[0]?.chip;
    return undefined;
  };
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    runCommands(controller.dispatch(intent), lookup, {
      setOpen: () => undefined, // reflected reactively below, nothing extra to do
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  trigger.addEventListener("click", () => dispatch({ type: "toggleOpen" }));
  search.addEventListener("input", () => dispatch({ type: "search", query: search.value }));
  /**
   * The keyboard policy is `multiselectOverlayAction`, not a handler here.
   *
   * This renderer answered **only Escape**: no opening, no Tab, no navigation. A list opened with a
   * pointer could not be left with the keyboard except by Escape.
   *
   * `move` and `select` are dispatched now. They used to be dropped because the controller had no
   * cursor to move, so a person who opened the list with a keyboard could reach the filter box and
   * nothing else — the policy had returned both all along with nowhere to send them.
   */
  const onKeydown = (event: KeyboardEvent): void => {
    const state = controller.state();
    const action = multiselectOverlayAction({
      key: event.key,
      open: state.open,
      query: search.value,
      activeKey: state.activeKey,
    });
    if (!action) return;
    // Tab keeps its native meaning: the list closes and focus carries on to the next control.
    if (event.key !== "Tab") event.preventDefault();
    dispatch(action);
  };
  control.addEventListener("keydown", onKeydown);
  popup.addEventListener("keydown", onKeydown);

  const undismiss = dismissOnOutsidePointer(
    [shell.root, popup],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
  );
  const untrack = trackOverlay(popup, shell.wrapper, () => controller.state().open, anchoring);

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();

    applyPart(shell.root, view.root);
    applyPart(shell.label, view.parts.label);
    // The label names the control that holds the value, which is the trigger — the same relation the
    // single-choice sibling has. Left on the wrapper, the label named a box rather than a control.
    shell.label.htmlFor = view.parts.trigger.id ?? "";
    // The projection's `trigger` describes the control *area* — its classes are the input wrapper's
    // — and its opener semantics. Here those live on two elements: the wrapper is the area, the
    // button is what opens the popup. Applying the whole part put `mdy-multiselect` on the button
    // as well, so one class named two elements and the catalogue's singular `inputWrapper` had two
    // candidates.
    // The projection's `trigger` describes what opens the popup, and here that is the button the
    // chips sit in. Its classes come from the part; the wrapper around it keeps the field's box.
    applyPart(trigger, view.parts.trigger);
    applyPart(announcement, view.parts.announcement);
    // The change, not the list, and nothing while the popup is open — the options there announce
    // themselves natively, so a region firing too makes every toggle speak twice.
    const nowChosen = stripOrder();
    if (saySoon !== null) {
      setText(announcement, saySoon);
      saySoon = null;
      saidLast = nowChosen;
      return;
    }
    // A render that describes no change leaves the region alone. Writing "" over a sentence is what
    // takes it back before a reader has reached it — and a second pass over the same state is an
    // ordinary thing for a renderer to do.
    const said = multiselectAnnouncement(
      saidLast, nowChosen,
      { added: messages.selectionAdded, removed: messages.selectionRemoved, empty: messages.selectionEmpty },
      (key) => state.options.find((option) => keyFor(option) === key)?.label ?? key,
      state.open,
    );
    if (said !== "") setText(announcement, said);
    saidLast = nowChosen;
    syncChips(state);
    setText(placeholder, f.placeholder ?? "");
    applyPart(popup, view.parts.popup);
    applyPart(search, view.parts.search);
    // Where the keyboard is in the list, said to a reader. The cursor is not focus — focus stays in
    // the box a person is typing into — so the only way to announce it is to name it.
    if (state.activeKey === null) search.removeAttribute("aria-activedescendant");
    else search.setAttribute("aria-activedescendant", view.parts[state.activeKey]?.id ?? "");
    applyPart(overlay.grid, view.parts.group);
    syncGrids(state.options);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, shownErrorsOf(handle).map((e) => e.message));
    shell.syncState({
      open: state.open,
      touched: state.touched,
      disabled: state.disabled,
      readonly: state.readonly,
      hasError: state.invalid,
      filled: state.selectedKeys.size > 0,
      required: state.required,
    });

    // `hidden` on the popup part is the contract's; this re-states it through `reflectOverlayOpen` so
    // the popover state and the attribute cannot disagree. Positioning only runs while it is showing.
    reflectOverlayOpen(popup, state.open, messages);
    if (state.open) {
      positionOverlay(popup, shell.wrapper, anchoring);
      // Focus goes where the user is about to type, exactly as the select does. A search box that
      // opens without focus asks for a second click before a keystroke does anything, and a
      // keyboard user has no way to reach it at all without tabbing into a popup that just appeared.
      // The microtask is because the popup is shown in this same effect: focusing a `hidden` element
      // silently does nothing.
      // Where the person is about to work: the filter box when there is one, otherwise the first
      // option — a popup that opens with focus nowhere is one a keyboard cannot reach into.
      queueMicrotask(() => (searchable ? search : overlay.grid.querySelector<HTMLElement>(".mdy-chip") ?? overlay.grid).focus());
    } else {
      // The next opening decides its own side and height rather than inheriting this one's.
      releaseOverlayPlacement(popup);
      if (search.value) search.value = "";
    }

    for (const option of state.options) {
      const key = keyFor(option);
      const handles = optionEls.get(key);
      if (!handles) continue;
      const count = state.counts.get(key) ?? 0;
      // The classes a chip carries — variant and state — are the contract's answer, applied to both
      // grids so the field and the popup can never disagree about what is taken.
      const classes = multiselectChipClasses({ mode, selected: count > 0 });
      const part = view.parts[key];
      // One grid, in the popup, so it takes the part whole: the `hidden` that filtering writes and
      // the id the opener names both belong to it. There is no second copy to withhold either from.
      for (const handle of handles) {
        if (part) applyPart(handle.chip, part);
        handle.chip.className = classes.join(" ");
        if (handle.count) setText(handle.count, `×${count}`);
      }
    }
  });

  return withControls(
    () => {
    undismiss();
    untrack();
    effectRef.destroy();
    controller.destroy();
    popup.remove();
    shell.root.remove();
    },
    // The list can arrive after the field is on screen; the controller is told rather than the
    // field remounted, which would forget the query it was holding.
    { setOptions: (next) => controller.setOptions(next as never) },
  );
}
