/**
 * What "required" means on a part, and the grammar that makes two statements agree.
 *
 * A kind splits its anatomy in two. `parts` says what a part is made of; `structure` says where it
 * sits and whether it has to be there, and all 249 nodes declare `optional`. Beside them,
 * `overlayOnlyParts` names the parts that exist only while an overlay is open.
 *
 * Six parts are in both — `optional: false` and overlay-only, one in every kind that has an overlay.
 * Read as "always present" the two contradict each other, and an adapter author trusting one builds a
 * listbox inside a closed select while one trusting the other leaves a part marked required missing.
 *
 * They do not contradict, and the reading that makes both true is now stated on the node itself:
 * required means required **while its parent is on the page**, not for the widget's lifetime. Every
 * one of the six sits inside a `popup` that is itself optional, so a closed widget owes nothing and
 * an open one owes all of it. A lazy overlay and an eager one are both conformant.
 *
 * That is a grammar rather than a coincidence, and this battle holds it: a part may be required and
 * overlay-only only if something above it may be absent. A required overlay-only part with no
 * optional ancestor would be the contradiction the prose says does not exist — always present, and
 * present only while open.
 *
 * The whole check reads one package in one process; no renderer is involved.
 */

import { MDY_WIDGET_CONTRACTS, overlayOnlyParts, staticParts } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Walk a part's ancestors through the structure, so an optional grandparent counts too. */
function ancestorsOf(nodes, part) {
  const byPart = new Map(nodes.map((node) => [node.part, node]));
  const chain = [];
  let current = byPart.get(part)?.parent;
  while (current !== undefined && current !== null && !chain.some((each) => each.part === current)) {
    const node = byPart.get(current);
    if (node === undefined) break;
    chain.push(node);
    current = node.parent;
  }
  return chain;
}

battle(
  {
    claims: ["UI-009"],
    title: "a part that is required and only present while open sits inside something that may be absent",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the two exports partition the same vocabulary, so neither is answering about a
    // different set of parts than the other.
    const selectParts = Object.keys(MDY_WIDGET_CONTRACTS.select.parts);
    expectEqual(
      [...staticParts("select"), ...overlayOnlyParts("select")].sort(),
      [...selectParts].sort(),
      {
        claimIds: ["UI-009"],
        what: "the two part lists do not partition the kind's parts, so neither is about all of them",
      },
    );

    // And optionality is declared on every node, so `optional: false` is a statement rather than a
    // field that happens to be missing.
    const nodes = Object.values(MDY_WIDGET_CONTRACTS).flatMap((kind) => kind.structure.nodes);
    expectEqual(nodes.filter((node) => "optional" in node).length, nodes.length, {
      claimIds: ["UI-009"],
      what: "a structure node stopped declaring optionality, so `optional: false` no longer means required",
    });

    const both = [];
    const ungrounded = [];
    for (const [kind, contract] of Object.entries(MDY_WIDGET_CONTRACTS)) {
      const borrowed = new Set(overlayOnlyParts(kind));
      for (const node of contract.structure.nodes) {
        if (node.optional !== false || !borrowed.has(node.part)) continue;
        both.push(`${kind}.${node.part}`);
        const relieved = ancestorsOf(contract.structure.nodes, node.part).some((each) => each.optional === true);
        if (!relieved) ungrounded.push(`${kind}.${node.part}`);
      }
    }
    ctx.log.note("parts that are required and only present while open", { both, ungrounded });

    // The second control: the case exists. An empty `both` would make the assertion below true by
    // saying nothing, and the grammar would go unexercised the moment the six were rewritten away.
    expectClaim(both.length > 0, {
      claimIds: ["UI-009"],
      what: "no part is both required and overlay-only, so the grammar below is not being exercised",
      detail: () => JSON.stringify(both),
    });

    expectEqual(ungrounded, [], {
      claimIds: ["UI-009"],
      what: "a part is required and present only while open, with nothing above it that may be absent",
      detail: () => ungrounded.join(", "),
    });
  },
);
