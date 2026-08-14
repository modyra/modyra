/**
 * What a sanitized value can still be made to say.
 *
 * `SEC-001` is about paths and prototypes: where a name may point. This is about what a *value* may
 * contain once the engine has finished with it, which nothing had attacked — and the guide makes an
 * absolute of it: `strict` "removes `<`, `` ` `` and `>`. The value can never form markup."
 *
 * An absolute is worth a corpus rather than an example. The interesting inputs are the ones that
 * *reassemble*: a sanitizer that removes one `<` per pass turns `<<script>` into `<script`, and one
 * that removes only the first occurrence leaves every other. Both look correct against `<script>`.
 *
 * The other half is where the value came in. A pure function that strips markup is worth nothing if
 * a row declared with a value, a `setAll`, or a `patch` reaches the model by a path that does not
 * call it — which is the shape of most of what this suite has found. So every ingress is driven, at
 * three depths, rather than trusting that one calls the same code as another.
 */

import { array, createForm, field, group, record } from "@modyra/core";
import { applyValueSecurity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The characters the profile promises to remove, in every arrangement that could survive one. */
const MARKUP = Object.freeze([
  "<script>alert(1)</script>",
  "<<script>>x<</script>>",
  "<<>>script",
  "<<<<<script",
  "< script>",
  "`backticks`",
  "a < b && c > d",
]);

/** Text that is not markup and must survive: a name is not an attack. */
const LEGITIMATE = Object.freeze([
  "O'Brien & Co",
  "50% > 40%".replace(/[<>]/g, ""),
  "café — naïve",
  "&lt;not-markup&gt;",
]);

const strict = (value) => applyValueSecurity(value, { sanitizer: "strict" }).value;
const formsMarkup = (value) => /[<>`]/.test(String(value));

battle(
  {
    claims: ["SEC-003"],
    title: "a strict value carries no character that could open a tag",
    environments: ["node"],
  },
  async (ctx) => {
    for (const input of MARKUP) {
      const once = strict(input);
      ctx.log.note("markup through the strict profile", { input, once });

      expectClaim(!formsMarkup(once), {
        claimIds: ["SEC-003"],
        what: `${JSON.stringify(input)} kept a character the profile removes`,
        detail: JSON.stringify(once),
      });

      // Idempotent, which is what makes one pass enough: a profile that had to be run twice would
      // be a profile whose first pass left something behind.
      expectEqual(strict(once), once, {
        claimIds: ["SEC-003"],
        what: `sanitizing ${JSON.stringify(input)} twice differs from sanitizing it once`,
      });
    }

    // The control on the other side. A profile that emptied every string would pass everything
    // above and be useless, so what must survive is asserted too.
    for (const input of LEGITIMATE) {
      expectEqual(strict(input), input, {
        claimIds: ["SEC-003"],
        what: `${JSON.stringify(input)} was altered, though it is text rather than markup`,
      });
    }

    // Deep: a value is not always a string. Strings inside plain objects and arrays are the same
    // question one level in.
    const deep = strict({ rows: { a: { code: "<b>x</b>", tags: ["<i>y</i>"] } } });
    expectClaim(!formsMarkup(JSON.stringify(deep)), {
      claimIds: ["SEC-003"],
      what: "markup inside a nested value was not reached",
      detail: JSON.stringify(deep),
    });
  },
);

battle(
  {
    claims: ["SEC-003", "COL-001"],
    title: "every door into a cell is a door the sanitizer stands at",
    environments: ["node"],
  },
  async (ctx) => {
    const evil = "<script>x</script>";
    const clean = strict(evil);
    const options = { security: { sanitize: "strict" }, devWarnings: false };

    // The control: the corpus really is markup, so a form that sanitized nothing would be visible.
    expectClaim(clean !== evil && !formsMarkup(clean), {
      claimIds: ["SEC-003"],
      what: "the value used to test the doors is not markup to begin with",
      detail: JSON.stringify(clean),
    });

    const doors = [];
    const record3 = () => createForm({ o: record(group({ lines: array(group({ sku: field("") })) })) }, options);

    // A row declared with a value — the door most of this suite's findings came through.
    const declared = record3();
    declared.f.o.upsert("a", { lines: [{ sku: evil }] });
    doors.push(["declared with the row", declared.getValue().o.a.lines[0].sku]);

    // A write to a cell two levels down, taken through the handle a consumer holds.
    declared.f.o.row("a").lines.at(0).sku.set(evil);
    doors.push(["written through a nested handle", declared.getValue().o.a.lines[0].sku]);
    declared.destroy();

    // Whole-value writes, which reach the model by their own path.
    const wholesale = createForm({ rows: record(group({ code: field("") })) }, options);
    wholesale.f.rows.setAll({ a: { code: evil } });
    doors.push(["set through setAll", wholesale.getValue().rows.a.code]);
    wholesale.patch({ rows: { a: { code: evil } } });
    doors.push(["set through patch", wholesale.getValue().rows.a.code]);
    wholesale.destroy();

    for (const [door, landed] of doors) {
      ctx.log.note("a value arriving by one of the doors", { door, landed });
      expectEqual(landed, clean, {
        claimIds: ["SEC-003", "COL-001"],
        what: `a value ${door} reached the model without being sanitized`,
      });
    }

    // And the order the guide states: a field that asks for nothing takes the form's profile, and
    // one that asks for `off` keeps what it was given. A default that could not be overridden would
    // be a different contract from the documented one.
    const mixed = createForm({
      exempt: field("", [], { sanitize: "off" }),
      inherits: field(""),
    }, options);
    mixed.f.exempt.set(evil);
    mixed.f.inherits.set(evil);
    ctx.log.note("the resolution order", { exempt: mixed.getValue().exempt, inherits: mixed.getValue().inherits });

    expectEqual(mixed.getValue().exempt, evil, {
      claimIds: ["SEC-003"],
      what: "a field asking for no sanitizer was sanitized anyway",
    });

    expectEqual(mixed.getValue().inherits, clean, {
      claimIds: ["SEC-003"],
      what: "a field asking for nothing did not take the form's profile",
    });
    mixed.destroy();
  },
);
