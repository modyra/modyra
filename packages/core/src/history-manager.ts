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
} from "./reactivity-contract.js";
import { reactivityRunsEffects } from "./reactivity-contract.js";
import { shallowEqualRecords } from "./record-utils.js";
import { MDY_DEV } from "./dev-flags.js";

interface HistoryManagerDeps {
  readonly rx: MdyReactivity;
  readonly getValue: () => Record<string, unknown>;
  readonly setValue: (value: Record<string, unknown>) => void;
  readonly warn: (message: string) => void;
  /** Form-owned scope — see {@link import("./draft-manager.js").MdyDraftManager}'s equivalent field. */
  readonly scope?: MdyReactiveScope;
  /** True while {@link import("./form-engine.js").MdyFormEngine.mutate} is running a callback. */
  readonly isMutating: () => boolean;
  /**
   * True while the owning `MdyFormEngine` is deactivated (constructed with
   * `autoActivate: false`, or paused via `deactivate()`).
   * `enableHistory()` records the config but defers starting the
   * snapshot effect until `resume()`.
   */
  readonly isDeactivated: () => boolean;
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
  private readonly _isMutating: () => boolean;
  /**
   * True while undo()/redo() is writing the restored value back. Restoring
   * multiple fields isn't atomic either (setValue() writes them one at a
   * time), so a synchronous-effect adapter (Vue/Solid) would otherwise see
   * the history effect fire mid-restore on a state that matches neither
   * the pre- nor post-restore snapshot, pushing spurious entries.
   */
  private _restoring = false;
  private readonly _isDeactivated: () => boolean;
  /** Config from enableHistory(), recorded but not yet started (deactivated at the time). */
  private _pending: { maxEntries?: number; debounceMs?: number } | null = null;
  /** True once the effect has started at least once — resume() then just restarts it. */
  private _hasStarted = false;

  private readonly _undoStack: Array<Record<string, unknown>> = [];
  private readonly _redoStack: Array<Record<string, unknown>> = [];
  private _lastSnapshot: Record<string, unknown> | null = null;
  private _effect: MdyEffectRef | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _maxEntries = 100;
  private _debounceMs = 0;
  /** Whether the stacks hold an entry — what the snapshot effect has seen, and only that. */
  private readonly _stackedUndo: MdyWritableSignal<boolean>;
  private readonly _stackedRedo: MdyWritableSignal<boolean>;

  /**
   * True when {@link undo} has state to restore (see {@link enableHistory}).
   *
   * Derived rather than stored, because {@link undo} acts on the value as it is *now*: it records
   * any change the snapshot effect has not seen before popping, so a structural change made in this
   * task is undoable in this task. A stored flag would answer for the last state the scheduler saw
   * and leave an Undo button disabled over a change that is undoable — the affordance and the
   * operation have to answer the same question.
   */
  readonly canUndo: MdySignal<boolean>;
  /**
   * True when {@link redo} has state to restore.
   *
   * The mirror of {@link canUndo}: a change made after an undo invalidates the redo stack, and
   * `redo()` enforces that by recording before popping. An unrecorded change therefore means redo
   * would do nothing, and this says so before it is called rather than after.
   */
  readonly canRedo: MdySignal<boolean>;

  constructor(deps: HistoryManagerDeps) {
    this._rx = deps.rx;
    this._getValue = deps.getValue;
    this._setValue = deps.setValue;
    this._warn = deps.warn;
    this._scope = deps.scope;
    this._isMutating = deps.isMutating;
    this._isDeactivated = deps.isDeactivated;
    this._stackedUndo = deps.rx.signal(false);
    this._stackedRedo = deps.rx.signal(false);
    this.canUndo = deps.rx.computed(() => this._stackedUndo() || this._hasUnrecordedChange());
    this.canRedo = deps.rx.computed(() => this._stackedRedo() && !this._hasUnrecordedChange());
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
    if (this._effect || this._pending) return;
    if (!reactivityRunsEffects(this._rx)) {
      if (MDY_DEV) this._warn(
        "enableHistory() needs an effect-capable reactivity " +
        "— see your reactivity adapter for how to provide one.",
      );
      return;
    }
    if (this._isDeactivated()) {
      this._pending = { maxEntries: options?.maxEntries, debounceMs: options?.debounceMs };
      return;
    }
    this._start(options);
  }

  private _start(options?: { readonly maxEntries?: number; readonly debounceMs?: number }): void {
    this._maxEntries = options?.maxEntries ?? 100;
    this._debounceMs = options?.debounceMs ?? 0;
    this._hasStarted = true;
    this._startEffect();
  }

  private _startEffect(): void {
    this._effect = this._rx.effect((onCleanup) => {
      // Always read (and therefore track) the current value, even while a
      // mutate() block is in progress below — otherwise a synchronous-effect
      // adapter (Vue/Solid) would stop tracking the fields written during
      // the block and never rerun after it ends.
      const current = this._getValue();
      if (this._isMutating() || this._restoring) return;
      this._rx.untracked(() => {
        if (this._debounceMs <= 0) {
          this._record(current);
          return;
        }
        // First value seeds the snapshot immediately so the pre-typing
        // state is undoable; later changes are batched.
        if (this._lastSnapshot === null) {
          this._record(current);
          return;
        }
        if (this._timer !== null) clearTimeout(this._timer);
        this._timer = setTimeout(() => {
          this._timer = null;
          this._record(current);
        }, this._debounceMs);
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
   * Makes the current value the state history starts from.
   *
   * A form opens, a stored draft is written into it, and the effect that records changes sees a
   * change — so the first thing a person is offered to undo is something they did not do, and taking
   * the offer costs them the draft: the undo writes the empty form back, and the draft follows the
   * model. The redo that would recover it lives in the tab.
   *
   * Restoring a draft is the form arriving at its starting state, not moving away from one. So is
   * discarding one deliberately. Both say so here rather than each clearing stacks its own way.
   */
  rebaseline(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this._lastSnapshot = this._effect ? this._rx.untracked(() => this._getValue()) : null;
    this._stackedUndo.set(false);
    this._stackedRedo.set(false);
  }

  /**
   * Stops the snapshot effect and its pending debounce timer without
   * losing the undo/redo stacks — `resume()` restarts it exactly where it
   * left off. Called by the owning form's `deactivate()`.
   */
  pause(): void {
    this._effect?.destroy();
    this._effect = null;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /**
   * Restarts what `pause()` stopped, or performs the deferred first start
   * if `enableHistory()` was called while deactivated. A no-op if history
   * was never enabled, or is already running. Called by the owning form's
   * `activate()`.
   */
  resume(): void {
    if (this._effect) return;
    if (this._pending) {
      const pending = this._pending;
      this._pending = null;
      this._start(pending);
      return;
    }
    if (this._hasStarted) this._startEffect();
  }

  private _record(current: Record<string, unknown>): void {
    const last = this._lastSnapshot;
    if (last !== null && shallowEqualRecords(last, current)) return;
    if (last !== null) {
      this._undoStack.push(last);
      if (this._undoStack.length > this._maxEntries) this._undoStack.shift();
      this._redoStack.length = 0;
      this._stackedUndo.set(true);
      this._stackedRedo.set(false);
    }
    this._lastSnapshot = current;
  }

  /**
   * Forces one immediate, coalesced snapshot of the current value — called
   * by {@link import("./form-engine.js").MdyFormEngine.mutate} right after
   * its callback returns, so a burst of field writes inside `mutate()`
   * becomes exactly one undo entry regardless of whether the adapter's
   * effects run synchronously or are scheduler-deferred. A no-op when
   * history isn't enabled.
   */
  recordNow(): void {
    if (!this._effect) return;
    // Putting a snapshot back is not a change. A restore writes through the same doors a consumer
    // uses, and one that groups its writes asks for a snapshot when it returns — taken here, it
    // would record the state being restored *to* and empty the redo stack, so a redo after an undo
    // had nothing left to apply. The snapshot effect has always skipped for this reason.
    if (this._restoring) return;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._record(this._rx.untracked(() => this._getValue()));
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

  /**
   * Records any change the snapshot effect has not seen yet, so undo/redo act on the value as it
   * is *now*. The effect runs on the reactivity's schedule (a microtask for the vanilla graph), and
   * a structural change — a row declared, removed or renamed — followed synchronously by undo()
   * would otherwise find no entry and silently keep the change. With this, a change is undoable
   * the moment it is made, not the moment the scheduler noticed it.
   */
  private _recordCurrent(): void {
    this._record(this._rx.untracked(() => this._getValue()));
  }

  /**
   * Whether the value has moved since the last snapshot — the change {@link undo} would record
   * before popping, and the one that has already invalidated the redo stack.
   *
   * Read tracked, not untracked: it is what makes {@link canUndo} and {@link canRedo} recompute when
   * the value changes. During a restore it answers false, because the value is mid-write and the
   * snapshot it is being restored to is already recorded.
   */
  private _hasUnrecordedChange(): boolean {
    const last = this._lastSnapshot;
    if (last === null || this._restoring) return false;
    return !shallowEqualRecords(last, this._getValue());
  }

  /** Restores the previous recorded form value (no-op when history is empty). */
  undo(): void {
    this._flush();
    this._recordCurrent();
    const prev = this._undoStack.pop();
    if (!prev) return;
    const current = this._rx.untracked(() => this._getValue());
    this._redoStack.push(current);
    // Pre-setting the snapshot makes the history effect treat the restored
    // value as already recorded instead of pushing it again.
    this._lastSnapshot = prev;
    this._restoring = true;
    try {
      this._setValue(prev);
    } finally {
      this._restoring = false;
    }
    this._stackedUndo.set(this._undoStack.length > 0);
    this._stackedRedo.set(true);
  }

  /** Re-applies the value undone by the last {@link undo}. */
  redo(): void {
    this._flush();
    // A change made after the undo invalidates what was undone — recording it clears the redo
    // stack, which is the semantics every editor ships. Unchanged value, no-op.
    this._recordCurrent();
    const next = this._redoStack.pop();
    if (!next) return;
    const current = this._rx.untracked(() => this._getValue());
    this._undoStack.push(current);
    this._lastSnapshot = next;
    this._restoring = true;
    try {
      this._setValue(next);
    } finally {
      this._restoring = false;
    }
    this._stackedRedo.set(this._redoStack.length > 0);
    this._stackedUndo.set(true);
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
    this._stackedUndo.set(false);
    this._stackedRedo.set(false);
  }
}
