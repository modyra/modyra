import { Directive, effect, inject, input } from "@angular/core";
import { MDY_FORM_ADAPTER, MDY_OPTIONS_CONTROL } from "../core/tokens";
import { MdyOptionsControl, MdySelectOption } from "../core/types";

/**
 * Directive that automatically filters options of a host select/multiselect
 * based on the value of another field in the same form.
 *
 * Usage:
 * ```html
 * <mdy-select name="country" [options]="countries" />
 * <mdy-select name="province"
 *   [mdyDependsOn]="'country'"
 *   [mdyOptionsMap]="provincesByCountry" />
 * ```
 */
@Directive({
  selector: "[mdyDependsOn]",
  standalone: true,
})
export class MdyConditionalOptionsDirective<TValue = unknown> {
  /** Name of the form field that this control depends on. */
  readonly mdyDependsOn = input.required<string>();

  /**
   * Map of options keyed by the dependent field's value,
   * or a function that returns options given the value.
   */
  readonly mdyOptionsMap = input.required<
    | Record<string | number, readonly MdySelectOption<TValue>[]>
    | ((val: unknown) => readonly MdySelectOption<TValue>[])
  >();

  private readonly adapter = inject(MDY_FORM_ADAPTER);
  private readonly host = inject<MdyOptionsControl<TValue>>(MDY_OPTIONS_CONTROL, {
    host: true,
    optional: true,
  });

  /** Sentinel distinguishing "no previous run" from a legitimate undefined value. */
  private static readonly UNSET: unique symbol = Symbol("unset");
  private previousVal: unknown = MdyConditionalOptionsDirective.UNSET;

  constructor() {
    effect(() => {
      const depName = this.mdyDependsOn();
      const map = this.mdyOptionsMap();
      if (!depName || !map || !this.host) return;

      const depField = this.adapter.getField(depName);
      if (!depField) return;

      const val = depField().value();
      // Falsy keys (0, false, "") are valid map keys — only null/undefined
      // fall back to the empty key (B25).
      const key = val === null || val === undefined ? "" : String(val);
      const options = typeof map === "function" ? map(val) : map[key];

      this.host.overrideOptions.set(options || []);

      if (
        this.previousVal !== MdyConditionalOptionsDirective.UNSET &&
        this.previousVal !== val
      ) {
        this.host.resetSelection();
      }
      this.previousVal = val;
    });
  }
}
