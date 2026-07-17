import { InjectionToken, ValueProvider } from "@angular/core";
import {
  MDY_I18N_MESSAGES_DE,
  MDY_I18N_MESSAGES_ES,
  MDY_I18N_MESSAGES_FR,
  MDY_I18N_MESSAGES_IT,
  type MdyDateLocale,
  type MdyI18nMessages,
} from "@modyra/core";
import { MDY_DATE_LOCALE } from "./date-locale";
import { MDY_I18N_MESSAGES } from "./i18n";
import { provideModyraLocale } from "./i18n-locales";

function findValue<T>(
  providers: ReadonlyArray<unknown>,
  token: InjectionToken<T>,
): T {
  const provider = providers.find(
    (p): p is ValueProvider =>
      typeof p === "object" &&
      p !== null &&
      (p as ValueProvider).provide === token,
  );
  if (!provider) throw new Error("provider not found");
  return provider.useValue as T;
}

describe("provideModyraLocale", () => {
  it("provides the language preset and a matching date locale", () => {
    const providers = provideModyraLocale("it");
    const messages = findValue(providers, MDY_I18N_MESSAGES);
    const dateLocale = findValue<MdyDateLocale>(providers, MDY_DATE_LOCALE);

    expect(messages.noResults).toBe("Nessun risultato");
    expect(dateLocale.locale).toBe("it-IT");
    expect(dateLocale.monthNamesLong[0]?.toLowerCase()).toBe("gennaio");
  });

  it("applies per-key overrides on top of the preset", () => {
    const providers = provideModyraLocale("de", {
      overrides: { noResults: "Nix gefunden" },
    });
    const messages = findValue(providers, MDY_I18N_MESSAGES);
    expect(messages.noResults).toBe("Nix gefunden");
    expect(messages.loading).toBe(MDY_I18N_MESSAGES_DE.loading);
  });

  it("honours a custom dateLocale tag", () => {
    const providers = provideModyraLocale("fr", {
      dateLocale: "fr-CA",
    });
    const dateLocale = findValue<MdyDateLocale>(providers, MDY_DATE_LOCALE);
    expect(dateLocale.locale).toBe("fr-CA");
  });

  it("every preset covers the full message interface", () => {
    const presets: ReadonlyArray<MdyI18nMessages> = [
      MDY_I18N_MESSAGES_IT,
      MDY_I18N_MESSAGES_DE,
      MDY_I18N_MESSAGES_FR,
      MDY_I18N_MESSAGES_ES,
    ];
    for (const preset of presets) {
      for (const [key, value] of Object.entries(preset)) {
        if (typeof value === "function") {
          expect(value("x")).toContain("x");
        } else {
          expect(typeof value).toBe("string");
          expect((value as string).length).toBeGreaterThan(0);
        }
        expect(key.length).toBeGreaterThan(0);
      }
    }
  });
});
