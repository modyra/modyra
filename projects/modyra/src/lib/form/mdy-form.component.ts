import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  Signal,
  signal,
  untracked,
} from "@angular/core";
import {
  MdyDeclarativeAdapter,
  MdyDeclarativeRegistry,
} from "../core/declarative-form-adapter";
import { MdyTypedFormLike } from "../core/typed-form";
import { MDY_DECLARATIVE_REGISTRY, MDY_FORM_ADAPTER } from "../core/tokens";
import {
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
  MdyFieldRef,
  MdyFormAdapter,
  MdyFormError,
  MdyFormState,
  MdyFormSubmitEvent,
  MdyFormValidatorFn,
  MdySubmitMode,
  ValidatorFn,
} from "../core/types";

/** Constant empty field list for adapters without introspection. */
const NO_FIELD_NAMES: Signal<readonly string[]> = signal([]).asReadonly();

/**
 * Host component for a declarative signal-driven form.
 *
 * Provides the adapter to all descendant renderer components via DI.
 *
 * **Explicit adapter mode** (existing API, unchanged):
 * ```html
 * <mdy-form [adapter]="adapter" (submitted)="handle($event)">…</mdy-form>
 * ```
 *
 * **Declarative mode** (no adapter needed):
 * ```html
 * <mdy-form [formValue]="{ age: 18 }" (submitted)="handle($event)">
 *   <mdy-control-text name="email" mdyRequired mdyEmail />
 *   <mdy-control-number name="age" [mdyMin]="18" />
 * </mdy-form>
 * ```
 */
@Component({
  selector: "mdy-form",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="$event.preventDefault(); handleSubmit()" novalidate>
      <ng-content />
    </form>
  `,
  styles: [`
    form {
      display: var(--mdy-form-display, block);
      flex-direction: var(--mdy-form-flex-direction, column);
      flex: var(--mdy-form-flex, initial);
      min-height: var(--mdy-form-min-height, auto);
      overflow: var(--mdy-form-overflow, visible);
    }
  `],
  providers: [
    {
      provide: MDY_FORM_ADAPTER,
      useExisting: forwardRef(() => MdyFormComponent),
    },
    {
      provide: MDY_DECLARATIVE_REGISTRY,
      useExisting: forwardRef(() => MdyFormComponent),
    },
  ],
})
export class MdyFormComponent<
  T extends Record<string, unknown>,
> implements MdyFormAdapter<T>, MdyDeclarativeRegistry {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Explicit adapter — if omitted the form creates one automatically. */
  readonly adapter = input<MdyFormAdapter<T>>();

  /**
   * Typed form model created with `mdyForm()`. Takes precedence over the
   * internal declarative adapter; `[adapter]` still wins over both.
   * `[formValue]` is ignored in this mode — initial values live in the schema.
   */
  readonly form = input<MdyTypedFormLike | undefined>(undefined);

  readonly action = input<
    | ((value: T) => Promise<MdyFormError[] | void> | MdyFormError[] | void)
    | undefined
  >(undefined);

  /**
   * Default values for declarative mode.
   * Per-control [initialValue] takes precedence over this.
   */
  readonly formValue = input<Partial<Record<string, unknown>>>();

  /** Submit behaviour for declarative mode (ignored when adapter is provided). */
  readonly submitMode = input<MdySubmitMode>("valid-only");

  /**
   * Form-level (cross-field) validators for declarative mode. Build them
   * with `crossField()`; errors land on the involved fields (or on the form
   * with `path: null`). With `[form]`/`[adapter]` declare validators on the
   * model instead.
   */
  readonly formValidators = input<
    ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>>
  >([]);

  /**
   * Declarative-mode draft autosave: persists the form value under this key
   * (localStorage) and restores it on init; cleared after an error-free
   * submit. With `[form]`/`[adapter]` configure the draft on the model.
   */
  readonly draftKey = input<string | undefined>(undefined);

  // ── Outputs ─────────────────────────────────────────────────────────────────
  readonly submitted = output<MdyFormSubmitEvent<T>>();

  // ── Internal declarative adapter ─────────────────────────────────────────────
  private readonly _declarativeAdapter: MdyDeclarativeAdapter;

  /** Last seed applied from [formValue] — used to diff per key (B2). */
  private _lastSeed: Partial<Record<string, unknown>> | undefined;

  constructor() {
    this._declarativeAdapter = new MdyDeclarativeAdapter(
      computed(() => this.formValue()),
      computed(() => this.submitMode()),
      inject(Injector),
    );

    // Sync formValue input to the adapter reactively.
    // Only keys whose seed value actually changed (Object.is) are patched:
    // an inline object literal recreated on every change detection must not
    // overwrite what the user typed in the meantime (B2).
    effect(() => {
      const val = this.formValue();
      untracked(() => {
        if (val) {
          const prev = this._lastSeed;
          const patch: Record<string, unknown> = {};
          for (const [key, seed] of Object.entries(val)) {
            if (!prev || !(key in prev) || !Object.is(prev[key], seed)) {
              patch[key] = seed;
            }
          }
          if (Object.keys(patch).length > 0) {
            this._declarativeAdapter.patchValue(patch);
          }
        }
        this._lastSeed = val;
      });
    });

    // Keep the internal adapter's cross-field validators in sync with the input.
    effect(() => {
      const validators = this.formValidators();
      untracked(() => this._declarativeAdapter.setFormValidators(validators));
    });

    // Draft autosave for declarative mode (first non-empty key wins).
    effect(() => {
      const key = this.draftKey();
      untracked(() => {
        if (key && !this.form() && !this.adapter()) {
          this._declarativeAdapter.enableDraft({ key });
        }
      });
    });
  }

  claimField(name: string): void {
    this._registry.claimField(name);
  }

  removeField(name: string): void {
    this._registry.removeField(name);
  }

  /** Active adapter: [adapter] wins, then [form], then the internal one. */
  private get _active(): MdyFormAdapter<T> {
    return (this.adapter() ??
      this.form() ??
      this._declarativeAdapter) as MdyFormAdapter<T>;
  }

  /** Registry target for controls/directives: [form] or the internal adapter. */
  private get _registry(): MdyDeclarativeRegistry {
    return this.form() ?? this._declarativeAdapter;
  }

  // ── MdyDeclarativeRegistry ────────────────────────────────────────────────

  addValidators<V>(name: string, validators: ReadonlyArray<ValidatorFn<V>>, isRequired?: boolean): void {
    this._registry.addValidators(name, validators, isRequired);
  }

  upsertValidators<V>(
    name: string,
    key: string,
    validators: ReadonlyArray<ValidatorFn<V>>,
    marksRequired?: boolean,
  ): void {
    this._registry.upsertValidators(name, key, validators, marksRequired);
  }

  removeValidators(name: string, key: string): void {
    this._registry.removeValidators(name, key);
  }

  upsertAsyncValidators<V>(
    name: string,
    key: string,
    validators: ReadonlyArray<MdyAsyncValidatorFn<V>>,
    options?: MdyAsyncValidatorOptions,
  ): void {
    this._registry.upsertAsyncValidators(name, key, validators, options);
  }

  setInitialValue(name: string, value: unknown): void {
    this._registry.setInitialValue(name, value);
  }

  setDisabled(name: string, disabled: Signal<boolean>): void {
    this._registry.setDisabled(name, disabled);
  }

  setReadonly(name: string, readonly: Signal<boolean>): void {
    this._registry.setReadonly(name, readonly);
  }

  // ── MdyFormAdapter delegation ───────────────────────────────────────────────

  get state(): MdyFormState {
    return this._active.state;
  }

  /**
   * Reactive flat field paths of the active adapter (empty for a custom
   * `[adapter]` that does not expose them) — used by the devtools.
   */
  get fieldNames(): Signal<readonly string[]> {
    const active = this._active as Partial<
      Record<"fieldNames", Signal<readonly string[]>>
    >;
    return active.fieldNames ?? NO_FIELD_NAMES;
  }

  get value(): Signal<T> {
    return this._active.value;
  }

  getValue(): T {
    return this._active.getValue();
  }

  getField<K extends keyof T>(name: K): MdyFieldRef<T[K]> | null {
    return this._active.getField(name);
  }

  errorsFor(path: keyof T | string): Signal<ReadonlyArray<MdyFormError>> {
    return this._active.errorsFor(path);
  }

  async submit(
    action: (
      value: T,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void> {
    return this._active.submit(action);
  }

  markAllTouched(): void {
    this._active.markAllTouched();
  }

  buildSubmitEvent(value: T): MdyFormSubmitEvent<T> {
    return this._active.buildSubmitEvent(value);
  }

  patchValue(partial: Partial<T>): void {
    this._active.patchValue(partial);
  }

  setValue(value: T): void {
    this._active.setValue(value);
  }

  reset(): void {
    this._active.reset();
  }

  // ── Template handler ────────────────────────────────────────────────────────

  protected async handleSubmit(): Promise<void> {
    // Unified path for both modes: canSubmit gates the emission too, so an
    // invalid form never emits `submitted` (B1) and submitCount/submitting
    // are tracked also without an [action] (B5).
    if (!this.state.canSubmit()) {
      this.markAllTouched();
      return;
    }
    const act = this.action();
    await this.submit(act ?? (() => undefined));
    this.submitted.emit(this._active.buildSubmitEvent(this.getValue()));
  }
}
