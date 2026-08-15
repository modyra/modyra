/**
 * Four ways to misspell a sanitiser, and one answer to all of them.
 *
 * The sanitiser is an option: `{ security: { sanitize: "strict" } }`. Its profile is a closed set —
 * `"off" | "text" | "strict"` — or a function a consumer supplies. Off is the default, deliberately,
 * because a form library that rewrote values by default would be worse than one that does not.
 *
 * That default is what makes every way of getting the option wrong indistinguishable from asking for
 * nothing. Four spellings a consumer plausibly writes, all with `devWarnings: true`:
 *
 *     { security: "strict" }                the option one level too high
 *     { sanitize: "strict" }                the option one level too high the other way
 *     { security: { sanitise: "strict" } }  the en-GB spelling
 *     { security: { sanitize: "stict" } }   a typo in the value
 *
 * Every one leaves markup in the value and says nothing. A consumer who wrote any of them believes
 * the form sanitises. The last is the sharpest: the key was read, and its value is outside a closed
 * vocabulary, and the answer is the **least protective member of that vocabulary** rather than "there
 * is no sanitiser by that name".
 *
 * The correct spelling is the control, and the default is asserted alongside it — so a repair cannot
 * be "sanitise by default", which would be a different and larger change than this asks for.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

/** Markup that is inert once its angle brackets are gone, which is what sanitising means here. */
const MARKUP = '<img src=x onerror="alert(1)">';

/** Write markup into a form built with `options`, and report what it holds and what was said. */
async function writtenUnder(options) {
  const said = [];
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...parts) => said.push(parts.join(" "));
  console.error = (...parts) => said.push(parts.join(" "));

  let held;
  try {
    const form = createForm({ a: field("") }, { devWarnings: true, ...options });
    form.f.a.set(MARKUP);
    await settled();
    held = form.getValue().a;
    form.destroy();
  } finally {
    console.warn = realWarn;
    console.error = realError;
  }

  return { held, said, inert: !/[<>]/.test(String(held)) };
}

battle(
  {
    claims: ["API-001"],
    title: "a sanitiser a consumer asked for badly is not silently the one that does nothing",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: spelled correctly, it sanitises.
    const correct = await writtenUnder({ security: { sanitize: "strict" } });
    ctx.log.note("the option spelled the way the contract declares", correct);

    expectClaim(correct.inert, {
      claimIds: ["API-001"],
      what: "the correctly spelled option did not sanitise, so nothing below is about a misspelling",
      detail: JSON.stringify(correct),
    });

    // The second control, and a boundary on the repair: no option means no sanitising, on purpose. A
    // fix must not become "sanitise by default", which is a larger change than this asks for.
    const untouched = await writtenUnder({});
    expectClaim(!untouched.inert && untouched.said.length === 0, {
      claimIds: ["API-001"],
      what: "a form with no security option sanitised anyway, or complained about not being asked to",
      detail: JSON.stringify(untouched),
    });

    // And the four spellings.
    const missed = [];
    for (const [what, options] of [
      ["{ security: 'strict' }", { security: "strict" }],
      ["{ sanitize: 'strict' }", { sanitize: "strict" }],
      ["{ security: { sanitise: 'strict' } }", { security: { sanitise: "strict" } }],
      ["{ security: { sanitize: 'stict' } }", { security: { sanitize: "stict" } }],
    ]) {
      const outcome = await writtenUnder(options);
      ctx.log.note("a sanitiser asked for badly", { what, ...outcome });
      if (!outcome.inert && outcome.said.length === 0) missed.push({ what, held: String(outcome.held) });
    }

    // Either repair closes it: refuse the option, or say that nothing was installed. What this
    // refuses is the third thing — a request for a sanitiser answered by the profile named "off",
    // with nothing to tell the consumer apart from somebody who asked for nothing.
    expectEqual(missed, [], {
      claimIds: ["API-001"],
      what: "a sanitiser asked for badly left the value unsanitised and said nothing",
      detail: JSON.stringify(missed),
    });
  },
);
