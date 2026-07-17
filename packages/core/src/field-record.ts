/**
 * Field record factory and async validator runner.
 *
 * Extracted from {@link MdyFormEngine} so the engine owns registry/lifecycle
 * while this module owns the per-field reactive state and async validation
 * effect.
 */

import type {
  MdyEffectRef,
  MdyReactivity,
  MdySignal,
  MdyWritableSignal,
} from "./reactivity.js";
import type {
  MdyAsyncValidatorFn,
  MdyFieldError,
  MdyFieldState,
  ValidatorFn,
} from "./types.js";

export interface AsyncValidatorEntry {
  readonly fns: ReadonlyArray<MdyAsyncValidatorFn<unknown>>;
  readonly debounceMs: number;
}

export interface FieldRecord {
  readonly state: MdyFieldState<unknown>;
  /** Sync validators keyed by owner. */
  readonly validators: MdyWritableSignal<
    ReadonlyMap<string, ReadonlyArray<ValidatorFn<unknown>>>
  >;
  /** Async validators keyed by owner. */
  readonly asyncValidators: MdyWritableSignal<
    ReadonlyMap<string, AsyncValidatorEntry>
  >;
  readonly asyncErrors: MdyWritableSignal<ReadonlyArray<MdyFieldError>>;
  readonly pending: MdyWritableSignal<boolean>;
  /** Keys whose validator sets mark the field as required. */
  readonly requiredKeys: MdyWritableSignal<ReadonlySet<string>>;
  readonly disabled: MdyWritableSignal<MdySignal<boolean>>;
  readonly readonly: MdyWritableSignal<MdySignal<boolean>>;
  asyncRunId: number;
  asyncRunner: MdyEffectRef | null;
}

/**
 * Creates a reactive field record with the given initial value and an
 * `extraErrors` callback that supplies cross-field and server errors.
 */
export function createFieldRecord(
  rx: MdyReactivity,
  initialValue: unknown,
  extraErrors: (value: unknown) => ReadonlyArray<MdyFieldError>,
): FieldRecord {
  const value = rx.signal<unknown>(initialValue);
  const touched = rx.signal(false);
  const dirty = rx.signal(false);
  const requiredKeys = rx.signal<ReadonlySet<string>>(new Set());
  // Dynamic signals provided by bindings, defaulting to false.
  const disabledSignal = rx.signal<MdySignal<boolean>>(() => false);
  const readonlySignal = rx.signal<MdySignal<boolean>>(() => false);

  const validators = rx.signal<
    ReadonlyMap<string, ReadonlyArray<ValidatorFn<unknown>>>
  >(new Map());
  const asyncValidators = rx.signal<ReadonlyMap<string, AsyncValidatorEntry>>(
    new Map(),
  );
  const asyncErrors = rx.signal<ReadonlyArray<MdyFieldError>>([]);
  const pending = rx.signal(false);

  const errors = rx.computed<ReadonlyArray<MdyFieldError>>(() => {
    const v = value();
    const syncErrors = Array.from(validators().values()).flatMap(fns =>
      fns.flatMap(fn =>
        fn(v).map(
          message => ({ kind: "validation", message }) as MdyFieldError,
        ),
      ),
    );
    return [
      ...syncErrors,
      ...asyncErrors(),
      ...extraErrors(v),
    ];
  });

  const state: MdyFieldState<unknown> = {
    value,
    touched,
    dirty,
    required: rx.computed(() => requiredKeys().size > 0),
    valid: rx.computed(() => errors().length === 0),
    errors,
    disabled: rx.computed(() => disabledSignal()()),
    readonly: rx.computed(() => readonlySignal()()),
    pending: pending.asReadonly(),
  };

  return {
    state,
    validators,
    asyncValidators,
    asyncErrors,
    pending,
    requiredKeys,
    disabled: disabledSignal,
    readonly: readonlySignal,
    asyncRunId: 0,
    asyncRunner: null,
  };
}

/**
 * Creates the effect that runs a field's async validators with last-wins
 * semantics and debounce.
 */
export function createAsyncRunner(
  rec: FieldRecord,
  rx: MdyReactivity,
): MdyEffectRef {
  return rx.effect((onCleanup) => {
    const v = rec.state.value();
    const entries = Array.from(rec.asyncValidators().values());
    const fns = entries.flatMap(e => e.fns);
    const runId = ++rec.asyncRunId;
    if (fns.length === 0) {
      rx.untracked(() => {
        rec.pending.set(false);
        rec.asyncErrors.set([]);
      });
      return;
    }
    // Pending covers the whole debounce+run window, so canSubmit stays
    // false while a check is outstanding.
    rx.untracked(() => rec.pending.set(true));
    const run = (): void => {
      void Promise.all(fns.map(fn => fn(v)))
        .then(results => {
          if (runId !== rec.asyncRunId) return; // stale run: last-wins
          rec.asyncErrors.set(
            results
              .flat()
              .map(message => ({ kind: "async", message }) as MdyFieldError),
          );
          rec.pending.set(false);
        })
        .catch((e: unknown) => {
          if (runId !== rec.asyncRunId) return;
          rec.asyncErrors.set([{
            kind: "async",
            message: e instanceof Error ? e.message : String(e),
          }]);
          rec.pending.set(false);
        });
    };
    const debounceMs = entries.reduce(
      (max, e) => Math.max(max, e.debounceMs),
      0,
    );
    if (debounceMs > 0) {
      const timer = setTimeout(run, debounceMs);
      onCleanup(() => clearTimeout(timer));
    } else {
      run();
    }
  });
}
