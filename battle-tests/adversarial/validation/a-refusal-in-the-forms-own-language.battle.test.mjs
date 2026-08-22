/**
 * A form that speaks a language, refusing in another one.
 *
 * A document declares `locale` on a field, and the parser takes it seriously: a malformed tag is
 * refused rather than degraded, because *"`Intl` throws a `RangeError`"*. The locale reaches the
 * calendar — month names, the first day of the week — and `messagesForLocale` gives a renderer the
 * widget's own words: `searchPlaceholder` is *"Cerca…"*, `noResults` is *"Nessun risultato"*.
 *
 * It does not reach the refusals. The same document, at three locales:
 *
 *   it   required → "This field is required"   email → "Invalid email address"
 *   de   required → "This field is required"   email → "Invalid email address"
 *   en   required → "This field is required"   email → "Invalid email address"
 *
 * So an Italian form has an Italian label, an Italian calendar, and underneath it a sentence in
 * English saying why it will not submit. The one thing the user needs to read is the one thing that
 * did not follow the language they were given everything else in.
 *
 * And a document cannot work around it. The field validator vocabulary is booleans and numbers —
 * `{ required: true }` — with no slot for a message; `{ required: { value: true, message: … } }` and
 * `{ required: "…" }` are both refused by the parser. A typed form can pass `required("obbligatorio")`
 * by hand; a document, which is the surface written by people who do not write code, cannot.
 *
 * The contract already holds the principle one slot over. `MdyDynamicValidation.message` is
 * **required**, and the reason given for making it required is this exact failure: *"a validation
 * nobody can read is a field that will not submit for no stated reason"*. A cross-field rule must be
 * readable; a `required` on a field need not be.
 *
 * The battle asserts the property and not the mechanism: two locales, two different refusals. A
 * message catalogue for validators, or a message slot in the document, or both, all satisfy it.
 */

import {
  applyFlatValidators,
  buildFlatFormSchema,
  createForm,
  parseDynamicForm,
} from "@modyra/core";
import { messagesForLocale } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The refusals a document's own validators produce, at one locale. */
function refusalsAt(locale) {
  const parsed = parseDynamicForm(
    {
      version: 2,
      fields: [
        { name: "d", kind: "datepicker", label: "Date", locale, validators: { required: true } },
        { name: "e", kind: "email", label: "Email", locale, validators: { required: true, email: true } },
        { name: "t", kind: "text", label: "Text", locale, validators: { minLength: 4 } },
      ],
    },
    { mode: "strict" },
  );
  const form = createForm(buildFlatFormSchema(parsed.fields), { devWarnings: false });
  try {
    applyFlatValidators(form, parsed.fields);
    form.f.e.set("not-an-email");
    form.f.t.set("ab");
    return {
      accepted: parsed.ok,
      required: form.errorsFor("d")().map((each) => each.message),
      email: form.errorsFor("e")().map((each) => each.message),
      length: form.errorsFor("t")().map((each) => each.message),
    };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["LOC-003"],
    title: "a form that speaks a language refuses in it too",
    environments: ["node"],
  },
  async (ctx) => {
    const italian = refusalsAt("it");
    const german = refusalsAt("de");
    ctx.log.note("the same document's refusals at two locales", { italian, german });

    // The control, and it is what makes this about refusals rather than about locales: the locale is
    // alive in the product — the parser accepts it, and the widget catalogue answers in it.
    const words = { it: messagesForLocale("it"), de: messagesForLocale("de"), en: messagesForLocale("en") };
    expectClaim(
      italian.accepted &&
        german.accepted &&
        words.it.noResults !== words.en.noResults &&
        words.de.noResults !== words.en.noResults,
      {
        claimIds: ["LOC-003"],
        what: "the locale reaches nothing at all, so this is about localization being absent rather than about refusals",
        detail: JSON.stringify({ accepted: [italian.accepted, german.accepted], noResults: { it: words.it.noResults, de: words.de.noResults, en: words.en.noResults } }),
      },
    );

    // The refusals themselves must have been produced, or "they are the same" would be two silences.
    expectClaim(
      italian.required.length > 0 && italian.email.length > 0 && italian.length.length > 0,
      {
        claimIds: ["LOC-003"],
        what: "a document's own validators refused nothing, so there are no refusals to read in any language",
        detail: JSON.stringify(italian),
      },
    );

    const same = ["required", "email", "length"].filter(
      (which) => JSON.stringify(italian[which]) === JSON.stringify(german[which]),
    );

    expectEqual(same, [], {
      claimIds: ["LOC-003"],
      what: "a form given a language refuses in another one, so the sentence a user has to read to submit is the one sentence not in their language",
    });
  },
);
