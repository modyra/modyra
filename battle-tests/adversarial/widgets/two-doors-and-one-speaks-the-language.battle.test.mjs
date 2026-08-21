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

    ctx.log.note("what each door says about the same hour", {
      wholeFieldViaSeam: wholeField,
      segmentLatin: latin,
      segmentEastern: timepickerEntry("hour", "24h", "١٤", MDY_EVERY_TIME),
      seamReachableFromSegment: timepickerEntry.length > 4,
    });

    // The defect: the same host, the same hour, two doors, two answers. `timepickerEntry` takes four
    // parameters and none of them is the reader, so a renderer holding a locale-aware `parseEntry` has
    // nowhere to hand it over.
    expectClaim(timepickerEntry.length > 4, {
      claimIds: ["LOC-001"],
      what: "the segment entry function accepts no reader, so a host that supplied one for the field cannot reach it from a box — the same numerals are read when the whole time is typed and refused when a segment is",
      detail:
        `timepickerEntry(field, format, text, steps) has ${timepickerEntry.length} parameters; ` +
        `"١٤" → ${JSON.stringify(timepickerEntry("hour", "24h", "١٤", MDY_EVERY_TIME))} ` +
        `while the field's own parseEntry reads "١٤:٣٠" as "14:30"`,
    });
  },
);
