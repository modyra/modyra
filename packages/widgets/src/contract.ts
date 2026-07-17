/**
 * Universal widget contract.
 *
 * Defines the semantic boundary between a headless controller and a
 * framework-specific presenter. The contract shares state, intent, commands
 * and accessibility projection; it intentionally does not describe DOM trees,
 * tags or children.
 */

import type { MdySignal } from "@modyra/core";
import type { MdyUiCommand } from "./commands.js";

/** Semantic state of a widget part. */
export interface MdyPartContract {
  readonly id?: string;
  readonly role?: string;
  readonly classes: readonly string[];
  readonly attributes: Readonly<
    Record<string, string | number | boolean | null | undefined>
  >;
}

/** Semantic view contract produced by a controller. */
export interface MdyWidgetViewContract {
  readonly root: MdyPartContract;
  readonly parts: Readonly<Record<string, MdyPartContract>>;
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
