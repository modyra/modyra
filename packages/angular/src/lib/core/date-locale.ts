import { InjectionToken } from "@angular/core";
import { buildDateLocale, type MdyDateLocale } from "@modyra/core/datetime";

/**
 * DI token that provides locale configuration for date components.
 *
 * The locale shape and builder are framework-agnostic and come from
 * `@modyra/core`; Angular keeps only the token/provider wiring here.
 */
export const MDY_DATE_LOCALE = new InjectionToken<MdyDateLocale>(
  "MDY_DATE_LOCALE",
  {
    providedIn: "root",
    factory: (): MdyDateLocale => {
      const tag =
        typeof navigator !== "undefined" && navigator.language
          ? navigator.language
          : "en-US";
      return buildDateLocale(tag);
    },
  },
);
