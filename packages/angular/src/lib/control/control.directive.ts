import {
  computed,
  contentChild,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  InputSignal,
  OnInit,
  Signal,
  signal,
  untracked
} from "@angular/core";
import { MDY_DECLARATIVE_REGISTRY, MDY_FLOATING_LABELS, MDY_FORM_ADAPTER, MDY_INLINE_ERRORS } from "../core/tokens";
import { MdyFieldHandle } from "../core/typed-form";
import { MdyFieldError, MdyFieldState, MdyFormAdapter } from "../core/types";
import { handleFormOf, NO_CONSTRAINTS, type MdyFieldConstraints } from "@modyra/core";
import type { MdyInteractivity } from "@modyra/core";
import {
  createValueWidgetController,
  type MdyValueWidgetController,
  defaultWidgetIdFactory,
  narrowConstraints,
  projectFieldShellA11y,
  type MdyPartContract,
  type MdyValueWidgetIntent,
  type MdyWidgetKind,
} from "@modyra/widgets";

declare const ngDevMode: boolean | undefined;
import { MdyPrefixDirective } from "./prefix.directive";
import { MdySuffixDirective } from "./suffix.directive";
import { MdySupportingTextDirective } from "./supporting-text.directive";
import { errorsVisible, shownErrors, showsAsInvalid } from "@modyra/widgets";

/** Global counter for generating unique field IDs. */
let _nextFieldId = 0;

/**
 * Abstract base class for all renderer components.
 *
 * Injects the nearest MdyFormAdapter (provided by MdyFormComponent)
 * and resolves the field state by name. Provides convenience computed
 * signals that concrete renderers bind in their templates.
 */
@Directive({
  host: {
    "[class.mdy-renderer--touched]": "touched()",
  },
})
export abstract class MdyBaseControl<TValue = unknown> implements OnInit {
  protected readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly _destroyRef = inject(DestroyRef);
  private prefixObserver?: ResizeObserver;
  /** Field name currently claimed on the registry (tracks name changes). */
  private _claimedName: string | null = null;

  constructor() {
    this._destroyRef.onDestroy(() => {
      this.prefixObserver?.disconnect();
      if (this._claimedName !== null) {
        this._declarativeRegistry?.removeField(this._claimedName);
      }
    });
    // Create and claim the field in an effect (side effects belong here, not
    // in the fieldState computed — B8). Claim counting lets the adapter warn
    // on duplicate names and drop state only with the last owner (B9).
    effect(() => {
      const n = this.effectiveName();
      untracked(() => {
        if (this._claimedName === n) return;
        if (this._claimedName !== null) {
          this._declarativeRegistry?.removeField(this._claimedName);
          this._claimedName = null;
        }
        if (!n) {
          if (typeof ngDevMode !== "undefined" && ngDevMode) {
            console.warn(
              "[modyra] Control has neither a name attribute nor a [field] handle.",
            );
          }
          return;
        }
        this.adapter.getField(n);
        this._declarativeRegistry?.claimField(n);
        this._claimedName = n;
      });
    });
    effect(() => {
      const hasPrefix = !!this.prefix();
      const isFloating = this.isFloatingLabel();

      this.prefixObserver?.disconnect();

      if (hasPrefix && isFloating) {
        if (typeof requestAnimationFrame === "undefined") return; // SSR guard (R2)
        // Aspettiamo che il DOM venga aggiornato dal blocco @if (prefix())
        requestAnimationFrame(() => {
          const host = this.hostElement.nativeElement;
          const prefixEl = host.querySelector('.mdy-input-prefix') as HTMLElement;

          if (prefixEl && typeof ResizeObserver !== 'undefined') {
            this.prefixObserver = new ResizeObserver((entries) => {
              const target = entries[0]?.target as HTMLElement | undefined;
              if (target) {
                // Calcolo esatto perfetto (Larghezza reale nel DOM)
                const width = target.offsetWidth;
                // Impostiamo la variabile CSS sul componente host, delegando il gap al CSS
                host.style.setProperty('--mdy-label-left-offset', `calc(${width}px + var(--mdy-fl-input-padding-with-prefix, 0.75rem))`);
              }
            });
            this.prefixObserver.observe(prefixEl);
          }
        });
      } else {
        this.hostElement.nativeElement.style.removeProperty('--mdy-label-left-offset');
      }
    });
  }
  /**
   * Field name for declarative (`name`-based) mode.
   * Optional when a typed `[field]` handle is bound instead.
   */
  public readonly name: InputSignal<string> = input<string>("");

  /**
   * Typed field handle from an `mdyForm()` schema — the type-safe
   * alternative to the stringly `name` attribute:
   * `<mdy-control-text [field]="form.f.email" />`.
   * Accepts the nullable variant too: adapter fields start as `null`
   * (e.g. Zod-derived handles are `T | null`) and every renderer already
   * treats `null` as "empty". The control only reads the handle's path.
   */
  public readonly field = input<
    MdyFieldHandle<TValue> | MdyFieldHandle<TValue | null> | undefined
  >(undefined);

  /** Resolved adapter path: the handle's path or the `name` input. */
  protected readonly effectiveName: Signal<string> = computed(
    () => this.field()?.path ?? this.name(),
  );

  /** The label text for the form control. */
  public readonly label = input<string>("");

  /**
   * The control's name when nothing visible carries it — a cell in a table, a control in a toolbar
   * whose column or icon says what it is to someone who can see it.
   *
   * Read only while `label` is empty. A visible label already names the control natively, and a
   * second name over the top of it is what makes the spoken name disagree with the written one.
   */
  public readonly ariaLabel = input<string | null>(null);

  /**
   * The name on the control element.
   *
   * The explicit one when it is given, otherwise the visible label's text. Naming the control from
   * the label as well as through `for` is redundant on paper and load-bearing in practice: the
   * label element also holds the required marker, so a name computed from its content carries an
   * asterisk the user's word does not — and anything matching on the name exactly, a test or an
   * assistive tool's find-by-name, then misses the control the user is asking for.
   */
  protected readonly controlAriaLabel: Signal<string | null> = computed(
    () => this.ariaLabel() || this.label() || null,
  );

  /** Opt-in or opt-out of floating labels on a per-control basis, overriding the form-level directive. */
  public readonly floatingLabel = input<boolean | undefined>(undefined);

  /**
   * Optional initial value for declarative mode.
   * Takes precedence over [formValue] set on the parent <mdy-form>.
   */
  readonly initialValue = input<unknown>(undefined);

  /**
   * The form this control writes into.
   *
   * Injected optionally so the failure can name the control. Without a form above it, Angular's own
   * error reports the missing token and nothing else — true, and useless in a template with thirty
   * controls in it, because the one that is outside is exactly the one it does not name.
   */
  private readonly _adapterOrNull = inject<MdyFormAdapter<Record<string, unknown>>>(
    MDY_FORM_ADAPTER,
    { optional: true },
  );

  private get adapter(): MdyFormAdapter<Record<string, unknown>> {
    if (this._adapterOrNull) return this._adapterOrNull;
    throw new Error(
      `[modyra] <${this.hostElement.nativeElement.tagName.toLowerCase()}>` +
      `${this._nameForError()} is outside a form. ` +
      "A control writes into the form that encloses it, so it must be a descendant of <mdy-form>; " +
      "a control rendered into an overlay or a dialog body is outside it unless the form element " +
      "wraps that too.",
    );
  }

  /** What identifies this control in a message, when it has said anything about which field it is. */
  private _nameForError(): string {
    const name = untracked(() => this.effectiveName());
    return name ? ` bound to "${name}"` : "";
  }

  private readonly _declarativeRegistry = inject(MDY_DECLARATIVE_REGISTRY, {
    optional: true,
  });

  /** True when MdyInlineErrorsDirective is applied to this element. */
  protected readonly inlineErrors: boolean =
    inject(MDY_INLINE_ERRORS, { self: true, optional: true }) ?? false;

  private readonly globalFloatingLabels = inject(MDY_FLOATING_LABELS, {
    optional: true,
  });

  /** Marks the field as required for assistive technology. */
  readonly ariaRequired = input<boolean>(false);

  /** Marks the field as disabled for assistive technology (auto-derived from field state). */
  readonly ariaDisabled = input<boolean | undefined>(undefined);


  /** Leading content (icon/text) provided via `mdyPrefix` directive. */
  protected readonly prefix = contentChild(MdyPrefixDirective);

  /** Trailing content (icon/text/button) provided via `mdySuffix` directive. */
  protected readonly suffix = contentChild(MdySuffixDirective);

  /** Supporting text (helper text) provided via `mdySupportingText` directive. */
  protected readonly supportingText = contentChild(MdySupportingTextDirective);

  /**
   * Inert state served while `name`/`[field]` are still unresolved. Input
   * signals are not set during construction, so any computed chained to
   * {@link fieldState} (value, errors, …) must stay readable there instead
   * of throwing; the constructor effect reports controls that are STILL
   * unresolved after init. Per instance — never shared.
   */
  private _detachedState?: MdyFieldState<TValue>;

  private _detached(): MdyFieldState<TValue> {
    if (!this._detachedState) {
      const value = signal(null as TValue);
      const touched = signal(false);
      const dirty = signal(false);
      const off: Signal<boolean> = computed(() => false);
      const interactivity: Signal<MdyInteractivity> = computed(() => "enabled");
      this._detachedState = {
        interactivity,
        value,
        touched,
        dirty,
        required: off,
        // No field, so no rule to read a constraint from.
        constraints: computed(() => NO_CONSTRAINTS),
        valid: computed(() => true),
        errors: computed(() => []),
        disabled: off,
        readonly: off,
        pending: off,
      } as MdyFieldState<TValue>;
    }
    return this._detachedState;
  }

  /**
   * The form that built the bound handle, when it is one this library made and it is not the form
   * enclosing this control. `null` for a `name` binding, a hand-built handle, or the ordinary case
   * of a handle from the enclosing form.
   */
  private _formOfHandle(): MdyFormAdapter<Record<string, unknown>> | null {
    const handle = this.field();
    if (!handle) return null;
    const form = handleFormOf(handle as object);
    if (!form || form === this._adapterOrNull) return null;
    return form as MdyFormAdapter<Record<string, unknown>>;
  }

  /** Resolved field state — reactive to name/[field] changes. */
  protected readonly fieldState: Signal<MdyFieldState<TValue>> = computed(
    () => {
      const n = this.effectiveName();
      if (!n) {
        // Constructor-time read (inputs unresolved) or a control with
        // neither binding: stay inert, the init effect warns on the latter.
        return this._detached();
      }
      // A handle knows which form built it, and that is the form to read. `[field]` names a path,
      // and a path means nothing without its form: two forms on one page share every path they have
      // in common, so resolving against whichever form encloses the control sends what the user
      // types into the wrong one, silently. The enclosing form answers only for `name`.
      const source = this._formOfHandle() ?? this.adapter;
      const ref = source.getField(n);
      if (!ref) {
        // A path inside a keyed collection whose row has not been declared. The control renders
        // empty and binds when the row arrives; it must not be the thing that brings it into being,
        // which is why the adapter answers null rather than creating a field on the way past.
        //
        // Reading `fieldNames` is what makes "when the row arrives" happen: whether the path is
        // open is answered from the collection's own set, which a gate reads without touching a
        // signal, so nothing else here would ever re-ask. The dependency is taken only on the
        // branch that has no field — a bound control depends on its own state and not on every
        // registration in the form.
        source.fieldNames?.();
        return this._detached();
      }
      return ref() as MdyFieldState<TValue>;
    },
  );

  // ── Convenience signals for templates ───────────────────────────────────────

  public readonly value: Signal<TValue> = computed(() =>
    this.fieldState().value(),
  );
  /**
   * The errors this control shows — which is not always the errors the field holds.
   *
   * A field the form is not asking about carries no verdict on screen: the rule belongs to
   * `@modyra/widgets`, and everything below reads it from here, so the wrapper class, the label
   * state, `aria-invalid` and the error list cannot drift apart. The devtools panel deliberately
   * reads the field instead: a debugging view shows the model, not what the user is being asked.
   */
  protected readonly errors: Signal<ReadonlyArray<MdyFieldError>> = computed(() =>
    shownErrors({ disabled: this.isDisabled() }, this.fieldState().errors()),
  );
  protected readonly touched: Signal<boolean> = computed(() =>
    this.fieldState().touched(),
  );
  protected readonly dirty: Signal<boolean> = computed(() =>
    this.fieldState().dirty(),
  );
  protected readonly isDisabled: Signal<boolean> = computed(() =>
    this.fieldState().disabled(),
  );
  /**
   * Read but not written.
   *
   * Angular had no counterpart to `isDisabled`, so no template could bind the native attribute and
   * a field a form had marked read-only kept accepting typing. `dispatchValueIntent` already fed
   * `readonly` to the scalar controller, which meant the blocking half worked while the DOM said
   * nothing — the confusing state this closes.
   */
  protected readonly isReadonly: Signal<boolean> = computed(() =>
    this.fieldState().readonly(),
  );
  protected readonly isValid: Signal<boolean> = computed(() =>
    this.fieldState().valid(),
  );
  protected readonly hasErrors: Signal<boolean> = computed(
    () => this.errors().length > 0,
  );
  /** Effective aria-disabled: explicit input overrides field state. */
  protected readonly effectiveAriaDisabled: Signal<boolean> = computed(
    () => this.ariaDisabled() ?? this.isDisabled(),
  );

  /**
   * Whether the error list is actually in the DOM.
   *
   * The single condition every renderer template guards the list with, so that anything naming the
   * list — `aria-describedby` above all — cannot disagree with whether it was rendered. An invalid
   * but untouched field is the common case: it has errors and shows none.
   */
  protected readonly errorsRendered: Signal<boolean> = computed(
    () =>
      !this.inlineErrors &&
      errorsVisible(
        { disabled: this.isDisabled(), touched: this.touched() },
        this.fieldState().errors(),
      ),
  );

  /**
   * The same question for a renderer that draws its error text beside the control rather than in a
   * list below it. One of the two is true at a time; both read the one rule, so a renderer cannot
   * show text the other would have hidden.
   */
  protected readonly inlineErrorShown: Signal<boolean> = computed(
    () =>
      this.inlineErrors &&
      errorsVisible(
        { disabled: this.isDisabled(), touched: this.touched() },
        this.fieldState().errors(),
      ),
  );

  /**
   * The id the supporting-text element carries, or `null` when none is rendered.
   *
   * Bound as `[id]` on that element by every renderer that draws one. Without it the text is
   * rendered, styled, and announced to nobody: a description no reference can reach is invisible to
   * assistive technology however carefully it is worded.
   */
  protected descriptionId(fieldId: string): string | null {
    // Rendered in the branch the error list does not occupy, so the two are never both present.
    return !this.errorsRendered() && this.supportingText()
      ? defaultWidgetIdFactory.part(fieldId, "description")
      : null;
  }

  /**
   * The id for `aria-describedby`, or `null` when there is nothing rendered to name.
   *
   * Takes the renderer's own `fieldId`, since each renderer mints one. The error list wins where
   * there is one, the supporting text answers otherwise, and a control with neither describes itself
   * by nothing — never by an id no element holds.
   */
  protected describedById(fieldId: string): string | null {
    // The shared factory, so this and the elements it names cannot spell the same relation two ways.
    if (this.errorsRendered()) return defaultWidgetIdFactory.part(fieldId, "errors");
    return this.descriptionId(fieldId);
  }

  /**
   * The semantic state of this control, as the shared contract projects it.
   *
   * A renderer binding `[mdyPart]="controlPart()"` receives `aria-invalid`, `aria-required`,
   * `aria-disabled` and `aria-describedby` from the shared projection, so no renderer decides for
   * itself which of a widget's states to expose.
   *
   * `errorsVisible` is answered here because the projection cannot know it: these renderers defer
   * the error list until the field is touched, so having errors is not the same as showing them.
   */
  protected readonly controlPart: Signal<MdyPartContract> = computed(() =>
    projectFieldShellA11y(
      {
        disabled: this.ariaDisabled() ?? this.isDisabled(),
        required: this.ariaRequired() || this.isRequired(),
      },
      this.errors(),
      {
        widgetId: this.fieldId,
        // The kind decides which native constraints its control can carry, and the projection turns
        // the field's rules into those attributes — so a renderer binding this part offers them
        // without naming one, and a renderer that gains a constraint tomorrow needs no edit.
        kind: this.widgetKind,
        constraints: narrowConstraints(this.fieldState().constraints(), this.narrowedConstraints()),
        errorsVisible: this.errorsRendered(),
        // Supporting text is only emitted when a host projects some.
        descriptionVisible: !!this.supportingText(),
      },
    ).control,
  );

  /** The renderer's own id, which the projection needs in order to name the parts it relates. */
  protected abstract readonly fieldId: string;

  /**
   * The kind this renderer draws. Defaults to a text-like control, which is what the projection
   * assumes for anything that does not say otherwise.
   */
  protected readonly widgetKind: string = "text";

  /**
   * What this renderer asks for on top of the field's rules — nothing, unless it has its own limits
   * to state. It cannot ask for more: the projection takes whichever end is tighter.
   */
  protected narrowedConstraints(): Partial<MdyFieldConstraints> {
    return {};
  }
  /** Whether the field is required (deduced from validators). */
  protected readonly isRequired: Signal<boolean> = computed(() =>
    this.fieldState().required(),
  );
  /** Error messages joined as a single string for inline display. */
  protected readonly inlineErrorText: Signal<string> = computed(() =>
    this.errors()
      .map((e: MdyFieldError) => e.message)
      .filter((msg) => !!msg && msg.trim() !== "")
      .join(", "),
  );

  /** Whether the field should display a floating label. */
  protected readonly isFloatingLabel: Signal<boolean> = computed(() => {
    const local = this.floatingLabel();
    if (local !== undefined) {
      return local;
    }
    return this.globalFloatingLabels?.mdyFloatingLabels() ?? false;
  });

  // ── Widgets scalar-controller bridge ───────────────────────────────────────

  private readonly _valueControllers = new Map<MdyWidgetKind, MdyValueWidgetController<unknown>>();

  /**
   * Sends scalar UI transitions through Widgets. Angular remains responsible
   * only for extracting the native DOM value and applying controller commands
   * to the form adapter.
   */
  protected dispatchValueIntent<T>(kind: MdyWidgetKind, intent: MdyValueWidgetIntent<T>): void {
    let controller = this._valueControllers.get(kind) as MdyValueWidgetController<T> | undefined;
    if (!controller) {
      controller = createValueWidgetController<T>({
        kind,
        value: this.value() as unknown as T,
        onChange: (next) => this.setValue(next as unknown as TValue),
      });
      this._valueControllers.set(kind, controller as MdyValueWidgetController<unknown>);
      this._destroyRef.onDestroy(() => controller?.destroy());
    }
    controller.setValue(this.value() as unknown as T);
    controller.setDisabled(this.isDisabled());
    controller.setReadonly(this.fieldState().readonly());
    controller.setInvalid(showsAsInvalid({ valid: this.isValid(), disabled: this.isDisabled() }));
    for (const command of controller.dispatch(intent)) {
      if (command.type === "mark-dirty") this.markAsDirty();
      if (command.type === "mark-touched") this.markAsTouched();
    }
  }

  protected dispatchValueBlur(kind: MdyWidgetKind): void {
    this.dispatchValueIntent(kind, { type: "blur" });
  }

  /** Applies non-user synchronization without dirty/touched side effects. */
  protected synchronizeValue(value: TValue): void {
    this.setValue(value);
  }

  // ── Mutation helpers ────────────────────────────────────────────────────────

  public setValue(newValue: TValue): void {
    this.fieldState().value.set(newValue);
  }

  protected markAsTouched(): void {
    this.fieldState().touched.set(true);
  }

  protected markAsDirty(): void {
    this.fieldState().dirty.set(true);
  }

  /** Generate a unique ID for template label/input association. */
  protected static nextId(): number {
    return _nextFieldId++;
  }

  ngOnInit(): void {
    const iv = this.initialValue();
    const n = this.effectiveName();
    if (this._declarativeRegistry && iv !== undefined && n) {
      this._declarativeRegistry.setInitialValue(n, iv);
    }
  }


}
