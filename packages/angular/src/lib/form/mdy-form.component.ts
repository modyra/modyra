import {
  signal,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  Signal,
  untracked,
} from "@angular/core";
import {
  MdyDeclarativeAdapter,
  MdyDeclarativeRegistry,
} from "../core/declarative-form-adapter";
import { MDY_DECLARATIVE_REGISTRY, MDY_FORM_ADAPTER } from "../core/tokens";
import { adoptSilentWrites, bindFormReset, formErrorsOf, MDY_FORM_SHELL_CLASSES } from "@modyra/widgets";
import {
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
  MdyFieldRef,
  MdyFormAdapter,
  MdyFormError,
  MdyFormState,
  MdyFormSubmitEvent,
  MdyFormValidatorFn,
  MdySanitizer,
  MdySubmitMode,
  ValidatorFn,
} from "../core/types";

declare const ngDevMode: boolean | undefined;

/** Constant empty field list for adapters without introspection. */

/**
 * True when an explicit `[adapter]` can also act as the declarative registry
 * (claims, validators, disabled/readonly providers). Adapters without these
 * methods fall back to the internal registry, but then declarative controls
 * cannot affect the displayed state — a mismatch we warn about in dev mode.
 */
function isDeclarativeRegistry(value: unknown): value is MdyDeclarativeRegistry {
  if (typeof value !== "object" || value === null) return false;
  return (
    typeof Reflect.get(value, "claimField") === "function" &&
    typeof Reflect.get(value, "removeField") === "function" &&
    typeof Reflect.get(value, "upsertValidators") === "function" &&
    typeof Reflect.get(value, "upsertAsyncValidators") === "function" &&
    typeof Reflect.get(value, "removeValidators") === "function" &&
    typeof Reflect.get(value, "setInitialValue") === "function" &&
    typeof Reflect.get(value, "setDisabled") === "function" &&
    typeof Reflect.get(value, "setReadonly") === "function"
  );
}

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
      <!--
        The form's own refusals, first, before the fields. A refusal naming a field reaches the
        person through that field; one naming no field — a failed call, a service that is down —
        has no field to reach them through, and without this the engine held it and the page said
        nothing. Rendered empty rather than not at all, so a region a screen reader is already
        watching announces what arrives in it.
      -->
      <ul [class]="formErrorsClass" role="status" [hidden]="formErrors().length === 0">
        @for (error of formErrors(); track $index) {
          <li [class]="formErrorItemClass">{{ error.message }}</li>
        }
      </ul>
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
  // What a submit sends. `Partial<T>` is the declarative default, but a typed form knows its schema
  // and produces a deeper answer — groups are optional all the way down. Pinning the default here
  // made the precise type unassignable to the general one, which is backwards.
  TSubmit = Partial<T>,
> implements MdyFormAdapter<T, TSubmit>, MdyDeclarativeRegistry {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Explicit adapter — if omitted the form creates one automatically. */
  readonly adapter = input<MdyFormAdapter<T, TSubmit>>();

  /**
   * Typed form model created with `mdyForm()`. Takes precedence over the
   * internal declarative adapter; `[adapter]` still wins over both.
   * `[formValue]` is ignored in this mode — initial values live in the schema.
   */
  readonly form = input<(MdyFormAdapter<T, TSubmit> & MdyDeclarativeRegistry) | undefined>(undefined);

  /**
   * The submit action.
   *
   * Receives `Partial<T>`, not `T`: a disabled field is not submitted, and any field may be
   * disabled at runtime. Read a key defensively rather than assuming the form's shape.
   */
  readonly action = input<
    | ((value: TSubmit) => Promise<MdyFormError[] | void> | MdyFormError[] | void)
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
  readonly submitted = output<MdyFormSubmitEvent<T, TSubmit>>();

  // ── Internal declarative adapter ─────────────────────────────────────────────
  private readonly _declarativeAdapter: MdyDeclarativeAdapter;

  /** Last seed applied from [formValue] — used to diff per key (B2). */
  private _lastSeed: Partial<Record<string, unknown>> | undefined;

  /** One-shot guard for the registry-incompatible [adapter] dev warning. */
  private _warnedAdapterRegistry = false;

  constructor() {
    this._declarativeAdapter = new MdyDeclarativeAdapter(
      computed(() => this.formValue()),
      computed(() => this.submitMode()),
      inject(Injector),
    );

    // The injector owns the adapter's Angular effects, but the engine also
    // holds timers, undo/redo stacks and field maps — release them with the
    // component. External [form]/[adapter] models stay untouched: their
    // lifetime belongs to whoever created them.
    inject(DestroyRef).onDestroy(() => this._declarativeAdapter.destroy());

    // The reset of the rendered `<form>`, answered by returning the model to its initial values.
    //
    // A Cancel button is `type="reset"`, and the browser's reset returns each control to its `value`
    // *attribute* — which this renderer never writes, since it keeps the box in step with the model.
    // Without this the button emptied the boxes and left the value the form would send untouched,
    // so what a person saw stopped being what they submitted.
    //
    // The write is deferred by `bindFormReset` because the browser resets its controls after the
    // event is dispatched: a model written during the event is overwritten a moment later.
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const form = host.querySelector("form");
      if (form === null) return;
      destroyRef.onDestroy(bindFormReset({ element: form, reset: () => { this.reset(); } }));

      // Values written into the boxes by something that never says so, told to the model.
      //
      // Session history restoration hands a person their typing back when they press Back, and
      // autofill puts an address into fields nobody touched. Both write the value property and
      // announce nothing, so the field showed one value while the form held another and a submit
      // sent the second.
      destroyRef.onDestroy(adoptSilentWrites({ root: form }));
    });

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
    //
    // Enabled after the first render, not during construction, because **a stored draft belongs to a
    // shape**: the engine names the form by the paths it holds, and a declarative form holds none
    // until its controls have claimed their fields. Enabled a moment too early, the restore compared
    // a draft written by a form of one field against a form of none, refused it as another form's
    // work — correctly, by its own rule — and the page came up empty while the draft sat in storage
    // untouched. The writing half worked throughout, which is what made it look like it worked.
    effect(() => {
      const key = this.draftKey();
      untracked(() => {
        if (!key || this.form() || this.adapter()) return;
        afterNextRender(
          () => this._declarativeAdapter.enableDraft({ key }),
          { injector: this._draftInjector },
        );
      });
    });
  }

  /** Where the deferred draft start is scheduled from; the constructor is an injection context. */
  private readonly _draftInjector = inject(Injector);

  claimField(name: string): void {
    this._registry.claimField(name);
  }

  removeField(name: string): void {
    this._registry.removeField(name);
  }

  /** Active adapter: [adapter] wins, then [form], then the internal one. */
  private get _active(): MdyFormAdapter<T, TSubmit> {
    return this.adapter() ?? this.form() ?? this._declarativeAdapter as unknown as MdyFormAdapter<T, TSubmit>;
  }

  /**
   * Registry target for controls/directives. Must resolve to the same object
   * as {@link _active}: claims and validators registered on a different
   * adapter than the one whose value is displayed would silently diverge
   * (required not applied, wrong field released on destroy).
   */
  private get _registry(): MdyDeclarativeRegistry {
    const adapter = this.adapter();
    if (adapter !== undefined) {
      if (isDeclarativeRegistry(adapter)) return adapter;
      // Explicit adapter without registry support: declarative controls and
      // validator directives cannot reach it. Surface the mismatch instead
      // of registering on an adapter the UI does not read from.
      if (
        !this._warnedAdapterRegistry &&
        typeof ngDevMode !== "undefined" &&
        ngDevMode
      ) {
        this._warnedAdapterRegistry = true;
        console.warn(
          "[modyra] [adapter] does not implement MdyDeclarativeRegistry: " +
          "declarative controls and validator directives are ignored in " +
          "this mode. Use an adapter that supports the registry (e.g. " +
          "MdyDeclarativeAdapter / mdyForm()) or bind [form] instead.",
        );
      }
    }
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

  setSanitizer(name: string, sanitizer: MdySanitizer): void {
    this._registry.setSanitizer(name, sanitizer);
  }

  setDisabled(name: string, disabled: Signal<boolean>): void {
    this._registry.setDisabled(name, disabled);
  }

  setInactive(name: string, inactive: Signal<boolean>): void {
    this._registry.setInactive(name, inactive);
  }

  setReadonly(name: string, readonly: Signal<boolean>): void {
    this._registry.setReadonly(name, readonly);
  }

  // ── MdyFormAdapter delegation ───────────────────────────────────────────────

  get state(): MdyFormState {
    return this._active.state;
  }

  /** Class vocabulary for the form's own parts, from the widget contract rather than spelled here. */
  protected readonly formErrorsClass = MDY_FORM_SHELL_CLASSES.formErrors;
  protected readonly formErrorItemClass = MDY_FORM_SHELL_CLASSES.formErrorItem;

  /** What the form has to say about itself: the refusals no field will show. */
  protected formErrors(): ReadonlyArray<MdyFormError> {
    return formErrorsOf(this.state.lastSubmitErrors());
  }

  /**
   * Reactive flat field paths of the active adapter — used by the devtools. Empty for a custom
   * `[adapter]` with no notion of membership to report.
   */
  get fieldNames(): Signal<readonly string[]> {
    return (this._active.fieldNames ?? NO_FIELD_NAMES) as Signal<readonly string[]>;
  }

  get value(): Signal<T> {
    return this._active.value;
  }

  getValue(): T {
    return this._active.getValue();
  }

  /** Every field except the disabled ones — what a submit actually sends. */
  submitValue(): TSubmit {
    return this._active.submitValue();
  }

  getField<K extends keyof T>(name: K): MdyFieldRef<T[K]> | null {
    return this._active.getField(name);
  }

  errorsFor(path: keyof T | string): Signal<ReadonlyArray<MdyFormError>> {
    return this._active.errorsFor(path);
  }

  async submit(
    action: (
      value: TSubmit,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void> {
    return this._active.submit(action);
  }

  markAllTouched(): void {
    this._active.markAllTouched();
  }

  /** Forwarded like every other adapter member: the form the component wraps is the one that counts it. */
  reportEntry(name: string, problem: string | null): void {
    this._active.reportEntry(name, problem);
  }

  buildSubmitEvent(value: TSubmit): MdyFormSubmitEvent<T, TSubmit> {
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
    // The event carries what was sent, not the live model: a disabled field is in one, not both.
    this.submitted.emit(this._active.buildSubmitEvent(this.submitValue()));
  }
}
