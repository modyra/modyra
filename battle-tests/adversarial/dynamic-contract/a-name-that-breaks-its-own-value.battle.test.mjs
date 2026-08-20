/**
 * A field name a document may declare, and the value object it makes unusable.
 *
 * `MDY_FORBIDDEN_DYNAMIC_NAMES` is `__proto__`, `prototype`, `constructor` — the three that reach the
 * prototype chain. Every other inherited name is allowed, and mostly that is right: `name`, `length`,
 * `then`, `valueOf` are ordinary words, and a form's value holding one of them as an own property
 * shadows a method nobody calls on a plain data object.
 *
 * `toString` is not like the others. It is the method the **language** calls, and shadowing it with a
 * string makes the value object refuse to become a primitive:
 *
 *     toString        `${form.getValue()}`  TypeError: Cannot convert object to primitive value
 *     valueOf         `${…}`  [object Object]     JSON fine
 *     hasOwnProperty  `${…}`  [object Object]     JSON fine
 *     then            `${…}`  [object Object]     JSON fine
 *     length          `${…}`  [object Object]     JSON fine
 *     constructor     refused at parse
 *
 * Nothing is polluted and nothing is lost: `JSON.stringify` works, the payload is right, the field
 * holds what it was given. What breaks is every ordinary thing a consumer does with a value they were
 * handed — a template in a log line, a `String(value)` in telemetry, an error message that quotes what
 * was submitted. Those crash, in code that has nothing to do with forms, on a document a CMS produced.
 *
 * `valueOf` is the near miss that shows this is about one name rather than about inherited names: it
 * is also consulted by the language, and shadowing it is harmless, because conversion falls through to
 * `toString`. There is no fallback the other way.
 *
 * Green when a document cannot declare a field whose name makes the form's own value throw. One more
 * name on the list is the cheap answer; the other is to hand back a null-prototype object, which is a
 * larger change and would also make `hasOwnProperty` on it stop working for consumers who call it.
 */

import { buildFlatFormSchema, createForm, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 40));

/** Inherited names a document might plausibly use for a field. */
const INHERITED = Object.freeze([
  "toString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable",
  "then", "length", "name", "caller", "arguments",
]);

/** Builds a two-field document, returns the value it holds — or how the parser refused it. */
async function valueWithFieldNamed(name) {
  const parsed = parseDynamicForm(
    { version: 2, fields: [{ name, kind: "text", label: "L" }, { name: "ok", kind: "text", label: "Ok" }], layout: [] },
    { mode: "lenient" },
  );
  if (parsed.acceptedCount < 2) return { refused: true };
  const form = createForm(buildFlatFormSchema(parsed.fields, parsed.collections), { devWarnings: false });
  await settled();
  form.setValue({ [name]: "shadow", ok: "fine" });
  await settled();
  const value = form.getValue();
  form.destroy();
  return { value };
}

battle(
  {
    claims: ["SEC-001", "DYN-001"],
    title: "a name a document declares does not break the value it produces",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the guard that exists still holds. A run where `constructor` had become allowed
    // would be a different and larger finding, and this battle must not read as that one.
    const prototypeKey = await valueWithFieldNamed("constructor");
    expectClaim(prototypeKey.refused === true, {
      claimIds: ["SEC-001"],
      what: "a prototype key is no longer refused as a field name",
      detail: JSON.stringify(prototypeKey).slice(0, 120),
    });

    const broken = [];
    let checked = 0;

    for (const name of INHERITED) {
      const seen = await valueWithFieldNamed(name);
      if (seen.refused) continue;
      checked += 1;

      let converts = "ok";
      try { `${seen.value}`; } catch (error) { converts = String(error.message).slice(0, 60); }
      let serialises = "ok";
      try { JSON.stringify(seen.value); } catch (error) { serialises = String(error.message).slice(0, 60); }
      ctx.log.note("a field named after an inherited member", { name, converts, serialises });

      if (converts !== "ok" || serialises !== "ok") {
        broken.push(`${name}: template ${converts}, JSON ${serialises}`);
      }
    }

    // The second control: most of these names were accepted, so the assertion is about the one that
    // breaks rather than about a parser that refuses them all.
    expectClaim(checked >= 6, {
      claimIds: ["DYN-001"],
      what: "almost every inherited name was refused, so nothing here is about the value they produce",
      detail: `${checked} accepted of ${INHERITED.length}`,
    });

    expectEqual(broken, [], {
      claimIds: ["SEC-001", "DYN-001"],
      what: "a document declared a field whose name makes the form's own value throw on an ordinary operation",
    });
  },
);
