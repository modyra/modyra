/**
 * A path that came back from a server, attached to an error.
 *
 * `hostile-paths` attacks the four doors data arrives through. There is a fifth, and it is the one
 * an application uses on every submit: a server rejects a payload, the response names the fields it
 * rejected, and a form-level validator turns those names into errors. `@modyra/zod`'s
 * `serverValidate` does exactly that — `issue.path.join(".")` — so the path a form is asked to
 * attribute an error to is built from keys the server chose.
 *
 * A keyed collection's keys are data, so those keys can be anything a row's key can be, which
 * includes spellings that mean something to JavaScript and spellings that mean something to the path
 * grammar itself. `"a.b"` as a row key produces `rows.a.b.code`, which reads exactly like a row `a`
 * with a nested `b`; an empty key produces `rows..code`, which reads like nothing at all.
 *
 * What must hold is what holds at every other door: the path registers no field, pollutes no
 * prototype, and the verdict it carries is still readable — because an error a consumer cannot read
 * is a form that will not submit and cannot say why.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

/**
 * Paths a server can produce, by spelling and by grammar.
 *
 * The first four mean something to JavaScript. The rest are what `issue.path.join(".")` builds from
 * a row key that contains the separator, is empty, or is itself unsafe — measured against
 * `serverValidate`, not invented.
 */
const FROM_A_SERVER = Object.freeze([
  "__proto__",
  "constructor",
  "prototype",
  "x.__proto__.y",
  "rows.__proto__.code",
  "rows.a.b.code",
  "rows..code",
  "",
]);

/** Every public place a verdict could be read from. */
function readable(form, path) {
  return [...form.errorsFor(path)(), ...form.errorsFor("")(), ...form.buildSubmitEvent().errors];
}

battle(
  {
    claims: ["SEC-001", "VAL-003", "COL-001"],
    title: "an error path chosen by a server registers nothing and is still readable",
    environments: ["node"],
  },
  async (ctx) => {
    // A witness on the prototype: if any path reached it, a plain object gains a cell name.
    const witness = () => ({}).code !== undefined || ({}).rows !== undefined;

    expectClaim(!witness(), {
      claimIds: ["SEC-001"],
      what: "the prototype was already polluted before the attack began",
    });

    for (const path of FROM_A_SERVER) {
      const form = createForm({ rows: record(group({ code: field("") })) }, {
        validators: [() => [{ path, kind: "schema", message: "the server rejected this" }]],
        devWarnings: false,
      });

      try {
        form.f.rows.upsert("a", { code: "A" });
        ctx.log.note("a server error naming a path", { path });

        const names = form.fieldNames();
        expectClaim(names.length === 2 && names.includes("rows") && names.includes("rows.a.code"), {
          claimIds: ["SEC-001", "COL-001"],
          what: `a server error naming ${JSON.stringify(path)} registered a field`,
          detail: JSON.stringify(names),
        });

        expectClaim(!witness(), {
          claimIds: ["SEC-001"],
          what: `a server error naming ${JSON.stringify(path)} reached a prototype`,
        });

        // The rule still counts — it came from the server and the form may not submit — and the
        // consumer can find out why. Silently dropping an unattributable error would leave a form
        // that refuses without explanation; silently ignoring it would submit a rejected payload.
        expectClaim(!form.state.valid(), {
          claimIds: ["VAL-003"],
          what: `a server error naming ${JSON.stringify(path)} stopped counting towards the verdict`,
        });

        expectClaim(readable(form, path).length > 0, {
          claimIds: ["VAL-003", "SEC-001"],
          what: `a server error naming ${JSON.stringify(path)} cannot be read anywhere`,
          detail: JSON.stringify(readable(form, path)),
        });
      } finally {
        form.destroy();
      }
    }
  },
);
