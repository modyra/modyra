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
import {
  MdyActivationError,
  MdyAdapterContractError,
  MdyComputedWriteError,
  MdyCrossRuntimeObservationError,
  MdyDestroyedScopeError,
  MdyUnsupportedCapabilityError,
} from "./reactivity-errors.js";
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
  /** The engine's development channel, for a rule of the application's that misbehaved. */
  warn?(message: string): void;
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
  /** Aborts the run in flight, when there is one. Set by the runner, read by the watcher beside it. */
  abandonAsync: (() => void) | null;
  /**
   * Bumped when the field comes back into play, so the runner asks again.
   *
   * The runner does not read interactivity: a field becoming read-only is still being asked about,
   * and waking on that would restart a question the form never stopped asking. Coming back from out
   * of play is the transition that *does* need a new run, and this is the one signal that says so.
   */
  readonly asyncWake: MdyWritableSignal<number>;
  /** What a control says about the entry it holds — see the signal's own note. */
  readonly entryProblem: MdyWritableSignal<string | null>;
  readonly pending: MdyWritableSignal<boolean>;
  /** Keys whose validator sets mark the field as required. */
  readonly requiredKeys: MdyWritableSignal<ReadonlySet<string>>;
  readonly disabled: MdyWritableSignal<MdySignal<boolean>>;
  /** Whether the schema says this field is out of play; see `MdyFieldOptions.when`. */
  readonly inactive: MdyWritableSignal<MdySignal<boolean>>;
  readonly readonly: MdyWritableSignal<MdySignal<boolean>>;
  asyncRunId: number;
  asyncRunner: MdyAsyncRunner | null;
  /**
   * What the last completed run answered about: this field's value, the values it was told to watch,
   * and the wake counter. Resuming a paused form must not re-ask a settled question, and a
   * dependency changing must not look like one.
   */
  asyncSettledFor?: {
    readonly value: unknown;
    readonly wake: number;
    readonly deps: readonly unknown[];
  };
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
  /**
   * Whether writes are over.
   *
   * A form that has ended still answers — a renderer torn down in the other order reads for a beat,
   * and throwing there turns an ordinary unmount race into a crash. A *write* in that beat is the
   * same race, and taking it left the two surfaces describing different forms: the handle held what
   * the control last sent, with its own verdict about it, while the form kept what it ended with and
   * will never submit either.
   */
  writesRefused: () => boolean = () => false,
): FieldRecord {
  const rawValue = rx.signal<unknown>(initialValue);
  const write = (next: () => unknown): void => {
    if (writesRefused()) {
      warn("was written to after the form ended. The write is not kept: the form answers with what it held when it ended.");
      return;
    }
    rawValue.set(beforeWrite ? beforeWrite(next()) : next());
  };
  const value: MdyWritableSignal<unknown> = beforeWrite || writesRefused !== undefined
    ? Object.assign(() => rawValue(), {
      set: (v: unknown) => write(() => v),
      update: (fn: (v: unknown) => unknown) => write(() => fn(rawValue())),
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
  /**
   * What the control says about the entry it is holding, when the two disagree.
   *
   * A date picker given text it cannot read keeps the text on screen and holds `null`
   * ([ADR 0063](../../../docs/architecture/0063-a-value-a-control-cannot-read-stays-where-it-can-be-corrected.md)),
   * and `null` is a value no rule objects to — so the page said the entry was wrong, the form said it
   * was fine, and the submit went out holding nothing where a person had typed something. A verdict
   * shown to somebody has to be a verdict the form counts.
   */
  const entryProblem = rx.signal<string | null>(null);
  const pending = rx.signal(false);

  const errors = rx.computed<ReadonlyArray<MdyFieldError>>(() => {
    const v = value();
    const syncErrors = Array.from(validators().values()).flatMap(fns =>
      fns.flatMap(fn =>
        readMessages(runValidator(fn, v, warn), warn).map(
          message => ({ kind: "validation", message }) as MdyFieldError,
        ),
      ),
    );
    const entry = entryProblem();
    return [
      ...syncErrors,
      ...asyncErrors(),
      ...extraErrors(v),
      ...(entry === null ? [] : [{ kind: "entry", message: entry } as MdyFieldError]),
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
    abandonAsync: null,
    asyncWake: rx.signal(0),
    asyncRunner: null,
    entryProblem,
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
/**
 * A rule is application code, and application code throws: a property read on something that turned
 * out to be null, a helper nobody imported, a locale table missing a key.
 *
 * The throw becomes the field's verdict, which is what the asynchronous half of the same feature
 * already does — a `serverValidator` that throws leaves what it threw on the field and the form
 * stays readable. Left to propagate, it came out of `state.valid()` instead, and out of every later
 * read for as long as the value stayed one the rule chokes on: a form that cannot be rendered, with
 * a stack pointing at whoever read it last rather than at the write.
 */
function runValidator(
  fn: (value: unknown) => unknown,
  value: unknown,
  warn: (message: string) => void,
): unknown {
  try {
    return fn(value);
  } catch (error) {
    // The engine's own refusals pass through. A rule that writes a signal from inside a computed is
    // told so by name, and turning that into a message on the field would hide an invariant of the
    // reactivity behind a sentence a user reads — the opposite of what the refusal is for.
    if (isEngineRefusal(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    warn(`threw while checking a value: ${message}`);
    return [message];
  }
}

/** Whether this is the engine refusing something, rather than an application rule failing. */
function isEngineRefusal(error: unknown): boolean {
  return error instanceof MdyComputedWriteError
    || error instanceof MdyDestroyedScopeError
    || error instanceof MdyCrossRuntimeObservationError
    || error instanceof MdyAdapterContractError
    || error instanceof MdyActivationError
    || error instanceof MdyUnsupportedCapabilityError;
}

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
/**
 * Abandons the run in flight when its field leaves play.
 *
 * A field out of play is not validated and not submitted, so a request still in flight about it
 * holds the whole form: `pending` true, `canSubmit` false, and a person waiting for the answer to a
 * question about a section they switched off. With a server that never answers, permanently.
 */
function watchLeavingPlay(rec: FieldRecord, rx: MdyReactivity, scope?: MdyReactiveScope): MdyEffectRef {
  let wasOut = false;
  return rx.effect(() => {
    const out = rec.state.disabled();
    if (!out) {
      // Back in play: the question is being asked again, and the run that would have answered it was
      // abandoned. Nothing else wakes the runner — the value has not changed — so this does.
      if (wasOut) {
        wasOut = false;
        rx.untracked(() => rec.asyncWake.update((n) => n + 1));
      }
      return;
    }
    wasOut = true;
    rx.untracked(() => {
      rec.abandonAsync?.();
      // The id moves too, so an answer already on its way lands on a run nobody is waiting for.
      rec.asyncRunId += 1;
      rec.pending.set(false);
      rec.asyncErrors.set([]);
    });
  }, { scope, debugName: "modyra:async-left-play" });
}

/**
 * The field a `dependsOn` name points at, from where the clause was written.
 *
 * A row is a **template**: declared once, instantiated per key. A cell naming its sibling can only
 * write the name that sibling has inside the row, and that name resolved against the form root,
 * where it does not exist — so the only spelling that worked was `rows.a.code`, which a template
 * cannot write, because it precedes every row and is shared by all of them. The result was a server
 * verdict left standing over a value that had since changed: an approval for an input nobody
 * checked.
 *
 * The absolute path is tried first, so nothing that resolves today resolves differently; the
 * row-relative reading only fills a silence.
 */
function dependencyState(
  host: MdyAsyncRunnerHost,
  dep: string,
): MdyFieldState<unknown> | null {
  const absolute = host.fieldState(dep);
  if (absolute !== null) return absolute;
  const at = host.fieldPath.lastIndexOf(".");
  if (at < 0) return null;
  return host.fieldState(`${host.fieldPath.slice(0, at)}.${dep}`);
}

/**
 * The runner's handle: torn down for good, or set aside while the form is paused.
 *
 * The two are different acts. Destroying abandons a run in flight; pausing lets it land, because a
 * pause does not change the value the run is about.
 */
export interface MdyAsyncRunner {
  destroy(): void;
  pause(): void;
}

export function createAsyncRunner(
  rec: FieldRecord,
  rx: MdyReactivity,
  host: MdyAsyncRunnerHost,
  scope?: MdyReactiveScope,
): MdyAsyncRunner {
  const leaving = watchLeavingPlay(rec, rx, scope);
  /** True while the runner is being torn down for a pause rather than for good. */
  let pausing = false;
  const runner = rx.effect((onCleanup) => {
    const v = rec.state.value();
    // Tracked, and nothing else reads it: the only transition that wakes this effect from outside
    // the value is a field returning to play.
    rec.asyncWake();
    const entries = Array.from(rec.asyncValidators().values());
    // Touch dependsOn field values so their changes retrigger this effect, and keep them: what a run
    // answered about is its own value *and* the values it was told to watch, so a dependency that
    // changed is a new question even though this field holds what it held.
    const watched: unknown[] = [];
    for (const e of entries) {
      for (const dep of e.dependsOn) watched.push(dependencyState(host, dep)?.value());
    }
    // Already answered, for this value and this wake. Resuming a paused form rebuilds this effect,
    // and running again would ask a server the same question about a value nobody changed — and
    // leave the form `pending` on the way to the answer it already has. A field returning to play
    // bumps `asyncWake`, which is what makes that a different question.
    const settled = rec.asyncSettledFor;
    if (
      settled !== undefined
      && Object.is(settled.value, v)
      && settled.wake === rec.asyncWake()
      && settled.deps.length === watched.length
      && settled.deps.every((held, index) => Object.is(held, watched[index]))
    ) {
      rx.untracked(() => rec.pending.set(false));
      return;
    }
    const runId = ++rec.asyncRunId;
    const controller = new AbortController();
    // Held so the watcher below can abandon it. A run is abandoned when its value stops being
    // acceptable; a field leaving play is the other way the same thing happens, and the watcher is
    // separate precisely so that reading what it reads does not put the runner back on the graph of
    // every interactivity change — a field becoming read-only is still being asked about, and
    // restarting its check there would be a question the form never stopped asking.
    rec.abandonAsync = () => controller.abort();
    onCleanup(() => {
      // A pause is not an abandonment. `deactivate()` promises to resume exactly where it left off,
      // and the environment it exists for — React Strict Mode's mount→unmount→remount — pauses a
      // form while a check debounced at zero is still in flight. Aborting there left the promise to
      // resolve into a form nobody was listening to, so `pending` never reached a terminal state and
      // the submit button of a completed form never came back.
      if (!pausing) controller.abort();
      rec.abandonAsync = null;
    });

    const formValue = rx.untracked(() => host.formValue());
    // A predicate that throws does not get to decide. Asking is the answer that cannot lose a
    // verdict: skipping the check on a broken predicate would let a value through unexamined, and
    // this one is read while the form is being built, so propagating took `createForm` with it and
    // left nothing to render.
    const applicable = entries.filter((e) => {
      if (e.when === null) return true;
      try {
        return e.when(v, formValue);
      } catch (error) {
        host.warn?.(
          `the predicate deciding whether to run an asynchronous check threw ` +
          `(${error instanceof Error ? error.message : String(error)}). The check runs.`,
        );
        return true;
      }
    });
    const fns = applicable.flatMap(e => e.fns);

    if (fns.length === 0) {
      rx.untracked(() => {
        rec.pending.set(false);
        rec.asyncErrors.set([]);
      });
      return;
    }
    // A server is asked only about a value the field's own rules accept.
    //
    // Typing a tax id one group at a time — `minLength(11)`, a pause between groups — sent four
    // requests, for `""`, `"I"`, `"IT"` and `"IT1"`. The form already knew all four were too short
    // to be a tax id, and asked anyway. The debounce is not the answer: it limits how *often* a
    // settled value is sent, and a settled prefix is still a prefix.
    //
    // `when` could suppress them, and doing so means restating in a second predicate what the field
    // has already declared — two truths that drift in silence the moment `minLength` changes. This
    // is the rule the field states, applied once.
    const refusedHere = Array.from(rec.validators().values()).some((list) =>
      list.some((fn) => readMessages(runValidator(fn, v, rec.warn), rec.warn).length > 0),
    );
    if (refusedHere) {
      rx.untracked(() => {
        rec.pending.set(false);
        // A verdict about a value that is no longer there is not a verdict about this one.
        rec.asyncErrors.set([]);
      });
      return;
    }
    // Out of play before the question is even asked: the effect below abandons a run in flight, and
    // this is the same rule for one that has not started.
    if (rx.untracked(() => rec.state.disabled())) {
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

      // Called inside the promise chain, so a check that throws *before* returning one fails the
      // same way as a check whose promise rejects. Declaring a validator `async` is what usually
      // hides the difference; a plain function that reads a property of something undefined is the
      // case that does not, and it was taking the form with it.
      void Promise.all(fns.map(fn => Promise.resolve().then(() => fn(v, ctx))))
        .then(results => {
          if (timeout) clearTimeout(timeout);
          if (timedOut || controller.signal.aborted) return;
          if (runId !== rec.asyncRunId) return; // stale run: last-wins
          rec.asyncErrors.set(
            results
              .flatMap(returned => readMessages(returned, rec.warn))
              .map(message => ({ kind: "async", message }) as MdyFieldError),
          );
          rec.asyncSettledFor = { value: v, wake: rx.untracked(() => rec.asyncWake()), deps: watched };
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

  // One handle for the pair: whoever created the runner destroys the watcher with it.
  return {
    destroy(): void {
      runner.destroy();
      leaving.destroy();
    },
    /**
     * Stops scheduling and lets a run already in flight land.
     *
     * The answer it brings is about the value the form still holds — a pause does not change one —
     * so taking it is what "resumes exactly where it left off" means. Destroying instead threw the
     * answer away and left the question open for good.
     */
    pause(): void {
      pausing = true;
      runner.destroy();
      leaving.destroy();
      pausing = false;
    },
  };
}
