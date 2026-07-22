/**
 * Undo/redo history manager.
 *
 * Encapsulates snapshot recording, debounced writes, undo/redo stacks and the
 * `canUndo`/`canRedo` signals previously embedded in {@link MdyFormEngine}.
 * The form engine owns one instance and delegates history operations to it.
 */

import type {
  MdyEffectRef,
  MdyReactivity,
  MdyReactiveScope,
  MdySignal,
  MdyWritableSignal,
} from "./reactivity.js";
import { shallowEqualRecords } from "./record-utils.js";
import { MDY_DEV } from "./dev-flags.js";

interface HistoryManagerDeps {
  readonly rx: MdyReactivity;
  readonly getValue: () => Record<string, unknown>;
  readonly setValue: (value: Record<string, unknown>) => void;
  readonly warn: (message: string) => void;
  /** Form-owned scope — see {@link import("./draft-manager.js").MdyDraftManager}'s equivalent field. */
  readonly scope?: MdyReactiveScope;
}

/**
 * Manages undo/redo history for a single form instance.
 */
export class MdyHistoryManager {
  private readonly _rx: MdyReactivity;
  private readonly _getValue: () => Record<string, unknown>;
  private readonly _setValue: (value: Record<string, unknown>) => void;
  private readonly _warn: (message: string) => void;
  private readonly _scope: MdyReactiveScope | undefined;

  private readonly _undoStack: Array<Record<string, unknown>> = [];
  private readonly _redoStack: Array<Record<string, unknown>> = [];
  private _lastSnapshot: Record<string, unknown> | null = null;
  private _effect: MdyEffectRef | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private readonly _canUndo: MdyWritableSignal<boolean>;
  private readonly _canRedo: MdyWritableSignal<boolean>;

  /** True when {@link undo} has state to restore (see {@link enableHistory}). */
  readonly canUndo: MdySignal<boolean>;
  /** True when {@link redo} has state to restore. */
  readonly canRedo: MdySignal<boolean>;

  constructor(deps: HistoryManagerDeps) {
    this._rx = deps.rx;
    this._getValue = deps.getValue;
    this._setValue = deps.setValue;
    this._warn = deps.warn;
    this._scope = deps.scope;
    this._canUndo = deps.rx.signal(false);
    this._canRedo = deps.rx.signal(false);
    this.canUndo = this._canUndo.asReadonly();
    this.canRedo = this._canRedo.asReadonly();
  }

  /**
   * Starts recording value snapshots for {@link undo}/{@link redo}. Idempotent.
   *
   * `debounceMs` batches rapid changes (e.g. keystrokes) into a single
   * history entry — without it every value change becomes an undo step.
   * Only the form **value** is recorded: touched/dirty flags, server errors
   * and validation state are not restored by undo/redo.
   */
  enableHistory(options?: {
    readonly maxEntries?: number;
    readonly debounceMs?: number;
  }): void {
    if (this._effect) return;
    if (!this._rx.canEffect) {
      if (MDY_DEV) this._warn(
        "enableHistory() needs an effect-capable reactivity " +
        "(with the Angular adapter: construct it with an Injector).",
      );
      return;
    }
    const max = options?.maxEntries ?? 100;
    const debounceMs = options?.debounceMs ?? 0;
    const record = (current: Record<string, unknown>): void => {
      const last = this._lastSnapshot;
      if (last !== null && shallowEqualRecords(last, current)) return;
      if (last !== null) {
        this._undoStack.push(last);
        if (this._undoStack.length > max) this._undoStack.shift();
        this._redoStack.length = 0;
        this._canUndo.set(true);
        this._canRedo.set(false);
      }
      this._lastSnapshot = current;
    };
    this._effect = this._rx.effect((onCleanup) => {
      const current = this._getValue();
      this._rx.untracked(() => {
        if (debounceMs <= 0) {
          record(current);
          return;
        }
        // First value seeds the snapshot immediately so the pre-typing
        // state is undoable; later changes are batched.
        if (this._lastSnapshot === null) {
          record(current);
          return;
        }
        if (this._timer !== null) clearTimeout(this._timer);
        this._timer = setTimeout(() => {
          this._timer = null;
          record(current);
        }, debounceMs);
      });
      onCleanup(() => {
        if (this._timer !== null) {
          clearTimeout(this._timer);
          this._timer = null;
        }
      });
    }, { scope: this._scope, debugName: "modyra:history" });
  }

  /**
   * Flushes a pending debounced snapshot so undo/redo act on the latest
   * value instead of the last recorded batch.
   */
  private _flush(): void {
    if (this._timer === null) return;
    clearTimeout(this._timer);
    this._timer = null;
    const current = this._rx.untracked(() => this._getValue());
    const last = this._lastSnapshot;
    if (last !== null && !shallowEqualRecords(last, current)) {
      this._undoStack.push(last);
      this._redoStack.length = 0;
    }
    this._lastSnapshot = current;
  }

  /** Restores the previous recorded form value (no-op when history is empty). */
  undo(): void {
    this._flush();
    const prev = this._undoStack.pop();
    if (!prev) return;
    const current = this._rx.untracked(() => this._getValue());
    this._redoStack.push(current);
    // Pre-setting the snapshot makes the history effect treat the restored
    // value as already recorded instead of pushing it again.
    this._lastSnapshot = prev;
    this._setValue(prev);
    this._canUndo.set(this._undoStack.length > 0);
    this._canRedo.set(true);
  }

  /** Re-applies the value undone by the last {@link undo}. */
  redo(): void {
    this._flush();
    const next = this._redoStack.pop();
    if (!next) return;
    const current = this._rx.untracked(() => this._getValue());
    this._undoStack.push(current);
    this._lastSnapshot = next;
    this._setValue(next);
    this._canRedo.set(this._redoStack.length > 0);
    this._canUndo.set(true);
  }

  /** Releases timers, effects and clears the stacks. */
  destroy(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._effect?.destroy();
    this._effect = null;
    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this._lastSnapshot = null;
    this._canUndo.set(false);
    this._canRedo.set(false);
  }
}