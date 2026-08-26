/**
 * What a widget *does*, as against what it is.
 *
 * Dimension 5 of the specification. The anatomy says a select has a popup and the state contract
 * says it may be open; neither says that clicking the trigger opens it, that Escape closes it, or
 * that closing puts focus back where the user left it. Those are the parts of a widget a user
 * actually experiences, and they were expressed only as the behaviour of two shared functions.
 *
 * Declared independently of those functions on purpose. A table derived from the implementation
 * checks nothing; this states what the transitions are supposed to be, and
 * `transitions.spec.mjs` holds {@link overlayLifecycleTransition} — the one every renderer routes
 * through — and {@link widgetKeyIntent} to it.
 */
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "./catalog.js";

/** What the user did. */
export type MdyTransitionTrigger =
  /** A pointer press on a part. */
  | { readonly type: "pointer"; readonly part: string }
  | { readonly type: "key"; readonly key: string }
  /** A pointer press anywhere outside the widget. */
  | { readonly type: "outside" };

/** Whether the widget's overlay is showing. The only lifecycle state a transition moves between. */
export type MdyOverlayPhase = "open" | "closed";

export interface MdyWidgetTransition {
  readonly from: MdyOverlayPhase;
  readonly trigger: MdyTransitionTrigger;
  readonly to: MdyOverlayPhase;
  /**
   * Whether closing returns focus to the opener.
   *
   * Only the *deliberate* dismissals restore it. A pointer landing outside moved the user's
   * attention somewhere themselves, and pulling focus back from wherever they clicked is the
   * behaviour that makes an overlay feel like a trap.
   */
  readonly restoresFocus?: boolean;
}

/**
 * A disabled widget does not transition at all.
 *
 * Stated as data rather than left implicit: "nothing happens" is a behaviour a renderer has to
 * implement, and a disabled trigger that still opens its popup is a real defect that looks like no
 * transition being declared.
 */
export const MDY_DISABLED_BLOCKS_TRANSITIONS = true;

function transitionsFor(kind: MdyWidgetKind): readonly MdyWidgetTransition[] {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const opener = MDY_POPUP_OPENERS[kind];
  if (!definition.capabilities.overlay || !opener) return Object.freeze([]);

  const transitions: MdyWidgetTransition[] = [
    { from: "closed", trigger: { type: "pointer", part: opener.opener }, to: "open" },
    // The same press again closes it: an opener is a toggle, not a one-way switch.
    //
    // Except where the opener is the control the user types into. A press there is the user placing
    // the caret, and answering it by closing the calendar takes the field away at the moment they
    // reached for it. The rule was written for a button and applied to every opener alike, and one
    // renderer implemented it literally while another did not — so the same click did different
    // things depending on who drew the widget, with the contract endorsing the worse of the two.
    ...(opener.typeable
      ? []
      : [{ from: "open" as const, trigger: { type: "pointer" as const, part: opener.opener }, to: "closed" as const }]),
    { from: "open", trigger: { type: "key", key: "Escape" }, to: "closed", restoresFocus: true },
  ];

  if (definition.capabilities.dismissOnOutsidePointer) {
    transitions.push({ from: "open", trigger: { type: "outside" }, to: "closed" });
  }

  return Object.freeze(transitions);
}

/** Every transition each kind admits. A kind with no overlay declares none — yet. */
export const MDY_WIDGET_TRANSITIONS: Readonly<Record<MdyWidgetKind, readonly MdyWidgetTransition[]>> =
  Object.freeze(
    Object.fromEntries(
      (Object.keys(MDY_WIDGET_CONTRACTS) as MdyWidgetKind[]).map((kind) => [kind, Object.freeze(transitionsFor(kind).map((entry) => Object.freeze({
        ...entry,
        // One level deeper than the entry itself: a trigger and a list of parts are objects the
        // caller holds a reference to, and an entry frozen around live members is not frozen.
        ...Object.fromEntries(
          Object.entries(entry)
            .filter(([, member]) => member !== null && typeof member === "object")
            .map(([key, member]) => [key, Object.freeze(member)]),
        ),
      })))]),
    ) as Record<MdyWidgetKind, readonly MdyWidgetTransition[]>,
  );

/** The transitions a kind admits from a given phase. */
export function transitionsFrom(
  kind: MdyWidgetKind,
  phase: MdyOverlayPhase,
): readonly MdyWidgetTransition[] {
  return MDY_WIDGET_TRANSITIONS[kind].filter((transition) => transition.from === phase);
}

/**
 * What a key does, per kind.
 *
 * `widgetKeyIntent` answered this for years without asking which widget it was looking at: every
 * kind but `number` was told ArrowDown means "move to the next option", so a text field navigated a
 * list it does not have, a textarea was told Enter opens something, and a slider — whose arrows must
 * change its value — was given list navigation instead of a step.
 *
 * What a key may do follows from what the kind *is*: a widget with options navigates them, one with
 * a range steps it, one with two states toggles, one with an overlay opens and closes it. Declaring
 * that per kind is what stops the answer from being the same everywhere.
 */
export interface MdyKeyBinding {
  readonly key: string;
  /** Only when the overlay is showing, only when it is not, or either way. */
  readonly when?: MdyOverlayPhase;
  readonly intent: "move" | "step" | "toggle" | "open" | "commit" | "cancel" | "reorder" | "remove" | "grab" | "undo";
  /**
   * Which way a `reorder` goes: `-1` earlier in the value, `1` later.
   *
   * Declared rather than derived from the key, because "earlier" is not "left": the strip runs in
   * the writing direction, so in a right-to-left document `ArrowLeft` moves a chip *later*. A
   * renderer that read the key would have to know that; reading the direction, it does not.
   */
  readonly by?: -1 | 1;
  /** Whether a `move` goes as far as it can rather than one place — `Home` and `End`. */
  readonly toEnd?: boolean;
  /**
   * Which part answers this key, where it is not the control.
   *
   * `ArrowDown` opens a closed multiselect and steps the quantity on a focused counter chip: one
   * key, two meanings, decided by where a person is rather than by which binding was declared first.
   * Without this the table could only say *this kind answers this key*, and the second declaration
   * was unreachable — a binding that exists and can never be resolved.
   */
  readonly on?: string;
  /**
   * Whether dismissing on this key returns focus to the opener. Only a `cancel` dismisses, so only a
   * `cancel` answers it, and the default is to restore.
   *
   * The two dismissals differ, and the difference is the whole reason this is declared rather than
   * assumed. Escape means *put me back where I was*, so focus returns to the opener. Tab is already
   * carrying focus to the next control, and pulling it back would trap the user in the field they
   * just left — the same key, the same close, the opposite answer.
   */
  readonly restoresFocus?: boolean;
  /**
   * A field-level capability this binding depends on, where the kind alone does not decide it.
   *
   * `on` says *which part answers a key*; this says *whether the key exists at all* for this field.
   * Reordering a chosen value is the case that forced it: every multiselect has chips, and only one
   * declared `reorderable` has an order a person may change — so the two `Alt`+arrow bindings belong
   * to the kind and not to every field of it.
   *
   * Without it the table said a kind answers four keys that a default field answers none of, and
   * anything reading it across kinds — a sweep, a help panel, a consumer's own handler — had to
   * carry its own list of which. A capability named here is one it can ask the field about.
   */
  readonly requires?: string;
  /**
   * The held key this binding needs, where the gesture is a shortcut rather than a bare press.
   *
   * `"primary"` is the platform's own accelerator — `Cmd` where the platform uses it, `Ctrl`
   * everywhere else — and it is named that way because the two are not interchangeable: `Ctrl`+Z on
   * a Mac is not the undo gesture, and a table spelling both would declare a key half its readers
   * must ignore. `matchesKeyGesture` resolves it against an event, so the platform test is made once
   * rather than in each renderer.
   */
  readonly modifier?: "primary";
}

/** Kinds whose value is chosen from a list the keyboard walks. */
const NAVIGATES_OPTIONS: readonly string[] = Object.freeze([
  "select", "multiselect", "radio", "segmented", "datepicker", "daterange", "timepicker", "colors",
]);
/** Kinds whose value is a point on a range the keyboard nudges. */
const STEPS_A_RANGE: readonly string[] = Object.freeze(["number", "slider"]);
/** Kinds with exactly two states, which Space flips. */
const TOGGLES: readonly string[] = Object.freeze(["checkbox", "toggle", "radio", "segmented"]);

function keyboardFor(kind: MdyWidgetKind): readonly MdyKeyBinding[] {
  const overlay = MDY_WIDGET_CONTRACTS[kind].capabilities.overlay;
  const bindings: MdyKeyBinding[] = [];

  if (overlay) {
    bindings.push({ key: "Escape", when: "open", intent: "cancel", restoresFocus: true });
    // Tab dismisses without taking focus back. Leaving it undeclared did not make the list stay
    // open — it made the *table* disagree with the policy the renderers actually call, so a renderer
    // built from the declared bindings alone left a popup floating over a form the user had left.
    //
    // Unless the popup has controls of its own to move between. A kind that declares an `actions`
    // bar has a confirm button in its overlay, and a Tab that dismisses makes that button
    // unreachable from a keyboard — so the widget's only way to commit is a pointer, which is
    // WCAG 2.1.1 and not a preference. There the key moves within the popup and the popup keeps it.
    //
    // Asked of the catalogue rather than of a list beside it: a kind that grows an action bar grows
    // this with it, and one that loses it loses this. `Escape` still cancels, in both shapes, and is
    // what a keyboard user leaves with.
    const keepsFocus = "actions" in MDY_WIDGET_CONTRACTS[kind].parts;
    bindings.push(keepsFocus
      ? { key: "Tab", when: "open", intent: "move" }
      : { key: "Tab", when: "open", intent: "cancel", restoresFocus: false });
    // Which part a key opens from, named rather than left to mean "anywhere on this widget". A
    // closed control used to be one thing to press; a multiselect's closed control now holds a strip
    // of chips with keys of their own, and a binding with no part claimed those too — so `Enter`
    // meant both "open the list" and "pick up this chip", decided by whichever handler ran first.
    // `MDY_POPUP_OPENERS` already says which part a person opens this kind with.
    const opensFrom = MDY_POPUP_OPENERS[kind]?.opener;
    const from = opensFrom === undefined ? {} : { on: opensFrom };
    bindings.push({ key: "Enter", when: "closed", intent: "open", ...from });
    bindings.push({ key: "Enter", when: "open", intent: "commit" });
    // The combobox pattern, and only for a kind that is one: pressing an arrow on a closed control
    // opens it rather than doing nothing, which is how a keyboard user reaches the list at all.
    //
    // Both directions, and neither carries a move. APG has the up arrow open *onto the last option*
    // and the down arrow onto the first — which is what happens here anyway, one layer down:
    // `listboxNavigationIndex` answers `ArrowUp` from nothing-active with the last option and
    // `ArrowDown` with the first. Declaring a second intent on the same key would restate that in a
    // place it can drift from.
    //
    // An overlay that holds no options is not a combobox and this does not apply to it. A calendar,
    // a clock face and a colour palette are dialogs a button opens: the reasoning above is about
    // reaching the first or last *option*, and there is no such list to arrive in. Declared for them,
    // it described a behaviour no renderer implemented and none intended to — three of them omitted
    // it independently, which is the evidence that read as three oversights and was one rule applied
    // where it does not belong.
    //
    // The test is whether the kind declares a `listbox` part, which is the catalogue already saying
    // which overlays hold a list — not a second list to keep in step with it. `NAVIGATES_OPTIONS` is
    // the wrong question here and reads like the right one: a calendar *is* walked with the arrow
    // keys, inside its grid, which is a different statement from the arrows reaching a list that is
    // not on screen yet.
    // The test is whether the popup holds *options* — the catalogue already saying which overlays
    // hold a list. It used to ask for a `listbox` part, and the multiselect lost its arrows the day
    // that part was retired: its popup still held the same options under a different part name, so
    // a person who learned `ArrowDown` on one combobox no longer had it on the other.
    //
    // A calendar, a clock face and a colour palette are dialogs a button opens: the reasoning is
    // about reaching the first or last *option*, and there is no such list to arrive in. None of
    // them declares one, so this asks the right question of them too.
    if ("option" in MDY_WIDGET_CONTRACTS[kind].parts) {
      bindings.push({ key: "ArrowDown", when: "closed", intent: "open", ...from });
      bindings.push({ key: "ArrowUp", when: "closed", intent: "open", ...from });
    }
    // Space opens too — but only where the opener is not a control the user types into. In a text
    // field the space bar is a space character, and a widget that opened its calendar instead would
    // be unable to accept "12 March". The keyboard policy has opened on Space for as long as it has
    // existed and this table claimed the key for nothing, so the two disagreed in the same way they
    // did over Tab; declaring it needed the opener to be able to say what it is.
    if (!MDY_POPUP_OPENERS[kind]?.typeable) {
      bindings.push({ key: " ", when: "closed", intent: "open", ...from });
    }
  }
  if (NAVIGATES_OPTIONS.includes(kind)) {
    for (const key of ["ArrowDown", "ArrowUp"]) {
      bindings.push({ key, ...(overlay ? { when: "open" as const } : {}), intent: "move" });
    }
    // Home and End jump to the first and last option, which is the listbox and grid patterns. A
    // radio group is neither: APG gives it Tab, Space and the four arrows, and the arrows both move
    // and select, so there is no separate reading position for a jump to land on.
    //
    // Declared for one anyway, it describes a behaviour no renderer implements. That every
    // independent implementation of the same declaration omits the same binding is evidence about
    // the declaration, not about the implementations: one rule applied where it does not belong,
    // which is the mistake `NAVIGATES_OPTIONS` invited once before and ADR 0021 records — a kind
    // that walks its options with the arrows is not thereby a kind with a list to jump through.
    //
    // Asked of the catalogue rather than of a second list, so a kind that stops being a radio group
    // moves this with it.
    const isRadioGroup = Object.values(MDY_WIDGET_CONTRACTS[kind].parts)
      .some((declared) => declared.role === "radiogroup");
    if (!isRadioGroup) {
      for (const key of ["Home", "End"]) {
        bindings.push({ key, ...(overlay ? { when: "open" as const } : {}), intent: "move" });
      }
    }
  }
  if (STEPS_A_RANGE.includes(kind)) {
    // Only the arrows. Home and End on a range mean "go to the minimum" and "to the maximum", and
    // the intent vocabulary has no word for that — declaring them as `step` would say something
    // untrue rather than leave a gap on the record.
    bindings.push({ key: "ArrowUp", intent: "step" }, { key: "ArrowDown", intent: "step" });
  }
  // Moving a chosen value, on the chip that stands for it.
  //
  // A grab rather than a modifier. `Alt`+arrow is Back and Forward in every major browser on Windows
  // and Linux: it worked here only because `preventDefault` suppressed the platform's own gesture,
  // and it taught a keystroke that on any other focused element throws away the form being filled
  // in. `Enter` picks the chip up, the bare arrows carry it, `Enter` puts it down and `Escape` puts
  // it back — no modifier, so nothing to collide with on any platform.
  //
  // A grab is also a *state*, which is what the modifier could never be: it can be announced — "Roma
  // grabbed, 3 of 12" — and it can be cancelled. Both are things a person rearranging a list by
  // keyboard has no other way to get.
  //
  // Declared for a kind whose value is a list a person arranges, which the catalogue says by
  // holding a `chips` part: a set of filters has an order nobody chose and nothing to reorder.
  if ("chips" in MDY_WIDGET_CONTRACTS[kind].parts) {
    // Picking up and putting down are one key, because they are one state seen from its two ends.
    bindings.push({ key: "Enter", when: "closed", intent: "grab", on: "chip", requires: "reorderable" });
    // Putting it back. Only while something is held: the popup is closed by then — a grab cannot
    // begin while it is open — so this cannot be the same press that dismisses an overlay.
    bindings.push({ key: "Escape", when: "closed", intent: "cancel", on: "chip", requires: "reorderable" });
    // The arrows are declared once, below, as what moves the reading position. Held, they carry the
    // chip instead — the same movement with the grab's subject rather than the cursor's. Declaring
    // them twice and telling the two apart by the grab would put a state the table cannot see into
    // the table, and leave `keyBindingFor` answering whichever row was written first.
    // Moving *between* chips, and removing the one you are on. Declared `when: "closed"`, because
    // while the popup is showing the arrows belong to the list a person is choosing from — the same
    // key in two places is what the phase exists to separate.
    //
    // The strip is one tab stop with a roving index, not one stop per chip. Twelve chosen values
    // were twenty-six presses to get past the field, and the cost of leaving a control must not
    // grow with what it holds.
    bindings.push({ key: "ArrowLeft", when: "closed", intent: "move", by: -1, on: "chip" });
    bindings.push({ key: "ArrowRight", when: "closed", intent: "move", by: 1, on: "chip" });
    bindings.push({ key: "Home", when: "closed", intent: "move", by: -1, toEnd: true, on: "chip" });
    bindings.push({ key: "End", when: "closed", intent: "move", by: 1, toEnd: true, on: "chip" });
    // Taking one off from the keyboard, both spellings: `Backspace` is what a person reaches for
    // The quantity, on a chip that has one. ADR 0138 took the `spinbutton` role off the chip because
    // a control cannot be both the item at position 3 of 12 and the number 3 of a range — it did not
    // take the quantity away, and the record says so. The ± controls are `tabindex="-1"` pointer
    // affordances, so without these two keys a quantity is reachable by pointer and by nothing else:
    // WCAG 2.1.1, which is not a cost any record traded for a role.
    //
    // They collide with nothing. The strip's own arrows are left and right; the `open` bindings that
    // once claimed every part now name the control they open from.
    bindings.push({ key: "ArrowUp", when: "closed", intent: "step", on: "chip" });
    bindings.push({ key: "ArrowDown", when: "closed", intent: "step", on: "chip" });
    // and `Delete` is what the platform's own lists answer to.
    bindings.push({ key: "Backspace", when: "closed", intent: "remove", on: "chip" });
    bindings.push({ key: "Delete", when: "closed", intent: "remove", on: "chip" });
    // The way back, from the keyboard, using the gesture every application on the platform already
    // means by it. Declared for the control rather than for the button that offers it: the offer
    // appears at the field's trailing edge after a value goes, and the person who wants it back is
    // standing wherever the removal left them — which is not there. A shortcut reachable only from
    // the control it undoes the need for is a shortcut for nobody.
    bindings.push({ key: "z", modifier: "primary", intent: "undo" });
  }
  if (TOGGLES.includes(kind)) bindings.push({ key: " ", intent: "toggle" });

  return Object.freeze(bindings);
}

/** Every key each kind answers to. A kind that answers to none declares none. */
export const MDY_WIDGET_KEYBOARD: Readonly<Record<MdyWidgetKind, readonly MdyKeyBinding[]>> =
  Object.freeze(
    Object.fromEntries(
      (Object.keys(MDY_WIDGET_CONTRACTS) as MdyWidgetKind[]).map((kind) => [kind, Object.freeze(keyboardFor(kind).map((entry) => Object.freeze({
        ...entry,
        // One level deeper than the entry itself: a trigger and a list of parts are objects the
        // caller holds a reference to, and an entry frozen around live members is not frozen.
        ...Object.fromEntries(
          Object.entries(entry)
            .filter(([, member]) => member !== null && typeof member === "object")
            .map(([key, member]) => [key, Object.freeze(member)]),
        ),
      })))]),
    ) as Record<MdyWidgetKind, readonly MdyKeyBinding[]>,
  );

/** What this kind does with this key in this phase, or `null` if it does not claim it. */
export function keyBindingFor(
  kind: MdyWidgetKind,
  key: string,
  open: boolean,
  /**
   * Where the person is. Absent means the control, which is what answers a key by default.
   *
   * A binding declared `on` another part is invisible from the control and the only answer from
   * that part, so one key can mean two things without either declaration shadowing the other.
   */
  on?: string,
): MdyKeyBinding | null {
  const phase: MdyOverlayPhase = open ? "open" : "closed";
  // Asked without a part, the question is "what does this key do at the control" — and the part a
  // person opens this kind with *is* the control for that purpose. So a binding declared on the
  // opener answers a control-level question, and one declared on any other part does not: a chip's
  // keys stay the chip's, which is what keeps one key from meaning two things in one place.
  const opener = on === undefined ? MDY_POPUP_OPENERS[kind]?.opener : undefined;
  return MDY_WIDGET_KEYBOARD[kind].find(
    (binding) => binding.key === key
      && (binding.when === undefined || binding.when === phase)
      && ((binding.on ?? undefined) === on || (opener !== undefined && binding.on === opener)),
  ) ?? null;
}

/**
 * Whether a keyboard event is the gesture a binding declares.
 *
 * The platform test lives here and not in a renderer, because "the primary modifier" is one fact
 * about the machine and three copies of it drift the moment one is written from memory. It is read
 * from the event rather than from a user-agent string: `metaKey` is the accelerator where the
 * platform uses it and `ctrlKey` where it does not, and an event carries both — so a gesture is
 * recognised by what was actually held rather than by what the platform was guessed to be.
 *
 * Both are accepted, and that is deliberate rather than lax. A person on a Mac with a keyboard
 * mapped for another platform, or a remote session, holds the one their muscle memory knows; the
 * cost of accepting the other is a shortcut firing on a combination nothing else on the page claims.
 *
 * A binding with no modifier is a bare press, and a bare press is not this gesture: `z` alone must
 * not undo, or typing into a field beside the control would.
 */
export function matchesKeyGesture(binding: MdyKeyBinding, event: {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
}): boolean {
  if (binding.key.toLowerCase() !== event.key.toLowerCase()) return false;
  const held = event.ctrlKey === true || event.metaKey === true;
  if (binding.modifier === "primary") return held && event.altKey !== true && event.shiftKey !== true;
  return !held;
}

/**
 * How a control is operated, in one sentence, derived from the table above.
 *
 * Nothing else on a page says the key map exists. It is discoverable by guessing — the outside view's
 * largest finding — and a person who does not guess has a control they can see and cannot operate.
 *
 * Derived rather than written beside the table, because a sentence naming keys *is* a copy of the key
 * map: it goes stale the moment a binding moves, and this project has now found that shape five times
 * in five places. Derived, "it holds for every consumer" is true by construction rather than by
 * discipline.
 *
 * What it leaves out is as deliberate as what it says:
 *
 * - **Keys that need a capability the field did not ask for.** `reorderable` is opt-in, and a legend
 *   listing a key that does nothing on this control is worse than no legend — it was the likeliest
 *   reading of "reordering does not work".
 * - **Keys answered on a part that is not there.** A chip's keys mean nothing to a field holding no
 *   chips.
 * - **The keys every control shares.** Tab moves between fields everywhere; a sentence that says so
 *   on each of them is noise a reader learns to skip, and the ones that matter are inside it.
 */
export function widgetKeyGuide(
  kind: MdyWidgetKind,
  messages: {
    readonly keyGuideOpen: string;
    readonly keyGuideMove: string;
    readonly keyGuideStep: string;
    readonly keyGuideToggle: string;
    readonly keyGuideCommit: string;
    readonly keyGuideCancel: string;
    readonly keyGuideRemove: string;
    readonly keyGuideGrab: string;
    readonly keyGuideOr: string;
    readonly keyGuideJoin: string;
    readonly keyGuideSpace: string;
  },
  options: {
    /** The capabilities this field asked for; a key that needs one it did not ask for is left out. */
    readonly capabilities?: readonly string[];
    /**
     * The parts this control drew, where the caller knows.
     *
     * A key answered on a part that is not there is left out — a chip's keys mean nothing to a field
     * holding no chips. The part a person opens this kind with is always counted: it is the control,
     * and a control that is not drawn is not a control.
     */
    readonly parts?: readonly string[];
    /**
     * Which state to describe. A closed control's keys and an open one's are different sets, and a
     * sentence holding both says `ArrowDown` opens the list and moves through it at once.
     */
    readonly open?: boolean;
  } = {},
): string {
  const frames: Readonly<Record<string, string>> = {
    open: messages.keyGuideOpen,
    move: messages.keyGuideMove,
    step: messages.keyGuideStep,
    toggle: messages.keyGuideToggle,
    commit: messages.keyGuideCommit,
    cancel: messages.keyGuideCancel,
    remove: messages.keyGuideRemove,
    grab: messages.keyGuideGrab,
  };
  const named = (key: string): string => (key === " " ? messages.keyGuideSpace : key);

  // One clause per intent, in the order the frames declare them, so two kinds that answer the same
  // keys read the same way round.
  const phase: MdyOverlayPhase = options.open === true ? "open" : "closed";
  const opener = MDY_POPUP_OPENERS[kind]?.opener;
  const keysByIntent = new Map<string, string[]>();
  for (const binding of MDY_WIDGET_KEYBOARD[kind]) {
    if (binding.when !== undefined && binding.when !== phase) continue;
    if (binding.requires !== undefined && !(options.capabilities ?? []).includes(binding.requires)) continue;
    if (
      binding.on !== undefined && binding.on !== opener
      && options.parts !== undefined && !options.parts.includes(binding.on)
    ) continue;
    if (frames[binding.intent] === undefined) continue;
    const already = keysByIntent.get(binding.intent) ?? [];
    if (!already.includes(binding.key)) already.push(binding.key);
    keysByIntent.set(binding.intent, already);
  }

  const clauses: string[] = [];
  for (const intent of Object.keys(frames)) {
    const keys = keysByIntent.get(intent);
    if (keys === undefined || keys.length === 0) continue;
    clauses.push(frames[intent]!.replace("{keys}", keys.map(named).join(messages.keyGuideOr)));
  }
  return clauses.join(messages.keyGuideJoin);
}
