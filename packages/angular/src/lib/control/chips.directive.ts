import { computed, Directive, input } from "@angular/core";
import { MDY_CHIP_CLASSES } from "@modyra/widgets";

/**
 * Chips Directive to enhance select/multiselect options.
 * 
 * Provides Material 3 styling and behavior for "Input Chips" or "Filter Chips".
 */
@Directive({
  selector: "[mdyChips]",
  standalone: true,
  host: { "[class]": "classes()" },
})
export class MdyChipsDirective {
  /**
   * What the chip wears, from the contract's vocabulary rather than from three literals here.
   *
   * A class spelled in a template is a renderer deciding what a chip is; the next one spells it
   * differently, and the theme's rule quietly styles nothing.
   */
  protected readonly classes = computed(() =>
    [
      MDY_CHIP_CLASSES.block,
      this.selected() ? MDY_CHIP_CLASSES.selected : "",
      this.removable() ? MDY_CHIP_CLASSES.removable : "",
    ]
      .filter(Boolean)
      .join(" "),
  );

  /** Whether the chip is currently selected/active. */
  readonly selected = input<boolean>(false);
  
  /** Whether the chip shows a removal (X) icon. */
  readonly removable = input<boolean>(true);
}
