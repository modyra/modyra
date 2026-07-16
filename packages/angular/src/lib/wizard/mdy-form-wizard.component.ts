import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  inject,
  output,
  Signal,
  signal,
  untracked,
} from "@angular/core";
import { MDY_I18N_MESSAGES } from "../core/i18n";
import { MDY_FORM_ADAPTER } from "../core/tokens";
import { MdyFormAdapter } from "../core/types";
import { MdyWizardStepComponent } from "./mdy-wizard-step.component";

/**
 * Multi-step wizard over a single `<mdy-form>`.
 *
 * Place it inside the form and declare the steps as content children; the
 * wizard shows one step at a time (hidden, not destroyed), gates "Next" on
 * the validity of the active step's `[fields]`, and renders a progress
 * header plus navigation buttons.
 *
 * ```html
 * <mdy-form [form]="form" (submitted)="save($event)">
 *   <mdy-form-wizard (finished)="onFinished()">
 *     <mdy-wizard-step label="Account" [fields]="[form.f.email, form.f.password]">
 *       <mdy-control-text [field]="form.f.email" label="Email" />
 *       …
 *     </mdy-wizard-step>
 *     <mdy-wizard-step label="Address" [fields]="[form.f.address.city]">…</mdy-wizard-step>
 *   </mdy-form-wizard>
 * </mdy-form>
 * ```
 *
 * `finished` fires on the last step's confirm button — typically you call
 * `form.submit(...)` or submit the surrounding form there.
 */
@Component({
  selector: "mdy-form-wizard",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "mdy-wizard" },
  template: `
    <!-- Wizard steps use aria-current="step" (WAI pattern) — tab semantics
         would require tabpanel/aria-controls pairing the steps lack (R23). -->
    <nav
      class="mdy-wizard__header"
      [attr.aria-label]="i18n.wizardStepStatus(activeIndex() + 1, steps().length)"
    >
      @for (step of steps(); track $index) {
        <button
          type="button"
          class="mdy-wizard__step-tab"
          [class.mdy-wizard__step-tab--active]="$index === activeIndex()"
          [class.mdy-wizard__step-tab--done]="$index < activeIndex()"
          [attr.aria-current]="$index === activeIndex() ? 'step' : null"
          [disabled]="$index > activeIndex() && !canJumpTo($index)"
          (click)="goTo($index)"
        >
          <span class="mdy-wizard__step-index">{{ $index + 1 }}</span>
          @if (step.label()) {
            <span class="mdy-wizard__step-label">{{ step.label() }}</span>
          }
        </button>
      }
    </nav>

    <div class="mdy-wizard__body">
      <ng-content />
    </div>

    <div class="mdy-wizard__nav">
      <button
        type="button"
        class="mdy-button mdy-wizard__prev"
        [disabled]="activeIndex() === 0"
        (click)="previous()"
      >
        {{ i18n.wizardPrevious }}
      </button>
      <span class="mdy-wizard__status" aria-live="polite">
        {{ i18n.wizardStepStatus(activeIndex() + 1, steps().length) }}
      </span>
      <button
        type="button"
        class="mdy-button mdy-wizard__next"
        (click)="next()"
      >
        {{ isLast() ? i18n.wizardFinish : i18n.wizardNext }}
      </button>
    </div>
  `,
})
export class MdyFormWizardComponent {
  protected readonly i18n = inject(MDY_I18N_MESSAGES);
  private readonly adapter = inject<MdyFormAdapter<Record<string, unknown>>>(
    MDY_FORM_ADAPTER,
  );

  protected readonly steps = contentChildren(MdyWizardStepComponent);

  private readonly _activeIndex = signal(0);
  /** Index of the currently visible step. */
  readonly activeIndex: Signal<number> = this._activeIndex.asReadonly();

  /** True while the last step is active. */
  readonly isLast: Signal<boolean> = computed(
    () => this._activeIndex() >= this.steps().length - 1,
  );

  /** 0..1 progress across the steps (for progress bars). */
  readonly progress: Signal<number> = computed(() => {
    const total = this.steps().length;
    return total === 0 ? 0 : (this._activeIndex() + 1) / total;
  });

  /** Validity of the currently active step's declared fields. */
  readonly activeStepValid: Signal<boolean> = computed(() => {
    const step = this.steps()[this._activeIndex()];
    return step ? this._stepValid(step) : true;
  });

  /** Fires after every successful navigation with the new index. */
  readonly stepChange = output<number>();
  /** Fires when the user confirms the last step. */
  readonly finished = output<void>();

  constructor() {
    // Reflect the active index onto the steps (and clamp when steps change).
    effect(() => {
      const steps = this.steps();
      const index = this._activeIndex();
      untracked(() => {
        if (steps.length > 0 && index >= steps.length) {
          this._activeIndex.set(steps.length - 1);
          return;
        }
        steps.forEach((s, i) => s.isActive.set(i === index));
      });
    });
  }

  /** Advances (or fires `finished` on the last step) if the step is valid. */
  next(): void {
    const step = this.steps()[this._activeIndex()];
    if (step && !this._stepValid(step)) {
      this._touchStep(step);
      return;
    }
    if (this.isLast()) {
      this.finished.emit();
      return;
    }
    this._activeIndex.update((i) => i + 1);
    this.stepChange.emit(this._activeIndex());
  }

  previous(): void {
    if (this._activeIndex() === 0) return;
    this._activeIndex.update((i) => i - 1);
    this.stepChange.emit(this._activeIndex());
  }

  /** Jumps to a step: backwards freely, forwards only across valid steps. */
  goTo(index: number): void {
    const steps = this.steps();
    if (index < 0 || index >= steps.length || index === this._activeIndex()) {
      return;
    }
    if (index > this._activeIndex() && !this.canJumpTo(index)) return;
    this._activeIndex.set(index);
    this.stepChange.emit(index);
  }

  /** True when every step before `index` is valid. */
  protected canJumpTo(index: number): boolean {
    return this.steps()
      .slice(0, index)
      .every((s) => this._stepValid(s));
  }

  private _stepValid(step: MdyWizardStepComponent): boolean {
    return step
      .fieldNames()
      .every((name) => this.adapter.getField(name)?.().valid() ?? true);
  }

  private _touchStep(step: MdyWizardStepComponent): void {
    for (const name of step.fieldNames()) {
      this.adapter.getField(name)?.().touched.set(true);
    }
  }
}
