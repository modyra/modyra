/**
 * The same eight characters, meaning two different days.
 *
 * `03/04/2026` is the third of April to a reader in Rome and the fourth of March to one in New York,
 * and `parseLocalizedDate` is exported so a consumer can do that reading themselves. A form that
 * gets the order wrong stores a date nobody typed, and stores it as a perfectly valid ISO string —
 * there is no later check that can notice, because the result is a real date.
 *
 * That is why `LOC-001` is an integrity claim rather than an ergonomic one, and why the calendar
 * half belongs with it: a parser lenient enough to accept the 30th of February would turn a typo
 * into a date instead of refusing it.
 *
 * The leniency is characterised here too, and asserted rather than left implicit. The parser reads
 * the first three runs of digits and is indifferent to what separates or surrounds them, so
 * `1.1.2026` is understood from a keyboard that has no slash — while a fourth number, a digit
 * interrupted by an invisible character, or non-Latin digits are refused. Pinning where that stops
 * is the point: leniency nobody wrote down is leniency that grows.
 */

import { localeDateOrder, parseIsoDate, parseLocalizedDate } from "@modyra/core/datetime";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The same numerals, read by locales that order them differently. */
const AMBIGUOUS = "03/04/2026";

const BY_LOCALE = Object.freeze([
  ["en-US", { year: 2026, month: 3, day: 4 }],
  ["it-IT", { year: 2026, month: 4, day: 3 }],
  ["de-DE", { year: 2026, month: 4, day: 3 }],
  ["ja-JP", { year: 2026, month: 3, day: 4 }],
]);

battle(
  {
    claims: ["LOC-001"],
    title: "one date string is read as the day its reader's locale says",
    environments: ["node"],
  },
  async (ctx) => {
    for (const [locale, expected] of BY_LOCALE) {
      const read = parseLocalizedDate(AMBIGUOUS, locale);
      ctx.log.note("the same numerals read by another locale", { locale, read });

      expectEqual(read, expected, {
        claimIds: ["LOC-001"],
        what: `${AMBIGUOUS} was read as the wrong day in ${locale}`,
      });

      // The order the parser used has to be the order the locale declares, not one that happens to
      // agree for this example: two locales here read the same day for different reasons.
      const order = localeDateOrder(locale);
      expectClaim(order.includes("day") && order.includes("month") && order.includes("year"), {
        claimIds: ["LOC-001"],
        what: `${locale} does not declare a complete date order`,
        detail: JSON.stringify(order),
      });
    }

    // ISO is accepted everywhere, which is what makes a stored value portable between readers.
    for (const [locale] of BY_LOCALE) {
      expectEqual(parseLocalizedDate("2026-04-03", locale), { year: 2026, month: 4, day: 3 }, {
        claimIds: ["LOC-001"],
        what: `an ISO date was not accepted in ${locale}`,
      });
    }

    expectEqual(parseIsoDate("2026-04-03"), { year: 2026, month: 4, day: 3 }, {
      claimIds: ["LOC-001"],
      what: "the ISO reader disagrees with the localized one about an ISO date",
    });
  },
);

battle(
  {
    claims: ["LOC-001"],
    title: "a date the calendar does not have is refused rather than rounded",
    environments: ["node"],
  },
  async (ctx) => {
    const impossible = [
      ["en-US", "02/30/2026"],
      ["it-IT", "30/02/2026"],
      ["it-IT", "31/04/2026"],
      ["en-US", "02/29/2026"],
      ["en-US", "13/01/2026"],
      ["en-US", "99/99/9999"],
      ["en-US", ""],
      ["en-US", "   "],
    ];

    for (const [locale, text] of impossible) {
      ctx.log.note("a date the calendar does not have", { locale, text });
      expectEqual(parseLocalizedDate(text, locale), null, {
        claimIds: ["LOC-001"],
        what: `${JSON.stringify(text)} was accepted in ${locale}`,
      });
    }

    // The leap year that exists, so the refusals above are about the calendar rather than about a
    // parser that rejects every February.
    expectEqual(parseLocalizedDate("02/29/2024", "en-US"), { year: 2024, month: 2, day: 29 }, {
      claimIds: ["LOC-001"],
      what: "a leap day the calendar does have was refused",
    });

    // Two digits mean this century, both ends of the documented window.
    for (const [text, expected] of [["1/1/00", 2000], ["1/1/26", 2026], ["1/1/99", 2099]]) {
      expectEqual(parseLocalizedDate(text, "en-US")?.year, expected, {
        claimIds: ["LOC-001"],
        what: `a two-digit year in ${JSON.stringify(text)} left the documented window`,
      });
    }
  },
);

battle(
  {
    claims: ["LOC-001"],
    title: "the parser is indifferent to separators and strict about how many numbers there are",
    environments: ["node"],
  },
  async (ctx) => {
    const april3 = { year: 2026, month: 4, day: 3 };

    // A reader types what their keyboard offers. The separator is not the promise; the order is.
    for (const text of ["3/4/2026", "3.4.2026", "3-4-2026", "3 4 2026"]) {
      ctx.log.note("a separator a keyboard offers", { text });
      expectEqual(parseLocalizedDate(text, "it-IT"), april3, {
        claimIds: ["LOC-001"],
        what: `${JSON.stringify(text)} was not read as a date`,
      });
    }

    // And where the leniency stops. A fourth number is not a date; a digit broken by an invisible
    // character is not a number; digits that are not Latin are not read, which the guide states.
    for (const text of ["3/4/2026/5", "3/4/20​26", "٣/٤/٢٠٢٦"]) {
      ctx.log.note("input past where the leniency stops", { text });
      expectEqual(parseLocalizedDate(text, "it-IT"), null, {
        claimIds: ["LOC-001"],
        what: `${JSON.stringify(text)} was read as a date`,
      });
    }
  },
);
