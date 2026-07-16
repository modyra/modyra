import { Directive, effect, ElementRef, forwardRef, inject, input } from "@angular/core";
import { MDY_FLOATING_LABELS, MDY_FLOATING_LABELS_DEFAULT, MDY_FLOATING_LABELS_DENSITY_DEFAULT } from "../core/tokens";

/**
 * Opt-in directive to enable Material-style floating labels for all descendant
 * modyra controls.
 *
 * Usage:
 * ```html
 * <mdy-form [mdyFloatingLabels]="true" [mdyFloatingLabelsDensity]="-3">
 *   ...
 * </mdy-form>
 * ```
 */
@Directive({
  selector: "mdy-form[mdyFloatingLabels], form[mdyFloatingLabels]",
  standalone: true,
  providers: [
    {
      provide: MDY_FLOATING_LABELS,
      useExisting: forwardRef(() => MdyFloatingLabelsDirective),
    },
  ],
})
export class MdyFloatingLabelsDirective {
  /** Enables or disables floating labels for descendants. Defaults to the value of `MDY_FLOATING_LABELS_DEFAULT`. */
  readonly mdyFloatingLabels = input<boolean>(inject(MDY_FLOATING_LABELS_DEFAULT));

  /** 
   * Density scaling for the floating labels, replicating M3 density behavior. 
   * 0 is standard M3 (56px), negative values make it more compact.
   * Defaults to the value of `MDY_FLOATING_LABELS_DENSITY_DEFAULT`.
   */
  readonly mdyFloatingLabelsDensity = input<number>(inject(MDY_FLOATING_LABELS_DENSITY_DEFAULT));

  constructor() {
    const el = inject(ElementRef);
    effect(() => {
      // Set the density custom property on the host element so it trickles down
      el.nativeElement.style.setProperty(
        "--mdy-floating-density",
        this.mdyFloatingLabelsDensity().toString()
      );
    });
  }
}
