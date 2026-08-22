/**
 * A date shown to a person is unambiguous, or it follows the language they are reading in.
 *
 * `2026-04-03` is the third of April everywhere. `04/03/2026` is the third of April to a reader in
 * the United States and the fourth of March to one in Italy, Germany, France and most of the world —
 * the same nine characters, two different days, and nothing on the page to say which.
 *
 * Measured, the same document, three languages:
 *
 *     locale        en           it           de
 *     plain         2026-04-03   2026-04-03   2026-04-03
 *     lit           2026-04-03   2026-04-03   2026-04-03
 *     angular       04/03/2026   04/03/2026   04/03/2026
 *
 * **Neither is locale-aware**, and that is what turns this from a matter of taste into a defect. ISO
 * is a developer's notation and it is *correct in every language*. A fixed `MM/DD/YYYY` is not a
 * friendlier format for an Italian reader — it is a wrong one, and it is wrong silently.
 *
 * This was on its way to the user as a fourth decision, phrased as "which format should a date
 * take". The measurement narrows it: the question is not which of two formats, it is that one of
 * them **claims to be local and is not**. A renderer that showed `03/04/2026` under `it` would be
 * answering this file, and so would one that showed ISO.
 *
 * **The assertion picks no format.** It refuses one thing: a display that is ambiguous *and* the same
 * in every language, which is the only combination that cannot be read correctly by anyone outside
 * the locale it silently assumes.
 *
 * Claims under attack: LOC-003, UI-011, ADP-001.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

/** Deliberately a date whose day and month can be swapped without looking wrong. */
const ISO = "2026-04-03";
const LOCALES = ["en", "it", "de"];

/** A display that could be read as two different days depending on where the reader is. */
const isAmbiguous = (shown: string) => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(shown.trim());

for (const host of HOSTS) {
  test(`a date says which day it is, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const shown: Record<string, string> = {};
    for (const locale of LOCALES) {
      const id = `fmt-${locale}`;
      await page.evaluate(async ({ api, mountId, loc, iso }) => {
        await (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
          .mountFields(mountId, [{ name: "d", kind: "datepicker", label: "D", initialValue: iso }] as never, { locale: loc } as never);
      }, { api: host.api, mountId: id, loc: locale, iso: ISO });
      await page.waitForTimeout(300);

      shown[locale] = await page.evaluate((mountId) => {
        const input = document.querySelector(`[data-form="${mountId}"] input`) as HTMLInputElement | null;
        return input === null ? "" : (input.value || input.getAttribute("value") || "");
      }, id);
    }

    // The premise: something was drawn and it carries the date. An empty box would satisfy every
    // check below by having nothing to read.
    expect(
      Object.values(shown).every((each) => each.trim() !== ""),
      `the date field showed nothing in at least one language: ${JSON.stringify(shown)}`,
    ).toBe(true);

    const ambiguous = LOCALES.filter((locale) => isAmbiguous(shown[locale]));
    const identical = new Set(Object.values(shown)).size === 1;

    expect(
      ambiguous.length > 0 && identical,
      `this renderer shows ${JSON.stringify(shown)}. That form reads as one day in the United States ` +
        "and another almost everywhere else, and it does not change with the language — so it is not " +
        "a local format, it is one locale's format shown to everybody. Either the display follows the " +
        "reader's language, or it uses a notation that means the same thing in all of them.",
    ).toBe(false);
  });
}
