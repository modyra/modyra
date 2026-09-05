/**
 * Universal widget contract.
 *
 * Defines the semantic boundary between a headless controller and a
 * framework-specific presenter. The contract shares state, intent, commands
 * accessibility projection and optional structural anatomy. The anatomy is metadata for
 * conformance and presenter implementation; it is deliberately not a virtual DOM.
 */

import type { MdySignal } from "@modyra/core";
import type { MdyUiCommand } from "./commands.js";
import type { MdyStateName } from "./state.js";
import type { MdyWidgetStructure } from "./structure.js";

/** Semantic state of a widget part. */
export interface MdyPartContract {
  readonly id?: string;
  readonly role?: string;
  readonly classes: readonly string[];
  readonly attributes: Readonly<
    Record<string, string | number | boolean | null | undefined>
  >;
  /**
   * Custom properties the themes read to lay the part out — a count, a fill percentage. They are
   * part of the contract because a theme cannot derive them and an adapter must not invent them.
   */
  readonly style?: Readonly<Record<string, string>>;
  /**
   * The states this part can be in, from which `partClasses` derives its modifiers. Declaring them
   * is what makes the set of classes a part may ever carry finite and knowable: a theme can be
   * checked against it, and a renderer cannot reach for one that was never agreed.
   */
  readonly states?: readonly MdyStateName[];
  /**
   * What the part shows, where showing something is its job.
   *
   * A part that displays a value had its content invented by every renderer that drew it: the
   * number beside a slider, the words in a file field's prompt, the colour in a swatch. Four
   * renderers wrote four answers to one question, and the one that delegated the parts to a walk
   * over the declared structure drew them empty — the shape was declared and the content was
   * nobody's.
   */
  readonly content?: MdyPartContent;
}

/**
 * What a part shows, in a closed vocabulary.
 *
 * Two members and no more. A free channel — a string a renderer interprets, a style bag — would be a
 * surface with no letter of intent: a renderer could put anything in it and no check could say what
 * was meant. Closed, a third kind of content is a change to this type, which both instruments
 * classify, rather than something a renderer invents on a Tuesday.
 *
 * `color` rather than `swatch`, because `swatch` is already the name of a part in the colours
 * catalogue: one word would then mean an element in one place and a value in another.
 */
export interface MdyPartContent {
  /** The words a part shows. */
  readonly text?: string;
  /** The colour a part shows, as CSS names one. The renderer paints it; DESIGN.md says where. */
  readonly color?: string;
}

/** Semantic view contract produced by a controller. */
export interface MdyWidgetViewContract<TPart extends string = string> {
  readonly root: MdyPartContract;
  readonly parts: Readonly<Record<TPart, MdyPartContract>>;
  /** Ordered semantic anatomy implemented by a presenter. Additive for contract v1. */
  readonly structure?: MdyWidgetStructure<TPart | "root">;
}

/** A typed part map, for a view contract with a closed set of named parts. */
export type MdyPartMap<TPart extends string> = Readonly<Record<TPart, MdyPartContract>>;

/** Typed specialization for controllers with a closed set of named parts. */
export interface MdyTypedWidgetViewContract<TPart extends string>
  extends MdyWidgetViewContract<TPart> {
  readonly parts: Readonly<Record<TPart, MdyPartContract>>;
}

/** Base controller contract shared by every Modyra widget. */
export interface MdyWidgetController<TState, TIntent> {
  /** Reactive semantic state of the widget. */
  readonly state: MdySignal<TState>;
  /** Reactive view contract (ARIA, classes, ids). */
  readonly view: MdySignal<MdyWidgetViewContract>;
  /** Dispatch an intent and receive the commands to execute. */
  dispatch(intent: TIntent): readonly MdyUiCommand[];
  /** Release resources. */
  destroy(): void;
}
