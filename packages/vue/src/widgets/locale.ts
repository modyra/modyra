/**
 * The locale a widget speaks, and the words it says.
 *
 * A document may name one; otherwise it is the page's, which is what every other renderer in this
 * library reads. Defaulting to English instead is the shape that makes a translated page correct in
 * exactly one language: the calendar's weekday row began on Sunday everywhere, and the openers said
 * "Choose T" whatever the reader's language — right in `en-US` by coincidence, wrong beyond it.
 *
 * The words come from the shared dictionary, so a name a person hears is translated by the same
 * table for every renderer rather than composed here in English.
 */
import { computed, type ComputedRef } from "vue";
import { messagesForLocale, type MdyI18nMessages } from "@modyra/widgets";

/** The document's choice if it made one, the page's otherwise. */
export function resolveLocale(declared: string | undefined | null): string {
  if (declared !== undefined && declared !== null && declared !== "") return declared;
  if (typeof document !== "undefined") {
    const written = document.documentElement.lang;
    if (written !== "") return written;
  }
  return typeof navigator === "undefined" ? "en-US" : navigator.language;
}

/** What this widget says, in the language it resolved. */
export function useMessages(declared: () => string | undefined | null): ComputedRef<MdyI18nMessages> {
  return computed(() => messagesForLocale(resolveLocale(declared())));
}
