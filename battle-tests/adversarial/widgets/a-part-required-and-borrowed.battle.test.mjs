/**
 * Two published statements about whether a part must exist, disagreeing.
 *
 * A kind contract splits its anatomy in two. `parts` says what a part is made of; `structure` says
 * where it sits and whether it has to be there, and all 249 nodes across the 17 kinds declare
 * `optional`. Beside them, `overlayOnlyParts` names the parts that exist only while an overlay is
 * open — the vocabulary for "sometimes", kept in a function rather than on the node.
 *
 * For six parts the two answer differently: `optional: false`, and overlay-only. Every kind that has
 * an overlay has exactly one.
 *
 * These are the two exports an adapter author reads to decide what to build eagerly, and there is no
 * reading that satisfies both — build the listbox into a closed select and the contract's own
 * `overlayOnlyParts` says it should not be there; build nothing and a part marked required is
 * missing. The two shipped renderers already differ on precisely this, one building popup contents
 * while closed and the other on open.
 *
 * `optional: false` may well mean "required within its parent", which is coherent. Nothing published
 * says so, and `select.listbox`'s parent is `popup`, which is itself optional — a required child of
 * an optional parent is a sentence this contract has no grammar for.
 *
 * No renderer is involved. Both facts come from one package in one process.
 */

import { MDY_WIDGET_CONTRACTS, overlayOnlyParts, staticParts } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["UI-009"],
    title: "a part the contract requires is not one it only lends while an overlay is open",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the two exports are about the same vocabulary, and each answers for parts the
    // other knows. Without this, an empty disagreement below would mean they never overlap at all.
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

    const disagreeing = [];
    for (const [kind, contract] of Object.entries(MDY_WIDGET_CONTRACTS)) {
      const borrowed = new Set(overlayOnlyParts(kind));
      for (const node of contract.structure.nodes) {
        if (node.optional === false && borrowed.has(node.part)) {
          disagreeing.push(`${kind}.${node.part}`);
        }
      }
    }
    ctx.log.note("parts declared required and only present while open", { disagreeing });

    expectEqual(disagreeing, [], {
      claimIds: ["UI-009"],
      what: "the contract requires parts it also says exist only while an overlay is open",
      detail: () => disagreeing.join(", "),
    });
  },
);
