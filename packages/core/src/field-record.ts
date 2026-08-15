/**
 * Field record factory and async validator runner.
 *
 * Extracted from {@link MdyFormEngine} so the engine owns registry/lifecycle
 * while this module owns the per-field reactive state and async validation
 * effect.
 */

import type {
  MdyEffectRef,
  MdyReactiveScope,
  MdyReactivity,
  MdySignal,
  MdyWritableSignal,
} from "./reactivity-contract.js";
import type {
  MdyAsyncValidationContext,
  MdyAsyncValidatorFn,
  MdyFieldError,
  MdyFieldState,
  MdyInteractivity,
  ValidatorFn,
} from "./types.js";
import { factsOfAll, NO_CONSTRAINTS, type MdyFieldConstraints } from "./validator-facts.js";

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
  /** Whether the schema says this field is out of play; see `MdyFieldOptions.when`. */
  readonly inactive: MdyWritableSignal<MdySignal<boolean>>;
  readonly readonly: MdyWritableSignal<MdySignal<boolean>>;
  asyncRunId: number;
  asyncRunner: MdyEffectRef | null;
  /** Says what a caller could not have worked out from the field alone. Silent in production. */
  readonly warn: (message: string) => void;
}

/**
 * Creates a reactive field record with the given initial value and an
 * `extraErrors` callback that supplies cross-field and server errors.
 *
 * `beforeWrite` is the engine's security choke point: when provided, every
 * write to the field's value signal — user input, `patch`/`setValue`,
 * draft restore, array operations, bindings writing the signal directly —
 * passes through it before reaching the underlying signal.
 */
export function createFieldRecord(
  rx: MdyReactivity,
  initialValue: unknown,
  extraErrors: (value: unknown) => ReadonlyArray<MdyFieldError>,
  beforeWrite?: (value: unknown) => unknown,
  /** Says what a caller could not have worked out from the field alone. Silent in production. */
  warn: (message: string) => void = () => undefined,
  /**
   * What something above this field says about it.
   *
   * A group, a collection or a row put out of play takes what it contains with it — the rule
   * `group(children, { when })` already follows from a schema. A field composes it rather than being
   * told, so a row declared after the sentence was spoken is covered by it too.
   */
  outerVerdict: MdySignal<MdyInteractivity> = () => "enabled",
): FieldRecord {
  const rawValue = rx.signal<unknown>(initialValue);
  const value: MdyWritableSignal<unknown> = beforeWrite
    ? Object.assign(() => rawValue(), {
      set: (v: unknown) => rawValue.set(beforeWrite(v)),
      update: (fn: (v: unknown) => unknown) =>
        rawValue.set(beforeWrite(fn(rawValue()))),
      asReadonly: () => rawValue.asReadonly(),
    })
    : rawValue;
  const touched = rx.signal(false);
  const dirty = rx.signal(false);
  const requiredKeys = rx.signal<ReadonlySet<string>>(new Set());
  // Dynamic signals provided by bindings, defaulting to false.
  const disabledSignal = rx.signal<MdySignal<boolean>>(() => false);
  const inactiveSignal = rx.signal<MdySignal<boolean>>(() => false);
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
        readMessages(fn(v), warn).map(
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

  // Three inputs feed one state, and `disabled` wins over `readonly`: it permits strictly less, and
  // a field the form is not asking about cannot also be a field it is asserting an answer for. A
  // field out of play is disabled for the same reason — the form is not asking it either — which is
  // what keeps a conditional branch from being a fourth kind of state.
  const interactivity = rx.computed<MdyInteractivity>(() => {
    const outer = outerVerdict();
    return disabledSignal()() || inactiveSignal()() || outer === "disabled"
      ? "disabled"
      : readonlySignal()() || outer === "readonly"
        ? "readonly"
        : "enabled";
  });

  /**
   * What this field's own rules state that a control can act on.
   *
   * Read from the rules rather than declared beside them: a constraint offered at the keyboard and a
   * rule that rejects the value are two faces of one fact, and only one of them can be the
   * authority. The sum, and the tightest-wins rule inside it, live in `validator-facts`.
   */
  const constraints = rx.computed<MdyFieldConstraints>(() => {
    const lists = [...validators().values()];
    if (lists.length === 0) return NO_CONSTRAINTS;
    const summed = factsOfAll(lists.flat());
    if (summed.conflictingPatterns) {
      // An input carries one `pattern`, and their intersection is a rule nobody wrote. Both rules
      // still run; what is lost is the constraint at the keyboard, and that is worth saying.
      warn(
        "declares more than one pattern, so the control offers none. Both rules still run; to have " +
        "one at the keyboard, write a single expression that means both.",
      );
    }
    return summed.constraints;
  });

  const state: MdyFieldState<unknown> = {
    value,
    touched,
    dirty,
    required: rx.computed(() => requiredKeys().size > 0),
    constraints,
    valid: rx.computed(() => errors().length === 0),
    errors,
    interactivity,
    // Derived, so they cannot drift from each other or from `interactivity`.
    disabled: rx.computed(() => interactivity() === "disabled"),
    readonly: rx.computed(() => interactivity() === "readonly"),
    pending: pending.asReadonly(),
  };

  return {
    state,
    validators,
    asyncValidators,
    asyncErrors,
    pending,
    requiredKeys,
    inactive: inactiveSignal,
    disabled: disabledSignal,
    readonly: readonlySignal,
    asyncRunId: 0,
    asyncRunner: null,
    warn,
  };
}

/**
 * What a rule answered, read as a list of messages.
 *
 * A rule returns the messages it wants shown, and none is an empty list — so the shape a person
 * writes has no `else`:
 *
 * ```js
 * (value) => { if (value === "taken") return ["Already taken"]; }
 * ```
 *
 * That returns `undefined`, and reading `.map` off it threw from inside the computed every read of
 * `valid()` goes through: a form that exists and cannot be asked anything, with a stack pointing at
 * this file and the mistake three files away. Nothing to say is the ordinary case, so it is read as
 * nothing to say.
 *
 * A shape that is neither a list nor nothing cannot be guessed at, and passing the value silently
 * would let a rule someone wrote stop applying without a word. It becomes one message that says so —
 * the same trade a refused submit makes: whoever is looking at the form learns something is wrong.
 */
function readMessages(returned: unknown, warn: (message: string) => void): ReadonlyArray<string> {
  if (returned === undefined || returned === null) return [];
  // A rule with one thing to say, said without the list around it.
  if (typeof returned === "string") return [returned];
  if (!Array.isArray(returned)) {
    warn(`answered a rule with ${typeof returned}, and a rule answers with a list of messages.`);
    return ["This value could not be checked."];
  }
  const messages: string[] = [];
  for (const message of returned) {
    if (typeof message === "string") {
      messages.push(message);
      continue;
    }
    warn(`was given ${message === null ? "null" : typeof message} as a message, which is not one.`);
    messages.push("This value could not be checked.");
  }
  return messages;
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
  scope?: MdyReactiveScope,
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
              .flatMap(returned => readMessages(returned, rec.warn))
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
  }, { scope, debugName: `modyra:async-validator:${host.fieldPath}` });
}
