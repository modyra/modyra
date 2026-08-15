/**
 * Two decisions nothing in this suite had ever named, and both get the hard case right.
 *
 * `calendarKeyboardTarget` decides where focus goes in a calendar grid. Its contract states one rule
 * in particular — *month/year jumps clamp the day (Jan 31 → Feb 28)* — and the interesting half of
 * that rule is what it does **not** do: clamping to 28 always would be wrong in a leap year, and a
 * leap day jumped a year has to land on the 28th because there is nowhere else.
 *
 * `messagesForLocale` answers with the strings a control shows. Five locales ship. The failure that
 * matters is not a wrong translation — it is a **missing key**, because a message table is read by
 * key and a missing one renders as nothing where a person expected a word.
 *
 * Neither is asserted anywhere else. Both are pure decisions with no state to set up, which makes a
 * regression in either cheap to introduce and invisible without a check like this one.
 */

import { MDY_I18N_MESSAGES_DEFAULT, calendarKeyboardTarget, messagesForLocale } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const on = (year, month, day) => ({ year, month, day });

battle(
  {
    claims: ["UI-002", "LOC-001"],
    title: "a calendar jump lands on a day that exists, in a leap year too",
    environments: ["node"],
  },
  async (ctx) => {
    const cases = [
      ["Jan 31 to the next month, an ordinary year", "PageDown", on(2026, 1, 31), false, on(2026, 2, 28)],
      ["Jan 31 to the next month, a leap year", "PageDown", on(2024, 1, 31), false, on(2024, 2, 29)],
      ["Mar 31 back a month", "PageUp", on(2026, 3, 31), false, on(2026, 2, 28)],
      ["the leap day, forward a year", "PageDown", on(2024, 2, 29), true, on(2025, 2, 28)],
      ["the leap day, back a year", "PageUp", on(2024, 2, 29), true, on(2023, 2, 28)],
      ["May 31 to a month with thirty days", "PageDown", on(2026, 5, 31), false, on(2026, 6, 30)],
      ["the last day of the year, one day on", "ArrowRight", on(2026, 12, 31), false, on(2027, 1, 1)],
      ["the first day of the year, one day back", "ArrowLeft", on(2026, 1, 1), false, on(2025, 12, 31)],
      ["the first day of the year, a week back", "ArrowUp", on(2026, 1, 1), false, on(2025, 12, 25)],
      ["the last day of the year, a week on", "ArrowDown", on(2026, 12, 31), false, on(2027, 1, 7)],
      ["Home, to the start of the month", "Home", on(2026, 5, 15), false, on(2026, 5, 1)],
      ["End, to the end of the month", "End", on(2026, 5, 15), false, on(2026, 5, 31)],
    ];

    for (const [what, key, focused, shift, expected] of cases) {
      const landed = calendarKeyboardTarget(key, focused, shift);
      ctx.log.note("a calendar jump", { what, landed });
      expectEqual(landed, expected, {
        claimIds: ["UI-002"],
        what: `${what} did not land where the grid pattern says it should`,
      });
    }

    // A key the grid does not use moves nothing, which is what lets a host pass every key through
    // without deciding first which ones matter.
    expectEqual(calendarKeyboardTarget("Tab", on(2026, 5, 15), false), null, {
      claimIds: ["UI-002"],
      what: "a key the calendar does not handle moved focus anyway",
    });
  },
);

battle(
  {
    claims: ["LOC-002"],
    title: "every locale answers for every message a control asks it for",
    environments: ["node"],
  },
  async (ctx) => {
    const expected = Object.keys(MDY_I18N_MESSAGES_DEFAULT);

    // The control: the table is not nearly empty, so agreeing about it means something.
    expectEqual(expected.length > 20, true, {
      claimIds: ["LOC-002"],
      what: "the default message table is nearly empty, so completeness means nothing",
      detail: String(expected.length),
    });

    const gaps = [];
    for (const locale of ["en", "it", "de", "fr", "es"]) {
      const messages = messagesForLocale(locale);
      const missing = expected.filter((key) => !(key in messages));
      const blank = expected.filter((key) => key in messages && String(messages[key] ?? "").trim() === "");
      ctx.log.note("a locale's table", { locale, keys: Object.keys(messages).length, missing, blank });
      if (missing.length > 0 || blank.length > 0) gaps.push({ locale, missing, blank });
    }

    expectEqual(gaps, [], {
      claimIds: ["LOC-002"],
      what: "a locale is missing a message a control asks for, or answers with nothing",
    });

    // An unsupported locale answers in full rather than partly: a control cannot render half a table,
    // and falling back key by key would leave one word English in the middle of a sentence.
    expectEqual(expected.filter((key) => !(key in messagesForLocale("zz"))), [], {
      claimIds: ["LOC-002"],
      what: "a locale nobody ships answered with an incomplete table instead of a complete fallback",
    });
  },
);
