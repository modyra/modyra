import { Directive, input } from "@angular/core";

/**
 * Chips Directive to enhance select/multiselect options.
 * 
 * Provides Material 3 styling and behavior for "Input Chips" or "Filter Chips".
 */
@Directive({
  selector: "[mdyChips]",
  standalone: true,
  host: {
    class: "mdy-chip",
    "[class.mdy-chip--selected]": "selected()",
    "[class.mdy-chip--removable]": "removable()",
  }
})
export class MdyChipsDirective {
  /** Whether the chip is currently selected/active. */
  readonly selected = input<boolean>(false);
  
  /** Whether the chip shows a removal (X) icon. */
  readonly removable = input<boolean>(true);
}
