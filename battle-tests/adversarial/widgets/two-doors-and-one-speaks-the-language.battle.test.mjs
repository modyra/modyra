/**
 * A timepicker has two ways in, and only one of them was told what language the reader speaks.
 *
 * Both pickers declare the same seam, in the same words: *"Reads typed text … A dependency because the
 * reading is locale-aware and the locale belongs to the host: a control knows what `14/03` means where
 * it is rendered, and this package does not."*
 *
 *     datepicker-field-controller.ts:209   options.parseEntry?.(trimmed)
 *     timepicker-field-controller.ts:272   options.parseEntry?.(trimmed)
 *
 * The per-segment door added with the partial-entry rule does not consult it:
 *
 *     timepicker-entry.ts:56   if (typed.length > WIDTH || (… && !/^\d+$/.test(typed))) return null;
 *
 * `\d` is `[0-9]`. So a host that supplies a locale-aware `parseEntry` — the thing the type exists to
 * receive — gets its own digits read when the whole time is typed, and refused when the same digits
 * are typed into the hour box. One widget, two answers.
 *
 * The datepicker has no such split: every typed entry goes through the seam. This is the timepicker's
 * newer door, and it was written where the older one is a few lines away.
 *
 * **The point is not that Arabic-Indic digits must be accepted here.** This package cannot know what a
 * numeral is anywhere — that is exactly why the reading was made a dependency. The point is that a
 * segment must be able to reach the same reader the field already has, so a host answers once.
 *
 * Green when both doors of one widget ask the same reader.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const widgets = await import("@modyra/widgets");

/** Latin digits for the numerals a locale might use instead. */
const EASTERN = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
const toLatin = (text) => [...text].map((glyph) => EASTERN[glyph] ?? glyph).join("");

battle(
  {
    claims: ["LOC-001", "UI-011"],
    title: "both ways into a timepicker ask the same reader",
    environments: ["node"],
  },
  async (ctx) => {
    const { timepickerEntry, MDY_EVERY_TIME } = widgets;

    // A host that reads its own numerals, which is precisely what `parseEntry` is declared to receive.
    const parseEntry = (text) => {
      const latin = toLatin(text.trim());
      return /^\d{1,2}:\d{2}$/.test(latin) ? latin.padStart(5, "0") : null;
    };

    // The premise: the seam works, and the reader really can read what is being typed. Without this
    // the assertion below would be a complaint about a host that cannot read either.
    const wholeField = parseEntry("١٤:٣٠");
    expectClaim(wholeField === "14:30", {
      claimIds: ["LOC-001"],
      what: "the host's own reader could not read its own numerals, so this battle is testing the wrong thing",
      detail: JSON.stringify(wholeField),
    });

    const latin = timepickerEntry("hour", "24h", "14", MDY_EVERY_TIME);
    expectClaim(latin !== null && latin.value === 14, {
      claimIds: ["UI-011"],
      what: "the segment door refuses plain latin digits, so it is broken for a reason other than language",
      detail: JSON.stringify(latin),
    });

    // The host's reader for one bare numeral. A segment carries no separator, no ordering and no
    // AM/PM, so it is a narrower reading than `parseEntry` and not the same function.
    const readSegment = (text) => {
      const asLatin = toLatin(text.trim());
      return /^\d{1,2}$/.test(asLatin) ? Number(asLatin) : null;
    };

    const offered = timepickerEntry("hour", "24h", "١٤", MDY_EVERY_TIME, readSegment);
    const refused = timepickerEntry("hour", "24h", "٢٩", MDY_EVERY_TIME, readSegment);

    ctx.log.note("what each door says about the same hour", {
      wholeFieldViaSeam: wholeField,
      segmentLatin: latin,
      segmentEasternWithoutReader: timepickerEntry("hour", "24h", "١٤", MDY_EVERY_TIME),
      segmentEasternWithReader: offered,
    });

    // The property, asserted as behaviour rather than as arity. An earlier draft of this checked
    // `timepickerEntry.length > 4`, which can never become true: `Function.length` counts only the
    // parameters before the first default, so a reader added after one is invisible to it. The
    // assertion was unsatisfiable and would have stayed red against a correct fix — a wall rather
    // than a test, and the third time tonight an assertion of mine measured something adjacent to
    // its own claim.
    expectClaim(offered !== null && offered.value === 14, {
      claimIds: ["LOC-001"],
      what: "a host that supplies its own reader still cannot get a segment read in its numerals, so the same digits are accepted when the whole time is typed and refused when a box is",
      detail:
        `"١٤" with a reader → ${JSON.stringify(offered)}; ` +
        `the field's own parseEntry reads "١٤:٣٠" as ${JSON.stringify(wholeField)}`,
    });

    // And the reader must not become a way past the field's own rules: once read, a numeral is judged
    // the way any other is. 29 is not an hour in any alphabet.
    expectClaim(refused !== null && refused.value === null, {
      claimIds: ["LOC-001", "UI-011"],
      what: "a numeral read through the host's reader escaped the range the field enforces on every other entry",
      detail: `"٢٩" with a reader → ${JSON.stringify(refused)}`,
    });
  },
);
