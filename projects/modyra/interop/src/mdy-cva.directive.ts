import {
  Directive,
  effect,
  forwardRef,
  HostAttributeToken,
  inject,
  Injector,
  signal,
  untracked,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import {
  MdyDeclarativeAdapter,
  MdyFieldState,
  MDY_DECLARATIVE_REGISTRY,
  MDY_FORM_ADAPTER,
} from "@modyra/forms";

declare const ngDevMode: boolean | undefined;

/**
 * Bridges any modyra renderer into classic Reactive Forms /
 * `ngModel` — incremental adoption in existing codebases without an
 * `<mdy-form>`:
 *
 * ```html
 * <form [formGroup]="group">
 *   <mdy-control-text mdyCva name="email" formControlName="email" label="Email" />
 * </form>
 * ```
 *
 * The directive provides a private single-field adapter on the element (the
 * renderer resolves it instead of a surrounding `<mdy-form>`) and implements
 * `ControlValueAccessor` on top of it: `writeValue` → field value,
 * user edits → `onChange`, first blur → `onTouched`, `setDisabledState` →
 * field `disabled`. Validation stays in Reactive Forms — bind your own
 * error display to the `FormControl`, or mirror errors into the renderer
 * with `aria-*` inputs.
 */
@Directive({
  selector: "[mdyCva]",
  standalone: true,
  providers: [
    {
      provide: MDY_FORM_ADAPTER,
      useFactory: (): MdyDeclarativeAdapter =>
        new MdyDeclarativeAdapter(signal(undefined), signal("manual")),
    },
    {
      provide: MDY_DECLARATIVE_REGISTRY,
      useExisting: MDY_FORM_ADAPTER,
    },
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MdyCvaDirective),
      multi: true,
    },
  ],
})
export class MdyCvaDirective implements ControlValueAccessor {
  private readonly adapter = inject(MDY_FORM_ADAPTER) as MdyDeclarativeAdapter;
  private readonly injector = inject(Injector);
  private readonly fieldName =
    inject(new HostAttributeToken("name"), { optional: true }) ?? "value";

  private readonly _disabled = signal(false);
  /** True while writeValue applies a model→view update (must not re-emit). */
  private _writing = false;
  private _onChange: (value: unknown) => void = () => undefined;
  private _onTouched: () => void = () => undefined;

  constructor() {
    if (
      this.fieldName === "value" &&
      typeof ngDevMode !== "undefined" &&
      ngDevMode
    ) {
      console.warn(
        '[modyra] mdyCva host has no "name" attribute — using the fallback field name "value".',
      );
    }
    const state = this._state();
    this.adapter.setDisabled(this.fieldName, this._disabled.asReadonly());

    // View → model: propagate user edits, skipping writeValue echoes and
    // the first run — emitting the initial value would mark the FormControl
    // dirty at startup, violating the CVA contract (R21).
    let first = true;
    effect(
      () => {
        const value = state.value();
        untracked(() => {
          if (first) {
            first = false;
            return;
          }
          if (this._writing) return;
          this._onChange(value);
        });
      },
      { injector: this.injector },
    );

    // First touch propagates the blur to Reactive Forms.
    effect(
      () => {
        const touched = state.touched();
        untracked(() => {
          if (touched) this._onTouched();
        });
      },
      { injector: this.injector },
    );
  }

  private _state(): MdyFieldState<unknown> {
    const ref = this.adapter.getField(this.fieldName);
    if (!ref) {
      throw new Error(
        `[modyra] mdyCva could not create field "${this.fieldName}"`,
      );
    }
    return ref();
  }

  writeValue(value: unknown): void {
    this._writing = true;
    try {
      this._state().value.set(value ?? null);
    } finally {
      this._writing = false;
    }
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }
}
