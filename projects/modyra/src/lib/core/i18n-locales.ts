import { Provider } from "@angular/core";
import { buildDateLocale, MDY_DATE_LOCALE } from "./date-locale";
import {
  MDY_I18N_DEFAULT_TAGS,
  MDY_I18N_PRESETS,
  MdyBuiltInLocale,
  MdyI18nMessages,
} from "@modyra/core";
import { MDY_I18N_MESSAGES } from "./i18n";

// Catalogs are shared, framework-agnostic data from @modyra/core.
export {
  MDY_I18N_MESSAGES_DE,
  MDY_I18N_MESSAGES_ES,
  MDY_I18N_MESSAGES_FR,
  MDY_I18N_MESSAGES_IT,
} from "@modyra/core";
export type { MdyBuiltInLocale } from "@modyra/core";

const PRESETS = MDY_I18N_PRESETS;
const DEFAULT_TAGS = MDY_I18N_DEFAULT_TAGS;

export interface MdyLocaleOptions {
  /**
   * BCP 47 tag for `Intl`-based date formatting (month/day names, first day
   * of week). Defaults to the canonical tag of the language preset.
   */
  readonly dateLocale?: string;
  /** Per-key overrides applied on top of the language preset. */
  readonly overrides?: Partial<MdyI18nMessages>;
}

/**
 * Provides both UI strings and date localisation with one call:
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [provideModyraLocale("it")],
 * });
 * ```
 *
 * Built-in presets: `en`, `it`, `de`, `fr`, `es`. Use `overrides` to adjust
 * individual keys, or provide `MDY_I18N_MESSAGES` yourself for other
 * languages (the token is a plain object of strings).
 */
export function provideModyraLocale(
  locale: MdyBuiltInLocale,
  options?: MdyLocaleOptions,
): Provider[] {
  const messages: MdyI18nMessages = {
    ...PRESETS[locale],
    ...options?.overrides,
  };
  const tag = options?.dateLocale ?? DEFAULT_TAGS[locale];
  return [
    { provide: MDY_I18N_MESSAGES, useValue: messages },
    { provide: MDY_DATE_LOCALE, useValue: buildDateLocale(tag) },
  ];
}
