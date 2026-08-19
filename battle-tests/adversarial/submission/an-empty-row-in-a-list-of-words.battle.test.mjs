/**
 * What holds the place of a row that sends nothing, when the row is not a row.
 *
 * A positional collection keeps its positions: a group row whose every cell is disabled is sent as
 * `{}` at the index it occupies, so nothing after it moves. The placeholder is the same object
 * whatever the collection holds — and a positional collection may hold leaves:
 *
 *     array(field(""))   ["a", "b", "c"]   with the middle disabled   ["a", {}, "c"]
 *     array(field(0))    [1, 2, 3]         with the middle disabled   [1, {}, 3]
 *     array(array(...))  [["a","b"],["c"]] with the inner two out     [[{},{}],["c"]]
 *
 * The **element type changes**. A list declared as strings is submitted holding an object, and a
 * receiver validating `array of string` refuses the whole payload — where before it was handed a
 * shorter list of strings, which was wrong about position but right about type. A declaration cannot
 * produce `{}` at a leaf by any other route, so nothing downstream has a reason to expect it.
 *
 * There is no empty row for a leaf: a leaf that sends nothing has no members to send none of. What
 * holds its place has to be a value of the leaf's own kind or an agreed absence — `{}` is neither.
 *
 * Green when a positional collection of leaves is submitted holding leaves, at the positions its
 * rows hold. Two answers close it: a placeholder that is not an object, or a leaf collection that
 * compacts and says so.
 */

import { array, createForm, field, group } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

async function submittedWith(make, disable) {
  const form = make();
  await settled();
  for (const path of disable) form.setDisabled(path, () => true);
  await settled();
  const payload = form.submitValue();
  form.destroy();
  return payload;
}

const words = () => createForm(
  { tags: array(field("t"), { initial: ["a", "b", "c"] }) },
  { devWarnings: false },
);
const numbers = () => createForm(
  { n: array(field(0), { initial: [1, 2, 3] }) },
  { devWarnings: false },
);
const rows = () => createForm(
  { list: array(group({ tag: field("t") }), { initial: [{ tag: "first" }, { tag: "second" }] }) },
  { devWarnings: false },
);

battle(
  {
    claims: ["SUB-002", "COL-001", "VAL-002"],
    title: "a list of leaves is submitted holding leaves",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: with nothing disabled a list of words is a list of words, so what follows is the
    // disabling rather than a collection that never held leaves properly.
    expectEqual(await submittedWith(words, []), { tags: ["a", "b", "c"] }, {
      claimIds: ["SUB-002"],
      what: "a positional collection of leaves did not submit the leaves it holds",
    });

    // And the group case, which is the shape the position rule was written for and is not in
    // question here — it is the control that says the placeholder itself is right where it belongs.
    expectEqual(await submittedWith(rows, ["list.0.tag"]), { list: [{}, { tag: "second" }] }, {
      claimIds: ["SUB-002"],
      what: "a group row that sends nothing did not hold its position as an empty row",
    });

    const middleOut = await submittedWith(words, ["tags.1"]);
    ctx.log.note("a list of words with the middle one out of play", middleOut);
    const numbersOut = await submittedWith(numbers, ["n.1"]);
    ctx.log.note("a list of numbers with the middle one out of play", numbersOut);

    const held = [...middleOut.tags, ...numbersOut.n];
    const objects = held.filter((each) => typeof each === "object" && each !== null);
    expectClaim(objects.length === 0, {
      claimIds: ["SUB-002", "COL-001"],
      what: "a positional collection of leaves was submitted holding an object where a leaf goes",
      detail: `${JSON.stringify(middleOut)} and ${JSON.stringify(numbersOut)}`,
    });

    // Every leaf out of play is the same defect with nothing left to hide it: a list declared as
    // three words is submitted as three objects.
    const allOut = await submittedWith(words, ["tags.0", "tags.1", "tags.2"]);
    expectClaim(allOut.tags.every((each) => typeof each !== "object" || each === null), {
      claimIds: ["SUB-002"],
      what: "a list whose every leaf is out of play was submitted as a list of objects",
      detail: JSON.stringify(allOut),
    });
  },
);
