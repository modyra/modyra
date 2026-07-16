import { Directive } from "@angular/core";

/**
 * Structural directive to mark an `<ng-template>` as the custom option
 * template for `MdySelectComponent`.
 *
 * The template receives the option as implicit context.
 *
 * ```html
 * <mdy-control-select name="country" [options]="countries">
 *   <ng-template mdyOption let-opt>
 *     {{ opt.value | uppercase }} — {{ opt.label }}
 *   </ng-template>
 * </mdy-control-select>
 * ```
 */
@Directive({
  selector: "[mdyOption]",
  standalone: true,
})
export class MdyOptionDirective {}
