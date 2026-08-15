/**
 * The one kind whose whole meaning is what the control does, said nowhere a control is described.
 *
 * `password` is a kind of its own in every table that enumerates kinds, and a document may name it:
 * the Dynamic Form Contract carries `kind` as data from outside the application. The one thing that
 * makes it a password rather than a short piece of text is that the control does not show what is
 * typed into it — there is no other difference, no separate value shape, no rule only it carries.
 *
 * `@modyra/widgets` is the framework-agnostic UI contract each adapter implements. Normalise the
 * kind's own name out of it and the published description of `password` is the published
 * description of `text`, in the contract, the keyboard map, the relations, the transitions and the
 * state expression alike — and `MDY_VALUE_CONTRACTS` agrees with all five. The tables are able to
 * hold a per-kind fact; `select` differs from `text` in exactly the same comparison. For this kind
 * they hold none.
 *
 * The consequence is not hypothetical and does not need a bug to reach a user: an adapter reading
 * the published surface has no statement to implement, so masking is knowledge each one carries
 * privately, and the failure mode of not carrying it is a password rendered in clear text. Where a
 * control's native type appears at all it is an option a caller supplies, defaulted to plain text.
 *
 * This battle is red. It becomes green when the published surface distinguishes the two — a
 * declared control type, a `secret` flag on the contract, any statement an adapter can read.
 */

import { MDY_VALUE_CONTRACTS, MDY_FIELD_KINDS, MDY_DYNAMIC_FIELD_KINDS } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/**
 * A kind's published description with its own name taken out.
 *
 * Every table keys by kind and repeats the kind inside what it holds, so two descriptions always
 * differ by that name alone. What is being compared is everything else.
 *
 * Only a value held under a `kind` key is the name being removed. Rewriting the string wherever it
 * appears would also rewrite a part whose element is a text node, which makes one kind look
 * distinguished by a property both of them carry.
 */
function withoutKindName(described) {
  const anonymise = (node) => {
    if (Array.isArray(node)) return node.map(anonymise);
    if (node === null || typeof node !== "object") return node;
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, key === "kind" ? "KIND" : anonymise(value)]),
    );
  };
  return JSON.stringify(anonymise(described ?? null));
}

/** The published tables that say something per kind, taken from the modules rather than listed. */
async function publishedTables() {
  const [core, widgets] = await Promise.all([import("@modyra/core"), import("@modyra/widgets")]);
  return Object.entries({ ...core, ...widgets })
    .filter(([name, table]) =>
      name.startsWith("MDY_") &&
      table !== null &&
      typeof table === "object" &&
      !Array.isArray(table) &&
      table.password !== undefined &&
      table.text !== undefined)
    .map(([name, table]) => ({ name, table }));
}

battle(
  {
    claims: ["SEC-005"],
    title: "a password is a kind of its own everywhere a kind can be named",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise the finding rests on: this is a declared kind, not something a document invented.
    // If it stopped being one, the battle below would be asking for a distinction nobody promised.
    for (const [name, kinds] of [
      ["MDY_FIELD_KINDS", MDY_FIELD_KINDS],
      ["MDY_DYNAMIC_FIELD_KINDS", MDY_DYNAMIC_FIELD_KINDS],
      ["MDY_WIDGET_KINDS", MDY_WIDGET_KINDS],
    ]) {
      expectClaim(kinds.includes("password") && kinds.includes("text"), {
        claimIds: ["SEC-005"],
        what: `${name} does not name both kinds, so the comparison below has no subject`,
        detail: JSON.stringify(kinds),
      });
    }

    // And the tables are able to tell two kinds apart. A select and a text field differ under
    // exactly the comparison used below, so an identical answer there is the absence of a fact
    // rather than a comparison that always agrees.
    const select = withoutKindName(MDY_WIDGET_CONTRACTS.select);
    const text = withoutKindName(MDY_WIDGET_CONTRACTS.text);
    ctx.log.note("a kind the contract does distinguish", { differs: select !== text });

    expectClaim(select !== text, {
      claimIds: ["SEC-005"],
      what: "the contract describes a select and a text field identically, so it distinguishes no kind at all",
    });
  },
);

battle(
  {
    claims: ["SEC-005"],
    title: "the published surface says a password is not a text field",
    environments: ["node"],
  },
  async (ctx) => {
    const tables = await publishedTables();
    ctx.log.note("published tables holding a fact for both kinds", { names: tables.map((each) => each.name) });

    // The tables have to be found for their silence to mean anything.
    expectClaim(tables.length > 0, {
      claimIds: ["SEC-005"],
      what: "no published table holds a fact for either kind, so nothing was examined",
    });

    const silent = tables
      .filter(({ table }) =>
        withoutKindName(table.password) === withoutKindName(table.text))
      .map(({ name }) => name);

    ctx.log.note("tables describing the two kinds identically", { silent });

    // A value contract is where a kind says what it holds, and both hold the same live string —
    // correctly, since a password is a string. It is named here so the distinction being asked for
    // is not mistaken for a difference in the value.
    expectEqual(MDY_VALUE_CONTRACTS.password, MDY_VALUE_CONTRACTS.text, {
      claimIds: ["SEC-005"],
      what: "the two kinds no longer hold the same shape, so this battle is comparing something else",
    });

    expectEqual(silent, [], {
      claimIds: ["SEC-005"],
      what: "every published description of a password is the published description of a text field, so an adapter has no statement to implement and masking is private knowledge",
      detail: JSON.stringify({ silent, examined: tables.map((each) => each.name) }),
    });
  },
);
