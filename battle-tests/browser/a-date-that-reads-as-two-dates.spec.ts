/**
 * A date shown to a person is unambiguous, or it follows the language they are reading in.
 *
 * `2026-04-03` is the third of April everywhere. `04/03/2026` is the third of April to a reader in
 * the United States and the fourth of March to one in Italy — the same nine characters, two
 * different days. Either is fine; **a slash format that does not move with the reader is not**,
 * because then one of those two people is being shown the other one's date.
 *
 * Measured with the **browser's own locale**, one document, `2026-04-03`:
 *
 *     locale        en-US        it-IT        de-DE
 *     plain         2026-04-03   2026-04-03   2026-04-03
 *     lit           2026-04-03   2026-04-03   2026-04-03
 *     angular       04/03/2026   03/04/2026   03.04.2026
 *
 * **All three pass, and the first version of this file said they did not.** It varied a `locale`
 * option on the mount — and neither host reads one, so its three cases were one case under a single
 * browser language. A renderer that follows `navigator.language` looks fixed when the language never
 * moves, and this file reported the only locale-aware renderer of the three as the broken one. The
 * whole finding was backwards.
 *
 * That is why the locale is set where the browser can see it. **A spec that varies an input nothing
 * reads is not measuring a variable**, and the shape of its wrong answer is indistinguishable from a
 * real one.
 *
 * What remains is a real difference and not a defect: **plain and lit ignore the reader's language
 * and angular follows it.** Unambiguous-everywhere and correct-in-your-own-language are both
 * defensible, and choosing is a design decision this file does not take — it refuses only the
 * combination neither of them is: ambiguous, and the same in every language.
 *
 * Claims under attack: LOC-003, UI-011, ADP-001.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

/** A date whose day and month can be swapped without either looking wrong. */
const ISO = "2026-04-03";

/** A display that could be read as two different days depending on where the reader is. */
const isAmbiguous = (shown: string) => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(shown.trim());

for (const host of HOSTS) {
  test(`a date says which day it is, ${host.name}`, async ({ browser }) => {
    test.setTimeout(120_000);

    const shown: Record<string, string> = {};
    // **The browser's locale, not an option on the mount.** This is the whole repair: a renderer
    // that reads `navigator.language` can only be measured by changing what it reads.
    for (const locale of ["en-US", "it-IT", "de-DE"]) {
      const context = await browser.newContext({ locale });
      const page = await context.newPage();
      try {
        await page.goto(host.page);
        await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
        await page.evaluate(async ({ api, iso }) => {
          await (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
            .mountFields("fmt", [{ name: "d", kind: "datepicker", label: "D", initialValue: iso }] as never);
        }, { api: host.api, iso: ISO });
        await page.waitForTimeout(350);

        const read = await page.evaluate(() => {
          const input = document.querySelector('[data-form="fmt"] input') as HTMLInputElement | null;
          // The language the page actually got, so a context that failed to take one is visible as
          // itself rather than as a renderer that ignores it.
          return { shown: input === null ? "" : (input.value || ""), language: navigator.language };
        });
        expect(read.language, `the browser did not take the locale ${locale}`).toBe(locale);
        shown[locale] = read.shown;
      } finally {
        await context.close();
      }
    }

    expect(
      Object.values(shown).every((each) => each.trim() !== ""),
      `the date field showed nothing in at least one language: ${JSON.stringify(shown)}`,
    ).toBe(true);

    const ambiguous = Object.values(shown).some((each) => isAmbiguous(each));
    const identical = new Set(Object.values(shown)).size === 1;

    expect(
      ambiguous && identical,
      `this renderer shows ${JSON.stringify(shown)}. That form reads as one day in the United States ` +
        "and another almost everywhere else, and it does not change with the language — so one of " +
        "those two readers is being shown the other one's date. Either follow the reader's language, " +
        "or use a notation that means the same thing in all of them.",
    ).toBe(false);
  });
}
