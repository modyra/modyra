/**
 * The two things the panel cannot describe, and the one it raises on.
 *
 * `DEV-001` is that the panel **describes** a value it cannot serialize rather than raising on it,
 * and the reason is in `mdyFormSnapshot`'s own comment: a panel is what a developer opens when
 * something is already wrong, so reading a form's value must never be the thing that fails.
 *
 * It holds for almost everything a form value can be. Swept:
 *
 *     a BigInt                            "[BigInt: 10]"
 *     a cycle                             { name: "loop", self: "[Circular]" }
 *     a getter that throws                { boom: "[Unreadable: boom]" }
 *     a Proxy that throws on every trap   "[Unreadable: toJSON]"
 *     a Date                              "2026-08-20T00:00:00.000Z"
 *     a class instance                    { x: 1 }
 *     a null-prototype object             { a: 1 }
 *     NaN, Infinity, -0                   { a: null, b: null, c: 0 }
 *
 * Two answers are wrong rather than absent, and they are the defect the panel already fixed once. Its
 * own comment about `File` says it: *"a `File` carries no `toJSON`, so a snapshot that passed it
 * through read as `{}` — the same as a field nobody filled"*. A `Map`, a `Set` and an `Error` still
 * do exactly that:
 *
 *     new Map([["a", 1]])   {}
 *     new Set([1, 2])       {}
 *     new Error("boom")     {}
 *
 * A developer reading the panel to find out why a form is wrong is shown, for a Map holding entries,
 * the same thing they are shown for a field nobody filled.
 *
 * And one raises. An object nested deeply enough overflows the stack while being described:
 *
 *     depth  4000   described
 *     depth  8000   RangeError: Maximum call stack size exceeded
 *
 * A depth cap is what every other walk in this library has — a path is capped at 512 characters, an
 * expression at 32 levels, a declaration walk at 100 000 — and the one walk with no cap is the one
 * whose whole promise is that it never fails.
 *
 * Green when the panel answers for all three: a Map and a Set described as what they are, and a value
 * of any depth described rather than raised on.
 */

import { createForm, field } from "@modyra/core";
import { mdyFormSnapshot } from "@modyra/core/devtools";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 30));

/** A chain `depth` links long: `{ next: { next: … } }`. */
function nestedTo(depth) {
  const root = {};
  let at = root;
  for (let index = 0; index < depth; index += 1) {
    at.next = {};
    at = at.next;
  }
  return root;
}

/** What the panel prints for one value, or how it failed to. */
async function described(value) {
  const form = createForm({ v: field(null) }, { devWarnings: false });
  await settled();
  try {
    form.setValue({ v: value });
    await settled();
    const row = mdyFormSnapshot(form).fields.find((each) => each.path === "v");
    return { printed: row?.value };
  } catch (error) {
    return { raised: String(error && error.message).slice(0, 80) };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["DEV-001"],
    title: "the panel describes what it cannot serialize, at any depth",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the descriptions that do work, so a repair that stopped describing anything fails
    // here rather than passing the assertions below by emptying them.
    const bigint = await described(10n);
    const cycle = await described((() => { const o = { name: "loop" }; o.self = o; return o; })());
    ctx.log.note("the descriptions that already work", { bigint, cycle });
    expectEqual([bigint.printed, cycle.printed?.self], ["[BigInt: 10]", "[Circular]"], {
      claimIds: ["DEV-001"],
      what: "the panel stopped describing a BigInt or a cycle, so its descriptions are not being measured",
    });

    // A value of any depth. The cap, wherever it is put, has to be below what overflows the stack.
    const deep = await described(nestedTo(8000));
    ctx.log.note("a value nested eight thousand deep", deep);
    expectClaim(deep.raised === undefined, {
      claimIds: ["DEV-001"],
      what: "the panel raised on a deeply nested value instead of describing it",
      detail: JSON.stringify(deep),
    });

    // And the two that are described as something else entirely.
    const indistinguishable = [];
    for (const [what, value] of [
      ["a Map holding entries", new Map([["a", 1]])],
      ["a Set holding members", new Set([1, 2])],
      ["an Error", new Error("boom")],
    ]) {
      const seen = await described(value);
      ctx.log.note("a value with no own enumerable properties", { what, seen });
      if (JSON.stringify(seen.printed) === "{}") indistinguishable.push(`${what} printed as {}`);
    }

    expectEqual(indistinguishable, [], {
      claimIds: ["DEV-001"],
      what: "the panel printed a value as an empty object, which is what it prints for a field nobody filled",
    });
  },
);
