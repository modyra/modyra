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
  MdyAsyncValidationContext,
  MdyAsyncValidatorFn,
  MdyFieldError,
  MdyFieldState,
  ValidatorFn,
} from "./types.js";

export interface AsyncValidatorEntry {
  readonly fns: ReadonlyArray<MdyAsyncValidatorFn<unknown>>;
  readonly debounceMs: number;
  readonly dependsOn: ReadonlyArray<string>;
  readonly timeoutMs: number;
  readonly when: ((value: unknown, formValue: Record<string, unknown>) => boolean) | null;
}

/** Host services the async runner needs from the owning form engine. */
export interface MdyAsyncRunnerHost {
  /** Dotted path of the field the runner belongs to. */
  readonly fieldPath: string;
  /** Flat form value (dotted keys). */
  formValue(): Record<string, unknown>;
  /** State of a field by dotted path, or null if not (yet) registered. */
  fieldState(path: string): MdyFieldState<unknown> | null;
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
 * semantics, debounce, cancellation (AbortSignal), cross-field retrigger
 * (`dependsOn`), timeout, and a `when` precondition.
 */
export function createAsyncRunner(
  rec: FieldRecord,
  rx: MdyReactivity,
  host: MdyAsyncRunnerHost,
): MdyEffectRef {
  return rx.effect((onCleanup) => {
    const v = rec.state.value();
    const entries = Array.from(rec.asyncValidators().values());
    // Touch dependsOn field values so their changes retrigger this effect.
    for (const e of entries) {
      for (const dep of e.dependsOn) host.fieldState(dep)?.value();
    }
    const runId = ++rec.asyncRunId;
    const controller = new AbortController();
    onCleanup(() => controller.abort());

    const formValue = rx.untracked(() => host.formValue());
    const applicable = entries.filter(
      e => e.when === null || e.when(v, formValue),
    );
    const fns = applicable.flatMap(e => e.fns);

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

    const ctx: MdyAsyncValidationContext = {
      signal: controller.signal,
      path: host.fieldPath,
      form: {
        value: () => host.formValue(),
        fieldValue: (p) => host.fieldState(p)?.value(),
      },
    };

    const run = (): void => {
      const timeoutMs = applicable.reduce(
        (max, e) => Math.max(max, e.timeoutMs),
        0,
      );
      let timedOut = false;
      const timeout = timeoutMs > 0 ? setTimeout(() => {
        timedOut = true;
        controller.abort();
        if (runId !== rec.asyncRunId) return;
        rec.asyncErrors.set([{ kind: "async-timeout", message: "Validation timed out" }]);
        rec.pending.set(false);
      }, timeoutMs) : null;

      void Promise.all(fns.map(fn => fn(v, ctx)))
        .then(results => {
          if (timeout) clearTimeout(timeout);
          if (timedOut || controller.signal.aborted) return;
          if (runId !== rec.asyncRunId) return; // stale run: last-wins
          rec.asyncErrors.set(
            results
              .flat()
              .map(message => ({ kind: "async", message }) as MdyFieldError),
          );
          rec.pending.set(false);
        })
        .catch((e: unknown) => {
          if (timeout) clearTimeout(timeout);
          if (timedOut || controller.signal.aborted) return; // abort ≠ error
          if (runId !== rec.asyncRunId) return;
          rec.asyncErrors.set([{
            kind: "async",
            message: e instanceof Error ? e.message : String(e),
          }]);
          rec.pending.set(false);
        });
    };

    const debounceMs = applicable.reduce(
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
