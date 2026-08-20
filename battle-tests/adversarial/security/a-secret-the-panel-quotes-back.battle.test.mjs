/**
 * The value the panel masks, printed back in the column beside it.
 *
 * `mdyFormSnapshot` masks the value of a field declared `sensitive`, and it masks the same value out
 * of that field's **messages**, because quoting what was rejected — `"hunter2" is not long enough` —
 * is the most ordinary way there is to write a validation message. `withoutValue` is the function
 * that does it, and its own comment says why: masking a value and printing it back beside it does not
 * mask the value.
 *
 * It collects the literals to remove from strings, numbers, bigints and arrays. A form value may also
 * be an **object**, and then it collects nothing:
 *
 *     a string                 rejected "•••"                                     masked
 *     a number                 rejected •••                                       masked
 *     an array                 rejected ["•••"]                                   masked
 *     an object                rejected {"start":"hunter2…","end":"hunter2…"}     printed
 *     an object in an array    rejected [{"pan":"hunter2…"}]                      printed
 *     a nested object          rejected {"a":{"b":"hunter2…"}}                    printed
 *
 * The array branch walks into the array and then drops what it finds there, so a list of objects is
 * the case that looks covered and is not.
 *
 * It reaches shipped kinds. A `daterange` holds `{ start, end }`, and its own contract check quotes
 * the endpoint it could not read — `This field holds ISO dates, and start is "…"` — so a `daterange`
 * declared `sensitive`, given a value it cannot parse, prints that value in the panel's error column
 * with `•••` in the value column of the same row. `file` holds a list of files and `multiselect` a
 * list of option values, which may be objects.
 *
 * The value column and the error column of one row disagreeing about whether a value is a secret is
 * `SEC-002` exactly: a value the panel masks is readable elsewhere in the same panel.
 *
 * Green when a message quoting a sensitive field's value has that value masked, whatever shape the
 * value has.
 */

import { createForm, field } from "@modyra/core";
import { mdyFormSnapshot } from "@modyra/core/devtools";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 40));
const SECRET = "hunter2-THE-SECRET";
const SECRET_NUMBER = 4111111111111111;

/** Every shape a form value can take, with the secret somewhere inside it. */
const SHAPES = Object.freeze([
  ["a string", SECRET],
  ["a number", SECRET_NUMBER],
  ["an array", [SECRET]],
  ["an object", { start: SECRET, end: SECRET }],
  ["an object in an array", [{ pan: SECRET }]],
  ["a nested object", { a: { b: SECRET } }],
]);

/** What the panel shows for a sensitive field whose validator quoted the value back. */
async function panelRowFor(value) {
  const quoting = () => [`rejected ${JSON.stringify(value)}`];
  const form = createForm({ v: field(null, [quoting], { sensitive: true }) }, { devWarnings: false });
  await settled();
  form.setValue({ v: value });
  form.markAllTouched();
  await settled();
  const row = mdyFormSnapshot(form).fields.find((each) => each.path === "v");
  form.destroy();
  return row;
}

battle(
  {
    claims: ["SEC-002"],
    title: "a secret is masked in the message as well as in the value",
    environments: ["node"],
  },
  async (ctx) => {
    const leaked = [];
    const unmaskedValue = [];

    for (const [what, value] of SHAPES) {
      const row = await panelRowFor(value);
      const printed = JSON.stringify(row.errors);
      ctx.log.note("a sensitive field whose message quotes its value", { what, masked: row.masked, errors: row.errors });

      // The value column must be masked in every case, or the row would not be making the promise
      // the error column breaks — that is the control, and it fails first if masking stops entirely.
      if (row.value !== "•••") unmaskedValue.push(`${what}: value column shows ${JSON.stringify(row.value)}`);

      if (printed.includes(SECRET) || printed.includes(String(SECRET_NUMBER))) leaked.push(what);
    }

    expectEqual(unmaskedValue, [], {
      claimIds: ["SEC-002"],
      what: "the panel did not mask the value of a field declared sensitive",
    });

    expectEqual(leaked, [], {
      claimIds: ["SEC-002"],
      what: "a value the panel masks is printed back in the message column of the same row",
    });
  },
);
