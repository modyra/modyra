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
  beginChipReorder, syncSubmitValues,
  MDY_WIDGET_CONTRACTS,
  createMultiselectFieldController,
  chipActionName,
  defaultOptionKey,
  quantityAnnouncement,
  settledVoice,
  multiselectChipClasses,
  multiselectOverlayAction,
  overlayAnchoringFor,
  visibleErrorsOf,
  type MdyElementLookup,
  MDY_I18N_MESSAGES_DEFAULT,
  type MdyI18nMessages,
  keyBindingFor,
  chipFocusAfterRemoval,
  multiselectAnnouncement,
  chipMovedAnnouncement,

  stateClass,
  scrollChipStripByWheel,
  chipTooltipOffset,
  chosenKeyOrder,
  hiddenChipCount,
  keepFocusedChipInView,
  wayBackActionName,
  matchesKeyGesture,
  MDY_WIDGET_KEYBOARD,
  blocksValueChange,
  isTypeaheadCharacter,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setText, setIcon, setPresent } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { withControls, type MdyMountedField } from "../field-controls.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnFocusOutside } from "../overlay.js";
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
  /**
   * The key a value is identified by, which is the contract's and not this renderer's.
   *
   * `String(value)` renders every plain object as `[object Object]`, so two different choices held at
   * once arrived as one key: the field drew a single chip labelled as the first of them, taken twice,
   * with the counter agreeing. A person read a field asserting something they had not chosen.
   *
   * `defaultOptionKey` is what the controller derives its own keys with, so a renderer that spells the
   * derivation again is a second answer to a question already answered — and for primitives the two
   * agree exactly, which is why every fixture in this suite concurred and none of them could see it.
   */
  const keyFor = (option: MdySelectOption<unknown>) => defaultOptionKey(option.value);
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
  if (parts.chips.role) chipStrip.setAttribute("role", parts.chips.role);
  // A wheel reaches what has scrolled out of the strip. ADR 0127 allows the row to scroll only if
  // there is a mechanism rather than a cue, and many desktop mice have no horizontal axis at all.
  // Passive is wrong here: the point is to take the gesture, and a listener that cannot call
  // `preventDefault` leaves the page scrolling underneath as well.
  chipStrip.addEventListener("wheel", scrollChipStripByWheel, { passive: false });
  // ARIA structures a grid as grid → row → cell, and this strip is one row of cells. ADR 0148.
  const chipRow = el("div", parts.chipRow.classes.join(" "));
  if (parts.chipRow.role) chipRow.setAttribute("role", parts.chipRow.role);
  chipRow.setAttribute("aria-rowindex", "1");
  chipStrip.appendChild(chipRow);
  const placeholder = el("span", parts.placeholder.classes.join(" "));
  // The affordance at the trailing edge, as the single-choice sibling has. Decorative: the whole
  // control opens the popup, so this says which way it opens rather than being the way.
  const arrow = el("span", parts.arrow.classes.join(" "));
  arrow.setAttribute("aria-hidden", "true");
  // The same mark the single-choice list draws, from the same table. The sheet keeps a caret of its
  // own for a host that supplies no icons, but a renderer that has them must not draw a second
  // shape for one meaning: two marks saying "this opens" drift the moment either is redrawn.
  setIcon(arrow, "CHEVRON_DOWN");
  // Waiting on its options: the indicator goes on the control, so the field says it is loading
  // without being opened.
  if (f.loading) {
    const loading = el("span", parts.loading.classes.join(" "));
    loading.setAttribute("role", "status");
    trigger.appendChild(loading);
  }
  trigger.append(placeholder);
  // Said rather than shown: a choice lands and the strip is the only confirmation, which is the one
  // a person using a screen reader does not get.
  const announcement = el("div", parts.announcement.classes.join(" "));
  /**
   * Every choice off at once, at the trailing edge where the other controls of its column sit.
   *
   * Beside the trigger rather than inside it: the trigger is a button, and a button inside a button
   * is neither valid nor reachable. It is drawn only while there is something to clear.
   */
  const clearAll = el("button", parts.clearAll.classes.join(" ")) as HTMLButtonElement;
  clearAll.type = "button";
  clearAll.setAttribute("aria-label", messages.clearSelection);
  // A button whose whole visible content is a mark has nothing a person driving by voice can say.
  // The tooltip is the word itself, and it matches the name.
  clearAll.title = messages.clearSelection;
  setIcon(clearAll, "CLOSE");
  /**
   * The one way back, under the control.
   *
   * Untimed: a message that disappears after five seconds is a time limit under 2.2.1, and an undo
   * has no exception under it. It stands until it is used or another act replaces it — and the
   * person who most needs it is the slowest to reach it, because the keyboard path to the field's
   * trailing edge runs through every chip.
   *
   * A mark rather than a sentence, so the act lives in its accessible name. What happened is said by
   * the live region, which owes that announcement whether or not a way back is on offer.
   */
  const wayBackAction = el("button", parts.wayBackAction.classes.join(" ")) as HTMLButtonElement;
  wayBackAction.type = "button";
  setIcon(wayBackAction, "UNDO");
  /**
   * One tooltip for the control, not one per chip.
   *
   * A child of the chip is part of the chip's own text: the name a chip composes from its contents
   * said the label twice, and every reading of the strip did too.
   */
  const chipTooltip = el("span", parts.chipTooltip.classes.join(" "));
  chipTooltip.id = `${widgetId}__chiptip`;
  chipTooltip.setAttribute("role", "tooltip");
  chipTooltip.hidden = true;

  function revealChipName(chip: HTMLElement, key: string): void {
    setText(chipTooltip, labelOfChip(key));
    chipTooltip.style.insetInlineStart = `${chipTooltipOffset(chip, chipStrip)}px`;
    chipTooltip.hidden = false;
    chip.setAttribute("aria-describedby", chipTooltip.id);
  }

  function hideChipName(): void {
    chipTooltip.hidden = true;
  }

  /**
   * How many chips are out of sight, and the way to all of them.
   *
   * ADR 0127 lets the row scroll only where something reaches what leaves it. The wheel is that for
   * most people and nothing at all for a pointer with no horizontal axis, which is most desktop
   * mice — so one control states the count and acts on it, rather than a cue saying *there is more*
   * beside a trigger that mentions none of it.
   */
  const overflow = el("button", parts.overflowCount.classes.join(" ")) as HTMLButtonElement;
  overflow.type = "button";
  overflow.hidden = true;
  overflow.addEventListener("click", (event) => {
    event.stopPropagation();
    dispatch({ type: "open" });
  });

  /** Measured after every render, because how many fit depends on the labels and the width given. */
  function syncOverflow(): void {
    const hidden = hiddenChipCount(chipStrip);
    overflow.hidden = hidden === 0;
    if (hidden > 0) {
      setText(overflow, messages.chipsHiddenShort.replace("{count}", String(hidden)));
      overflow.setAttribute("aria-label", messages.chipsHidden.replace("{count}", String(hidden)));
    }
    // The affordance takes its width out of the strip, so a chip the browser scrolled to on focus is
    // outside again by about that width. Whatever the strip ends up as wide as, the focused chip is
    // inside it.
    keepFocusedChipInView(chipStrip);
  }

  // The strip before the opener, in the order they are read: the chips are what the field holds and
  // the opener is the space after them. Siblings, not one inside the other — a chip carries a button
  // that takes a value off, and a control that opens something may not contain a control that
  // destroys something (ADR 0142). It is also what makes the opener a valid button again.
  control.append(chipStrip, trigger, overflow, wayBackAction, clearAll, arrow, announcement, chipTooltip);

  /**
   * The box forwards a press on its own empty space to the opener.
   *
   * Pressing the field anywhere it is not a chip still opens the list, which is what a person expects
   * of a box shaped like a field — but it is a behaviour of the box rather than a consequence of the
   * opener containing everything. A press that lands on a chip is a press on the chip, and no
   * arrangement of pixels can turn it into a press on the opener.
   *
   * **On the release, not on the press**, which is what makes the gesture cancellable: beginning a
   * press and moving away before letting go is how a person takes a tap back, and it is the whole of
   * WCAG 2.5.2. It is also what the opener this forwards to already does — a button activates on
   * release — so a field whose empty space acted sooner would give one control two activation models
   * depending on which pixel was hit.
   *
   * The press half is still cancelled, so the box does not take focus from the opener it is about to
   * hand it to; focus is placed before the list opens, because the opener is what carries the
   * expanded state and answers the keyboard.
   */
  control.addEventListener("pointerdown", (event) => {
    if (event.target !== control) return;
    event.preventDefault();
  });

  control.addEventListener("click", (event) => {
    if (event.target !== control) return;
    trigger.focus();
    dispatch({ type: controller.state().open ? "close" : "open" });
  });

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
  /** Whether the popup was already showing on the previous pass, so focus is placed once. */
  let wasOpen = false;
  let saySoon: string | null = null;

  /**
   * A sentence said now, for a change no render follows.
   *
   * Picking a chip up and putting it down move nothing, so nothing re-renders and `saySoon` — which
   * the render pass drains — would sit unsaid until the next unrelated change. The live region is an
   * element; this writes to it the way that pass does.
   */
  const sayNow = (sentence: string): void => {
    setText(announcement, sentence);
  };
  /**
   * The quantity, said once the pressing stops.
   *
   * A held arrow steps many times, and a live region read on every step reads out a backlog after the
   * person has let go. This says the value the gesture ended on.
   */
  const quantityVoice = settledVoice(sayNow);
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
    // One role whatever the chip holds, and it is the catalogue's: an item of the strip's list. A
    // chip cannot be both the item at position 3 of 12 and the number 3 of a range — and the role
    // that carries the position is the one ADR 0127 pays with.
    if (parts.chip.role) chip.setAttribute("role", parts.chip.role);
    chip.addEventListener("focus", () => {
      activeChip = key;
      syncRoving();
      // After the paint, because the browser's own scroll-into-view happens first and the strip may
      // still be about to change width around it. A focused chip nobody can see is a keyboard trap.
      requestAnimationFrame(() => keepFocusedChipInView(chipStrip));
    });
    // Rearranging what was chosen, from the chip a person is looking at. The keys are the
    // contract's — a renderer choosing its own is how three of them come to answer differently —
    // and the direction comes from the binding rather than from the key, because the strip runs in
    // the writing direction and `ArrowLeft` moves a chip *later* in a right-to-left document.
    chip.addEventListener("keydown", (event) => {
      // A key pressed on a control the chip carries is that control's, not the chip's. The chip's own
      // bindings share `Enter` and `Space` with the platform's activation of a button, so answering
      // here takes the key from the button a person has focused inside it — and the chip does
      // something else with it, which is worse than doing nothing.
      if (event.target !== chip) return;
      const combo = `${event.altKey ? "Alt+" : ""}${event.key}`;
      // Asked as the chip. A key with no binding here belongs to the control and must reach it —
      // `ArrowDown` opens the popup from the trigger, arrows move the chip (grabbed or not).
      const binding = keyBindingFor("multiselect", combo, controller.state().open, "chip");
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
        // Held, the arrows carry the chip; free, they walk the strip. One movement, and what moves
        // is whatever the grab says the subject is.
        if (grabbed !== null && grabbed.key === key) {
          if (to === at) return;
          saySoon = chipMovedAnnouncement(messages.selectionMoved, labelOfChip(key), to + 1, order.length);
          dispatch({ type: "move-selected", optionKey: key, to });
          queueMicrotask(() => chosenEls.get(key)?.focus());
          return;
        }
        focusChip(order[to]);
        return;
      }
      // Picking up and putting down, one key. Announced both ways, because a state nobody is told
      // about is one they cannot know they are in — the arrows would carry a chip they believe is
      // still walking the strip.
      if (binding.intent === "grab") {
        if (!reorderable) return;
        event.preventDefault();
        const at = order.indexOf(key);
        if (grabbed !== null && grabbed.key === key) {
          grabbed = null;
          chip.classList.remove(stateClass(parts.chip.classes[0]!, "dragging"));
          sayNow(chipMovedAnnouncement(messages.selectionDropped, labelOfChip(key), at + 1, order.length));
        } else {
          grabbed = { key, from: at };
          chip.classList.add(stateClass(parts.chip.classes[0]!, "dragging"));
          sayNow(chipMovedAnnouncement(messages.selectionGrabbed, labelOfChip(key), at + 1, order.length));
        }
        return;
      }
      // Putting it back where it was picked up from. Only while something is held — otherwise this
      // key belongs to whatever else answers Escape.
      if (binding.intent === "cancel") {
        if (grabbed === null || grabbed.key !== key) return;
        event.preventDefault();
        const home = grabbed.from;
        grabbed = null;
        chip.classList.remove(stateClass(parts.chip.classes[0]!, "dragging"));
        saySoon = chipMovedAnnouncement(messages.selectionReturned, labelOfChip(key), home + 1, order.length);
        dispatch({ type: "move-selected", optionKey: key, to: home });
        queueMicrotask(() => chosenEls.get(key)?.focus());
        return;
      }
      // The quantity, from the keyboard. The ± controls are `tabindex="-1"` pointer affordances, so
      // these two keys are the only way to a counter chip's number without a mouse.
      if (binding.intent === "step") {
        event.preventDefault();
        dispatch(event.key === "ArrowUp" ? { type: "increment", optionKey: key } : { type: "decrement", optionKey: key });
        sayQuantity(key);
        // The chip is rebuilt when its steppers come or go, so focus has to be put back on the one
        // that replaced it — otherwise the second press of a spin goes to the document.
        queueMicrotask(() => chosenEls.get(key)?.focus());
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
    });
    const step = (delta: -1 | 1, label: string) => {
      const button = el("button", parts.optionStep.classes.join(" ")) as HTMLButtonElement;
      button.type = "button";
      // The mark, from the same icon set the grid's steppers use. Written there and not here, the
      // chip's two steppers were 32×24 of nothing: they took their space, answered a press and told
      // a person nothing, so the only way to find one was to press the blank and watch the number.
      setIcon(button, delta === 1 ? "PLUS" : "MINUS");
      // Out of the tab order with the chip that holds it: the strip is one stop, and its controls
      // are reached with the keys the contract declares rather than by tabbing through every one.
      button.tabIndex = -1;
      button.setAttribute("aria-label", label);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        dispatch(delta === 1 ? { type: "increment", optionKey: key } : { type: "decrement", optionKey: key });
        sayQuantity(key);
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
        beginChipReorder(event, chip, {
          draggingClass: stateClass(parts.chip.classes[0]!, "dragging"),
          midpoints: () => stripOrder().map((each) => {
            const box = chosenEls.get(each)?.getBoundingClientRect();
            return box ? box.left + box.width / 2 : 0;
          }),
          from: () => stripOrder().indexOf(key),
          onDrop: (to) => {
            saySoon = chipMovedAnnouncement(messages.selectionMoved, labelOfChip(key), to + 1, stripOrder().length);
            dispatch({ type: "move-selected", optionKey: key, to });
            activeChip = key;
            syncRoving();
          },
        });
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
    // Named where the label is written, not here: at build time this chip is not in the strip yet,
    // so asking it what it says answers with the key.
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
    // The full name, for a chip the strip had to cut. Shown on hover *and* on focus: WCAG 1.4.13
    // asks for both, and `title` is neither — it never appears for a keyboard or a touch user, who
    // are exactly the people who cannot widen the chip to read it.
    const reveal = () => revealChipName(chip, key);
    chip.addEventListener("pointerenter", reveal);
    chip.addEventListener("focus", reveal);
    chip.addEventListener("pointerleave", hideChipName);
    chip.addEventListener("blur", hideChipName);
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
      // The button that takes this one off says which one it takes: a strip of eight offers eight
      // controls, and a name that is only the verb is the same name on all of them.
      chip.querySelector(`.${parts.chipRemove.classes[0]}`)
        ?.setAttribute("aria-label", chipActionName(messages.chipRemoveLabel, label));
      // And every other button in the chip, by the same rule. Read from the accessibility tree, the
      // steppers were four controls called "One fewer" and "One more" beside two that said which
      // value they removed — and stepping down from one is what removes it, so the pair that
      // destroys was the pair that did not say what it would destroy.
      //
      // Named here rather than where the buttons are built: the label belongs to the value this chip
      // is showing now, and at build time the chip is still empty.
      const named = (selector: string, verb: string, at = 0): void => {
        chip.querySelectorAll(selector)[at]
          ?.setAttribute("aria-label", chipActionName(verb, label));
      };
      named(`.${parts.optionStep.classes[0]}`, messages.chipDecrementLabel, 0);
      named(`.${parts.optionStep.classes[0]}`, messages.chipIncrementLabel, 1);
      named(`.${parts.chipMove.classes[0]}`, messages.chipMoveEarlierLabel, 0);
      named(`.${parts.chipMove.classes[0]}`, messages.chipMoveLaterLabel, 1);
      // Where this chip sits and how many there are, stated on the chip itself. Independent of the
      // live region and of anything drawn: it survives a stripped stylesheet and a dropped
      // announcement, which the other two do not.
      // No `aria-value*`: the chip is a list item and those belong to a range widget. The quantity
      // is in the name above and in the announcement the change makes, which is where a list item's
      // number is heard.
      // Which of how many, in the grid's vocabulary — the column index, not a list's position: a gridcell does not carry aria-posinset/aria-setsize and the accessibility layer discarded them. ADR 0148.
      chip.setAttribute("aria-colindex", String(wanted.length));
      // The full name, for a chip the strip has narrowed to an ellipsis. `title` is the pointer's
      // half of that; a theme draws the other on focus and long press, which is what reaches a
      // keyboard and a touch.
      chip.title = label;
      // Appending an element already in the strip moves it, which keeps the order the value's.
      chipRow.appendChild(chip);
      // How many cells the grid has, said on the grid: a reader announces the cell's index against
      // it — "column 3 of 12". ADR 0148.
    }
    // The grid arrives with the first chip and leaves with the last, and it is the whole element
    // that comes and goes rather than its role. A container for a set with no members is not a
    // smaller version of the set: `grid` requires rows and `row` requires cells, so an empty one
    // announces "Selected values, grid" and sends a person looking for something that is not there.
    // The correct rendering of *nothing chosen* is no grid, the way the correct rendering of *no
    // errors* is no error message. ADR 0148.
    //
    // What says the field is empty is the field's own value — the placeholder — not an empty
    // container. And nothing in the empty region is a tab stop, which an empty roving composite
    // would be.
    if (tally.size > 0) {
      // How many cells the grid has, said on the grid: a reader announces the cell's index against
      // it — "column 3 of 12".
      chipStrip.setAttribute("aria-colcount", String(tally.size));
      chipStrip.setAttribute("aria-rowcount", "1");
      // First in the box: the reading order is the contract's, and the strip is what the field holds.
      if (chipStrip.parentElement === null) control.insertBefore(chipStrip, control.firstChild);
    } else {
      chipStrip.remove();
    }
    for (const key of [...chosenEls.keys()]) {
      if (tally.has(key)) continue;
      chosenEls.get(key)?.remove();
      chosenEls.delete(key);
    }
    // On the page while there is nothing chosen, and off it once there is: the contract says present
    // *when*, and an element kept and hidden is a part drawn while its condition is false.
    setPresent(placeholder, trigger, null, tally.size === 0);
    syncRoving();
  }

  /** What a chip is called, for a sentence about it. */
  /**
   * What the field now holds of one value, offered to the settling voice.
   *
   * Nothing is said for a quantity that reached zero: the value is gone, and the removal has its own
   * sentence and its own way back.
   */
  function sayQuantity(key: string): void {
    const count = controller.state().counts.get(key) ?? 0;
    if (count === 0) return;
    quantityVoice.announce(quantityAnnouncement(
      labelOfChip(key),
      count,
      { settled: messages.quantitySettled, atMinimum: messages.quantityAtMinimum },
    ));
  }

  function labelOfChip(key: string): string {
    return chosenEls.get(key)?.querySelector(`.${parts.optionLabel.classes[0]}`)?.textContent ?? key;
  }

  /** The chips in the order the value has them, which is the order the strip draws. */
  function stripOrder(): readonly string[] {
    return chosenKeyOrder(controller.state());
  }

  /**
   * The chip a person is carrying, and where they picked it up from.
   *
   * A grab is a state and the arrows read it: the same key walks the strip when nothing is held and
   * carries what is held when something is. `from` is what `Escape` puts back — a person who picks
   * up the wrong chip has to be able to abandon the move, not undo it afterwards.
   */
  let grabbed: { readonly key: string; readonly from: number } | null = null;

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
    // Where the next option belongs, counted as they are placed: an option already sitting there is
    // left alone.
    let placed = 0;
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
      // Appending an element already in a grid moves it, which keeps the order the controller's —
      // and only when it is not already where it belongs. Moving a node in the DOM takes focus off
      // it, so re-appending every option on every pass sent the keyboard to the document the moment
      // somebody chose one with the pointer: the popup was then open with nothing focused inside it,
      // and `Escape` reached no listener.
      for (const target of [overlay]) {
        const chip = target.chips.get(key);
        const wrapper = chip?.chip.parentElement;
        if (wrapper && wrapper !== target.grid.children[placed]) target.grid.appendChild(wrapper);
      }
      placed += 1;
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
  clearAll.addEventListener("click", () => {
    // A second lock, and not the one that holds: the controller refuses a clear on a field out of
    // play, and clearing an already-empty one changes nothing — so removing this line is not
    // observable from the value, the flags, or the page. Measured, rather than assumed by having
    // written it. It is here because the attribute makes a promise and a promise kept two layers
    // down stops being kept the day that layer changes its mind.
    if (clearAll.getAttribute("aria-disabled") === "true") return;
    dispatch({ type: "clear" });
  });
  wayBackAction.addEventListener("click", () => {
    if (wayBackAction.getAttribute("aria-disabled") === "true") return;
    undoAndLand();
  });
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
  /**
   * Whether a key that reached the box was aimed at the box.
   *
   * The bindings this policy answers name the part they belong to — `Enter` and `Space` are declared
   * `on: "trigger"` — and a command standing inside the field is a different part. Every one of them
   * is a `<button>`, which the platform already activates with both keys; answering the key here as
   * the field's own calls `preventDefault` on it, and the button a person has focused draws its ring,
   * says it can be operated, and does nothing.
   *
   * Compared against the opener by identity, not by tag: the opener is a button too, and it is the
   * one part whose keys these are.
   */
  const aimedAtTheField = (target: EventTarget | null): boolean =>
    target === trigger || !(target instanceof HTMLElement) || target.closest("button") === null;

  /**
   * The way back, from wherever the person is standing in the field.
   *
   * Answered from the field's root rather than from the button that offers it: a removal leaves the
   * reading position among the chips, and a shortcut reachable only from the control at the far
   * trailing edge is a shortcut for somebody who has already walked there.
   *
   * Not while a person is typing. Inside a text box the same gesture is the platform's own undo of
   * what they have just written, and taking it would put a value back and lose a word.
   */
  const undoGesture = (event: KeyboardEvent): boolean => {
    const binding = MDY_WIDGET_KEYBOARD.multiselect.find((one) => one.intent === "undo");
    if (binding === undefined || !matchesKeyGesture(binding, event)) return false;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable]") !== null) return false;
    if (controller.state().wayBack === null) return false;
    event.preventDefault();
    undoAndLand();
    return true;
  };

  /**
   * Puts the value back and leaves the reading position on what came back.
   *
   * The offer is withdrawn by using it, so whatever held focus is gone from the page the moment it
   * works — and a reading position on nothing sends a keyboard back to the top of the document. The
   * value restored is where a person is looking, so it is where they are put; a restore with nothing
   * to land on falls back to the opener, which is the field itself.
   */
  const undoAndLand = (): void => {
    const restored = controller.state().wayBack?.optionKey ?? null;
    dispatch({ type: "undo" });
    queueMicrotask(() => {
      // Compared rather than selected: a value is whatever a document put in it, and a selector
      // built from one needs escaping that not every host this runs in provides.
      const landing = restored === null
        ? undefined
        : Array.from(chipStrip.querySelectorAll<HTMLElement>("[data-key]"))
          .find((chip) => chip.dataset.key === restored);
      (landing ?? trigger).focus();
    });
  };

  const onKeydown = (event: KeyboardEvent): void => {
    const state = controller.state();
    const action = multiselectOverlayAction({
      key: event,
      open: state.open,
      query: search.value,
      activeKey: state.activeKey,
      mode,
    });
    // A letter typed at an open list without a filter box moves the cursor to the first match. Only
    // without one: the two would compete for the same keystrokes, and a searchable popup already
    // answers typing by narrowing the list.
    if (!action && !searchable && state.open && isTypeaheadCharacter(event.key, event)) {
      event.preventDefault();
      dispatch({ type: "typeahead", character: event.key });
      followCursor();
      return;
    }
    if (!action) return;
    // Tab keeps its native meaning: the list closes and focus carries on to the next control.
    if (event.key !== "Tab") event.preventDefault();
    // The quantity on the option the cursor is on. The `±` buttons drawn in each option are
    // `tabindex="-1"` pointer affordances, so without this the number on a row can be changed with a
    // mouse and with nothing else.
    if (action.type === "step") {
      dispatch(action.by === 1 ? { type: "increment", optionKey: action.optionKey } : { type: "decrement", optionKey: action.optionKey });
      followCursor();
      return;
    }
    // This handler is a keydown, so a panel it opens is about to be given a keypress and opens with
    // somewhere for that press to land. ADR 0179.
    dispatch(action.type === "open" ? { ...action, by: "keyboard" } : action);
    if (action.type === "move" || action.type === "open") followCursor();
  };

  /**
   * Puts DOM focus on the option the cursor is on, where there is no filter box to name it.
   *
   * With a search box the cursor is announced through `aria-activedescendant` and focus stays where
   * a person is typing. Without one there is no element to carry that reference, so the cursor and
   * focus have to be the same thing — otherwise it moves and nothing on screen or in the
   * accessibility tree says so.
   */
  function followCursor(): void {
    if (searchable) return;
    const key = controller.state().activeKey;
    if (key === null) return;
    queueMicrotask(() => optionEls.get(key)?.[0]?.chip.focus());
  }
  // The guard is the box's and not the popup's: inside the popup an option *is* a button, and the
  // keys that move between options and commit one are exactly this policy's.
  shell.root.addEventListener("keydown", (event) => { undoGesture(event); });
  popup.addEventListener("keydown", (event) => { undoGesture(event); });
  control.addEventListener("keydown", (event) => { if (aimedAtTheField(event.target)) onKeydown(event); });
  popup.addEventListener("keydown", onKeydown);

  const undismiss = dismissOnOutsidePointer(
    [shell.root, popup],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
  );
  // The other half of how this kind says it is dismissed. A list left open behind a field somebody
  // has tabbed away from covers the next question and answers to a keyboard that has gone.
  const unfocusout = dismissOnFocusOutside("multiselect", [shell.root, popup],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
    { pointer: undismiss, markVisited: () => handle.markAsTouched() });
  const untrack = trackOverlay(popup, shell.wrapper, () => controller.state().open, anchoring);

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();

    applyPart(shell.root, view.root);
    // The values a native submit reads. This kind draws a button and a strip of chips, so without
    // these there is no form control anywhere in it and the browser sends nothing. One input per
    // chosen value, in order: a single joined key would lose the order and the multiplicity, which
    // is the whole of what this field is for.
    const chosen = handle.value();
    syncSubmitValues(control, f.name, Array.isArray(chosen) ? chosen : chosen === null || chosen === undefined ? [] : [chosen]);
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
      {
        added: messages.selectionAdded,
        removed: messages.selectionRemoved,
        empty: messages.selectionEmpty,
        removedLast: messages.selectionRemovedLast,
        addedMany: messages.selectionAddedMany,
        removedMany: messages.selectionRemovedMany,
        removedManyLast: messages.selectionRemovedManyLast,
      },
      (key) => state.options.find((option) => keyFor(option) === key)?.label ?? key,
    );
    if (said !== "") setText(announcement, said);
    saidLast = nowChosen;
    syncChips(state);
    setText(placeholder, f.placeholder ?? "");
    // Nothing chosen, nothing to clear: a control offering to empty an empty field is one more thing
    // in the column that does not answer.
    // Out of play is out of play for these two as well: hidden is a drawing decision, and a field
    // whose ARIA says disabled while a button beside it still answers is disabled in appearance only.
    const blocked = blocksValueChange(state.interactivity);
    /**
     * Always there, and dimmed where it cannot act.
     *
     * Hidden when there was nothing to clear, it came and went with the value — so the number of tab
     * stops in the field changed as somebody worked, and whoever had never used the control learned
     * it could be emptied only after filling it in. Whether a control exists is a fact about the
     * field; whether it can act is a fact about the moment, and the two change at different rates.
     *
     * `aria-disabled` rather than the property: the native one takes the button out of the tab order,
     * which is the moving-stops problem again — and takes focus with it when the state changes under
     * somebody who has just pressed it. Announced as unavailable, still reachable, refused in the
     * handler. ADR 0171.
     */
    const nothingToClear = nowChosen.length === 0 || blocked;
    clearAll.setAttribute("aria-disabled", String(nothingToClear));
    clearAll.classList.toggle(stateClass(parts.clearAll.classes[0]!, "disabled"), nothingToClear);
    // After the chips are in place: the measurement is of what was drawn, not of what is about to be.
    queueMicrotask(syncOverflow);
    // Out of play for this one as well: a field whose ARIA says disabled while a button beside it
    // still answers is disabled in appearance only.
    overflow.disabled = blocked;
    const back = state.wayBack;
    // The slot is always in the row and keeps its width at rest, so the clear-all beside it stands
    // where it stood whether or not a way back is on offer. A control that moves as the offer
    // arrives is one a person presses meaning the other.
    // The same rule as the clear-all beside it: always there, and dimmed where there is nothing to
    // put back. Hidden, it appeared the moment somebody removed a value and went the moment they used
    // it — a control arriving under the hands of whoever had just pressed the one next to it.
    wayBackAction.setAttribute("aria-disabled", String(back === null || blocked));
    wayBackAction.classList.toggle(stateClass(parts.wayBackAction.classes[0]!, "disabled"), back === null || blocked);
    // Named at rest as well: the control is on the page whether or not an act can be reversed, and a
    // button with no name is announced as "button". With nothing to put back the name is the bare
    // label — the act is what is missing, not the control.
    wayBackAction.setAttribute("aria-label", wayBackActionName(
      back,
      {
        label: messages.wayBackLabel,
        removed: messages.wayBackRemoved,
        moved: messages.wayBackMoved,
        cleared: messages.wayBackCleared,
      },
      (key) => state.options.find((option) => keyFor(option) === key)?.label ?? key,
    ));
    // Sighted pointer users read the same words the name carries; the mark alone says only that a
    // way back exists, not what it puts back.
    wayBackAction.title = wayBackAction.getAttribute("aria-label") ?? "";
    applyPart(popup, view.parts.popup);
    // Where the keyboard is in the list travels with the part: the projection names the cursor on
    // both the box and the trigger, because the reference is read from whichever of them holds
    // focus and only this field knows which it drew.
    applyPart(search, view.parts.search);
    applyPart(overlay.grid, view.parts.group);
    // What the query leaves, not everything the field was given: `state.options` is the whole list
    // and `filteredOptions` is what is left once `state.query` has narrowed it. Drawing the whole
    // list here leaves the box a person types into changing nothing they can see, while the
    // controller narrows agreeably out of sight.
    syncGrids(controller.filteredOptions());
    applyPart(shell.description, view.parts.description);
    // The description says what the document gave it and nothing more. The chips are the selection,
    // so a number beside them counts what is already on screen; the ones the strip scrolled past
    // belong at the strip's own edge, where the count is also the way to reach them.
    const described = f.supportingText ?? "";
    setText(shell.description, described);
    shell.description.hidden = described === "";
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, visibleErrorsOf(handle).map((e) => e.message));
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
    // Which way the caret points is the only thing on a closed control that says the list is
    // showing. The modifier is derived from the part's own class, so a rename in the catalogue moves
    // the rule and the renderer together instead of leaving one of them addressing a class nobody
    // writes any more.
    arrow.classList.toggle(stateClass(parts.arrow.classes[0] ?? "", "open"), state.open);
    if (state.open) {
      positionOverlay(popup, shell.wrapper, anchoring);
      // Focus goes where the user is about to type, exactly as the select does. A search box that
      // opens without focus asks for a second click before a keystroke does anything, and a
      // keyboard user has no way to reach it at all without tabbing into a popup that just appeared.
      // The microtask is because the popup is shown in this same effect: focusing a `hidden` element
      // silently does nothing.
      // Where the person is about to work: the filter box when there is one, otherwise the first
      // option — a popup that opens with focus nowhere is one a keyboard cannot reach into.
      //
      // On the *opening* only. This effect runs on every change while the popup is showing, and
      // placing focus each time put it back on the first option after every keystroke: the cursor
      // moved and focus was dragged home behind it, so the arrows appeared to do nothing at all.
      if (!wasOpen) {
        queueMicrotask(() => (searchable ? search : overlay.grid.querySelector<HTMLElement>(".mdy-chip") ?? overlay.grid).focus());
      }
      wasOpen = true;
    } else {
      wasOpen = false;
      // The next opening decides its own side and height rather than inheriting this one's.
      releaseOverlayPlacement(popup);
      if (search.value) search.value = "";
    }

    for (const option of state.options) {
      const key = keyFor(option);
      const handles = optionEls.get(key);
      if (!handles) continue;
      const count = state.counts.get(key) ?? 0;
      // The classes a chip carries — variant and state — are the contract's answer, and the part
      // carries all of them. Writing a locally built list over the applied part dropped whatever the
      // projection knows and this file does not: the reading position was the first casualty, so the
      // cursor walked the list with nothing on screen following it.
      const part = view.parts[key];
      // One grid, in the popup, so it takes the part whole: the `hidden` that filtering writes and
      // the id the opener names both belong to it. There is no second copy to withhold either from.
      for (const handle of handles) {
        if (part) applyPart(handle.chip, part);
        else handle.chip.className = multiselectChipClasses({ mode, selected: count > 0 }).join(" ");
        if (handle.count) setText(handle.count, `×${count}`);
      }
    }
  });

  return withControls(
    () => {
    undismiss();
    unfocusout();
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
