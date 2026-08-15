/**
 * A list of choices, printed the way JavaScript prints an object.
 *
 * `oneOf` refuses a value that is not among the offered ones and names the list in its message, which
 * is the right thing to say: a person told their answer is not on a list needs to see the list.
 *
 * An option is not always a string. A domain writes `{ id, label }` and the value contracts allow it —
 * anything non-nullish satisfies the shape, and `oneOf` is named there as what decides membership.
 * A form built that way, refusing a value, tells the person:
 *
 *     Value must be one of: [object Object], [object Object]
 *
 * The same list as primitives says `one, two`, which is the control: the sentence works, and what
 * fails is the option that is not a string.
 *
 * There is a way out and it is worth naming, because it bounds the finding rather than excusing it:
 * `oneOf(options, message)` takes the sentence a consumer wants. What is asserted here is the default
 * — what ships, and what somebody gets before they know there is a second argument. And the widgets
 * contract already declares where a readable name lives: `MdyControlOption` carries `label` beside
 * `value`.
 */

import { createForm, field, oneOf } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 40));

/** Options a domain would write: an id to hold and something to show for it. */
const OPTIONS = Object.freeze([
  Object.freeze({ id: 1, label: "One" }),
  Object.freeze({ id: 2, label: "Two" }),
]);

/** The messages a field carries after being given a value the list does not offer. */
async function refusalFor(validators, rejected) {
  const form = createForm({ choice: field(null, validators) }, { devWarnings: false });
  form.f.choice.set(rejected);
  await settled();
  const messages = form.errorsFor("choice")().map((each) => each.message);
  form.destroy();
  return messages;
}

battle(
  {
    claims: ["UI-004", "LOC-002"],
    title: "a refusal that names the offered choices names them readably",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: with primitive options the sentence does its job, so what follows is the option
    // rather than the message being empty or absent.
    const primitives = await refusalFor([oneOf(["one", "two"])], "three");
    ctx.log.note("a refusal with primitive options", { primitives });

    expectClaim(primitives.some((message) => message.includes("one") && message.includes("two")), {
      claimIds: ["UI-004"],
      what: "a refusal with primitive options did not name them, so the message never names a list",
      detail: JSON.stringify(primitives),
    });

    // The second control: an object option is a legitimate one. The guard accepts the list and
    // refuses a value that is not in it, which is what makes the message below reachable at all.
    const objects = await refusalFor([oneOf(OPTIONS)], { id: 3, label: "Three" });
    ctx.log.note("a refusal with object options", { objects });

    expectClaim(objects.length > 0, {
      claimIds: ["UI-004"],
      what: "an object option list did not refuse a value that was never offered",
    });

    // And the sentence a person reads.
    expectClaim(!objects.some((message) => message.includes("[object Object]")), {
      claimIds: ["UI-004", "LOC-002"],
      what: "a refusal showed the offered choices as [object Object]",
      detail: JSON.stringify(objects),
    });

    // The bound on the finding: a consumer who knows can pass their own sentence, and it is used.
    // A repair must not take that away.
    const custom = await refusalFor([oneOf(OPTIONS, "Pick one of the plans above")], { id: 3 });
    expectClaim(custom.includes("Pick one of the plans above"), {
      claimIds: ["UI-004"],
      what: "a message the caller supplied was not the one shown",
      detail: JSON.stringify(custom),
    });
  },
);
