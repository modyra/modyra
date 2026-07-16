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
  untracked
} from "@angular/core";
import { MDY_DECLARATIVE_REGISTRY, MDY_FLOATING_LABELS, MDY_FORM_ADAPTER, MDY_INLINE_ERRORS } from "../core/tokens";
import { MdyFieldHandle } from "../core/typed-form";
import { MdyFieldError, MdyFieldState, MdyFormAdapter } from "../core/types";

declare const ngDevMode: boolean | undefined;
import { MdyPrefixDirective } from "./prefix.directive";
import { MdySuffixDirective } from "./suffix.directive";
import { MdySupportingTextDirective } from "./supporting-text.directive";

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

  /** Opt-in or opt-out of floating labels on a per-control basis, overriding the form-level directive. */
  public readonly floatingLabel = input<boolean | undefined>(undefined);

  /**
   * Optional initial value for declarative mode.
   * Takes precedence over [formValue] set on the parent <mdy-form>.
   */
  readonly initialValue = input<unknown>(undefined);

  private readonly adapter: MdyFormAdapter<Record<string, unknown>> =
    inject<MdyFormAdapter<Record<string, unknown>>>(MDY_FORM_ADAPTER);

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

  /** Resolved field state — reactive to name/[field] changes. */
  protected readonly fieldState: Signal<MdyFieldState<TValue>> = computed(
    () => {
      const n = this.effectiveName();
      if (!n) {
        throw new Error(
          "[modyra] Control needs a name attribute or a [field] handle",
        );
      }
      const ref = this.adapter.getField(n);
      if (!ref) {
        throw new Error(
          `[modyra] Field "${n}" not found in form adapter`,
        );
      }
      return ref() as MdyFieldState<TValue>;
    },
  );

  // ── Convenience signals for templates ───────────────────────────────────────

  public readonly value: Signal<TValue> = computed(() =>
    this.fieldState().value(),
  );
  protected readonly errors: Signal<ReadonlyArray<MdyFieldError>> = computed(
    () => this.fieldState().errors(),
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