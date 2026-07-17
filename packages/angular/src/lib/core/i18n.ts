import { InjectionToken } from "@angular/core";
import { MDY_I18N_MESSAGES_DEFAULT, MdyI18nMessages } from "@modyra/core";

/**
 * All static UI strings used by modyra renderers.
 * Override by providing `MDY_I18N_MESSAGES` at the root or component level.
 *
 * @example
 * providers: [{ provide: MDY_I18N_MESSAGES, useValue: { ...MDY_I18N_MESSAGES_DEFAULT, noResults: 'Nessun risultato' } }]
 */
export const MDY_I18N_MESSAGES = new InjectionToken<MdyI18nMessages>(
  "MDY_I18N_MESSAGES",
  { providedIn: "root", factory: () => MDY_I18N_MESSAGES_DEFAULT },
);
