/**
 * What a collection needs from the form that holds it.
 *
 * `MdyFormRegistry` said what a *control* needs — register validators, mark a field disabled, claim
 * and release it. A collection needs more: it creates and destroys fields as rows come and go, it
 * owns a range of paths rather than one, and it has to tell the form which of those paths are in
 * play right now.
 *
 * The abstraction existed and was bypassed. Both collection managers imported the concrete engine
 * and called eight methods that were on no interface, so `MdyFormRegistry` was a description of the
 * engine rather than a contract with it — nothing could be substituted, and nothing said so.
 *
 * Named for what it is: the half of a form a collection talks to.
 */
import type { MdySignal } from "../reactivity-contract.js";
import type { MdyFieldRef, MdyFormError } from "../types.js";
import type { MdyFormRegistry, MdyPathGate } from "./form-registry.js";

export interface MdyCollectionHost<TBooleanSignal = MdySignal<boolean>>
  extends MdyFormRegistry<TBooleanSignal> {
  /**
   * Declares that everything under `prefix` is this collection's, and answers for it.
   *
   * The returned function withdraws the claim. A gate decides whether a path is in play, is told
   * when a write it refused arrived, and is handed the whole set of paths a value-level write
   * carried so a row the write does not mention can be pruned.
   */
  registerPathGate(prefix: string, gate: MdyPathGate): () => void;
  /** Re-asks the gate about every path under `prefix`, after the collection's own shape changed. */
  refreshPathGate(prefix: string): void;

  /** The field at `name` if it already exists — without creating one, which is the difference. */
  peekField(name: string): MdyFieldRef<unknown> | null;
  /** The field at `name`, created if this is the first ask. */
  getField(name: string): MdyFieldRef<unknown> | null;
  /** Every field name the form currently holds. */
  fieldNames(): readonly string[];
  /**
   * Moves what a binder said about these paths onto the paths their rows now have — see
   * {@link import("../form-engine.js").MdyFormEngine.carryBindings}. A collection calls it when a
   * row changes identity, so a disabled cell stays disabled on the row the consumer disabled.
   */
  carryBindings(pairs: ReadonlyArray<readonly [from: string, to: string]>): void;
  /**
   * Ends a field because the collection that declared it says so — see
   * {@link import("../form-engine.js").MdyFormEngine.endField}.
   */
  endField(name: string): void;
  /** Releases a path's binding: the row that held it has ended. */
  clearBindings(name: string): void;
  /** The errors attributed to a path, including the form-level ones that name it. */
  errorsFor(path: string): MdySignal<ReadonlyArray<MdyFormError>>;

  /**
   * Ownership, as against a control's claim.
   *
   * A row owns its cells: they exist because the row was declared, not because something mounted
   * them, and they go when the row goes rather than when the last control unmounts.
   */
  ownField(name: string): void;
  disownField(name: string): void;

  /** The form's development channel, so a manager does not write to the console behind a host's back. */
  warnDev(message: string): void;
}
