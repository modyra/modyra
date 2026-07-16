import { Directive, input } from "@angular/core";

/**
 * MdyGlassDirective
 *
 * Applies a "Liquid Glass" effect to the host element using backdrop-filters,
 * semi-transparent backgrounds, and specular highlights.
 *
 * The visual appearance is driven by CSS variables (--mdy-glass-*) which are
 * defined in the theme layer (e.g., modyra-ios.css).
 *
 * Usage:
 * <div mdyGlass [intensity]="'high'">...</div>
 */
@Directive({
  selector: "[mdyGlass]",
  standalone: true,
  host: {
    "class": "mdy-glass-effect",
    "[class.mdy-glass-effect--low]": "intensity() === 'low'",
    "[class.mdy-glass-effect--medium]": "intensity() === 'medium'",
    "[class.mdy-glass-effect--high]": "intensity() === 'high'",
    "[style.--mdy-glass-filter-override]": "blur()",
    "[style.--mdy-glass-bg-override]": "glassColor()"
  },
})
export class MdyGlassDirective {
  /** Optional override for the blur amount (e.g., '10px' or 'blur(10px)') */
  readonly blur = input<string | undefined>(undefined);

  /** Intensity of the glass effect. Themes can use this to adjust blur/opacity. */
  readonly intensity = input<"low" | "medium" | "high">("medium");

  /** Optional background color override to tint the glass. */
  readonly glassColor = input<string | undefined>(undefined);
}
