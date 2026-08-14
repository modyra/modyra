/**
 * What a form value becomes on its way to storage.
 *
 * `mdyFormSerialize` is the published subpath a draft is written through and a devtools panel reads
 * through, and it exists for one reason its own docblock gives: a native file has no enumerable own
 * properties, so it stringifies to `{}` — an empty object where the user picked a document.
 *
 * Two promises follow from that and neither had been attacked from outside. A file is *described*,
 * which means its bytes never reach whatever the value is written to — a draft in `localStorage`
 * that every script on the origin can read, or a panel on a screen someone else is looking at. And
 * a value that already answers `toJSON` keeps its own answer, because rebuilding such an object
 * property by property would lose what plain `JSON.stringify` already kept.
 *
 * The shapes attacked are the ones a field may actually hold. `MDY_VALUE_CONTRACTS` names them —
 * string, number, boolean, option, option[], dateRange, file[] — and nothing else is in scope: a
 * `Map` or a `Blob` serialising to `{}` is not a defect against a contract that never admits one.
 */

import { MDY_VALUE_CONTRACTS } from "@modyra/core";
import { mdyFormSerialize } from "@modyra/core/serialize";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const through = (value) => JSON.parse(JSON.stringify(mdyFormSerialize(value)));

battle(
  {
    claims: ["PER-001", "SEC-001"],
    title: "a file is described on its way to storage and never carried into it",
    environments: ["node"],
  },
  async (ctx) => {
    const secret = "the contents of a document the user picked";
    const value = {
      name: "typed",
      docs: [new File([secret], "cv.pdf", { type: "application/pdf" })],
      rows: { a: { code: "A", files: [new File([secret], "inside-a-row.txt")] } },
    };

    const written = through(value);
    const asText = JSON.stringify(written);
    ctx.log.note("a form value holding files at two depths", {});

    // The control: the files were really there, so what follows is about describing them rather
    // than about a value that never held one.
    expectClaim(value.docs[0] instanceof File && value.rows.a.files[0] instanceof File, {
      claimIds: ["PER-001"],
      what: "the value under test does not hold the files it was built with",
    });

    // Neither file's bytes reach what is written, at either depth. A draft lives where every script
    // on the origin can read it, so this is the difference between a name and a document.
    expectClaim(!asText.includes(secret), {
      claimIds: ["SEC-001"],
      what: "a file's contents were carried into what a draft would store",
      detail: asText.slice(0, 120),
    });

    // And it is described rather than emptied: `{}` where a document was is the failure this module
    // exists to prevent, and it is indistinguishable from a field nobody filled.
    expectClaim(typeof written.docs[0] === "string" && written.docs[0].includes("cv.pdf"), {
      claimIds: ["PER-001"],
      what: "a file became something that does not say a file was there",
      detail: JSON.stringify(written.docs[0]),
    });

    expectClaim(typeof written.rows.a.files[0] === "string" && written.rows.a.files[0].includes("inside-a-row.txt"), {
      claimIds: ["PER-001"],
      what: "a file inside a collection row was not described the way one at the top was",
      detail: JSON.stringify(written.rows.a.files[0]),
    });
  },
);

battle(
  {
    claims: ["PER-001"],
    title: "every shape a field may hold survives being written down",
    environments: ["node"],
  },
  async (ctx) => {
    // Driven from the contract rather than from a list written here: a kind added to
    // MDY_VALUE_CONTRACTS with a shape this cannot carry should fail this battle, not slip past it.
    const shapes = new Set(Object.values(MDY_VALUE_CONTRACTS).map((contract) => contract.shape));
    ctx.log.note("the value shapes a field may hold", { shapes: [...shapes] });

    const sample = {
      string: "text",
      number: 3,
      boolean: true,
      option: "chosen",
      "option[]": ["a", "b"],
      dateRange: { start: "2026-01-01", end: "2026-02-01" },
      "file[]": [new File(["x"], "a.pdf")],
    };

    expectClaim([...shapes].every((shape) => shape in sample), {
      claimIds: ["PER-001"],
      what: "a value shape the contract declares has no sample here to write down",
      detail: JSON.stringify([...shapes].filter((shape) => !(shape in sample))),
    });

    for (const shape of shapes) {
      const written = through({ v: sample[shape] });
      // A file is the one shape that is deliberately not itself afterwards; everything else has to
      // come back as what it went in as, because a draft restores it into the same field.
      if (shape === "file[]") {
        expectClaim(Array.isArray(written.v) && typeof written.v[0] === "string", {
          claimIds: ["PER-001"],
          what: "a file[] did not come back as descriptions",
          detail: JSON.stringify(written.v),
        });
        continue;
      }
      expectEqual(written.v, sample[shape], {
        claimIds: ["PER-001"],
        what: `a ${shape} did not survive being written down`,
      });
    }
  },
);

battle(
  {
    claims: ["PER-001"],
    title: "a value that refers to itself is reported rather than walked",
    environments: ["node"],
  },
  async (ctx) => {
    const direct = { code: "A" };
    direct.self = direct;

    const indirect = { row: {} };
    indirect.row.back = indirect;

    ctx.log.note("values that refer back to themselves", {});

    // A form value is a tree, so a cycle is a mistake to report — and reporting it must not mean
    // exhausting the stack, which is the other way a serializer meets one.
    for (const [label, value] of [["direct", direct], ["indirect", indirect]]) {
      let written = null;
      let raised = null;
      try {
        written = JSON.stringify(mdyFormSerialize(value));
      } catch (error) {
        raised = `${error.constructor.name}: ${error.message}`;
      }

      expectClaim(raised === null && written !== null, {
        claimIds: ["PER-001"],
        what: `a ${label} cycle was walked instead of described`,
        detail: raised ?? "",
      });

      expectClaim(written.includes("[Circular]"), {
        claimIds: ["PER-001"],
        what: `a ${label} cycle was written down as something other than a cycle`,
        detail: written.slice(0, 120),
      });
    }

    // The same object twice is not a cycle, and describing it as one would lose a value a form can
    // legitimately hold — two rows referring to one option object.
    const shared = { label: "shared" };
    const twice = JSON.stringify(mdyFormSerialize({ left: shared, right: shared }));

    expectClaim(!twice.includes("[Circular]"), {
      claimIds: ["PER-001"],
      what: "the same object in two places was mistaken for a cycle",
      detail: twice,
    });
  },
);
