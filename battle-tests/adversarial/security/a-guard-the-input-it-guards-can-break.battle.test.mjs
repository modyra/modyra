/**
 * The check that reads an untrusted draft, given one.
 *
 * `docs/guides/security.md` states the threat model in its own words: *"A stored draft is untrusted
 * input (`localStorage` is writable by any script on the origin)"*, and what the form does about it —
 * a value of the wrong shape is *"dropped and reported (`draft-shape`) instead of causing type
 * confusion downstream"*. Dropping and reporting is the promise, and it holds for the ordinary
 * hostile draft: an object where a string belongs is refused and the violation is named.
 *
 * A nested one is refused by nothing, because the refusal never finishes. The restore walks the
 * value looking for leaves it must not accept, and the walk recurses once per level, so a draft
 * nested past what the stack holds ends in `RangeError: Maximum call stack size exceeded` thrown out
 * of `createForm`. The form does not exist, and the application that built it gets an exception
 * rather than a form with a dropped draft.
 *
 * `JSON.parse` reads the same text without difficulty — the parse is not the limit, the guard is.
 * A hostile script writes the text and never has to build the object to do it.
 *
 * The depth at which it gives way is the runtime's stack rather than a property of the contract, so
 * nothing here pins a number: the battle uses a depth well past it and asserts what happens, not
 * where. Measured on this machine the first depth that throws is around three thousand.
 *
 * Green either way: the walk is bounded, or the restore is wrapped so that a draft it cannot read is
 * dropped and reported like every other draft it will not take.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Comfortably past any stack this runs on, and cheap to write as text. */
const HOSTILE_DEPTH = 20_000;

function memoryStorage() {
  const written = new Map();
  return {
    written,
    storage: {
      read: (key) => written.get(key) ?? null,
      write: (key, value) => written.set(key, value),
      remove: (key) => written.delete(key),
    },
  };
}

/** An envelope this form wrote, so what is restored differs only in the value it carries. */
async function envelopeFrom(store) {
  const form = createForm({ f: field("") }, { devWarnings: false, draft: { key: "k", storage: store.storage } });
  form.f.f.set("hello");
  await new Promise((resolve) => setTimeout(resolve, 760));
  form.destroy();
  return store.written.get("k");
}

/** What a script on the origin leaves behind: text, never an object it had to build. */
function withValue(envelope, text) {
  return envelope.replace(/"value":\{.*?\}(,|\})/, `"value":{"f":${text}}$1`);
}

const nested = (depth) => `${'{"inner":'.repeat(depth)}{"s":"x"}${"}".repeat(depth)}`;

/** Build a form over whatever is in storage, and say what came back. */
async function restore(store) {
  const heard = [];
  try {
    const form = createForm({ f: field("") }, {
      devWarnings: false,
      draft: { key: "k", storage: store.storage },
      security: { sanitize: "strict", onViolation: (violation) => heard.push(violation.code ?? violation.kind ?? "unnamed") },
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
    const held = form.getValue().f;
    form.destroy();
    return { threw: null, heard, held: typeof held };
  } catch (error) {
    return { threw: error.constructor.name, heard, held: null };
  }
}

battle(
  {
    claims: ["SEC-004", "PER-003"],
    title: "a draft the form will not take is dropped and reported, not thrown",
    environments: ["node"],
  },
  async (ctx) => {
    const store = memoryStorage();
    const envelope = await envelopeFrom(store);

    // The control, and it is the promise the guide makes: an ordinary hostile draft is refused by
    // name and the form exists anyway.
    store.written.set("k", withValue(envelope, nested(100)));
    const ordinary = await restore(store);
    ctx.log.note("a hostile draft the guard can finish reading", ordinary);
    expectEqual([ordinary.threw, ordinary.heard, ordinary.held], [null, ["draft-shape"], "string"], {
      claimIds: ["PER-003"],
      what: "a hostile draft of an ordinary depth is not dropped and reported, so the promise this battle tests is not kept even where it is easy",
    });

    // The same draft, deeper. Nothing about it is different in kind.
    store.written.set("k", withValue(envelope, nested(HOSTILE_DEPTH)));
    const deep = await restore(store);
    ctx.log.note("the same draft, nested past the stack", deep);

    // The parse is not the limit: the text reads back fine, so what gives way is the guard.
    expectClaim(JSON.parse(nested(HOSTILE_DEPTH)) !== null, {
      claimIds: ["SEC-004"],
      what: "this runtime cannot parse the draft text either, so the battle cannot say the guard is what gave way",
    });

    expectClaim(deep.threw === null, {
      claimIds: ["SEC-004", "PER-003"],
      what: "a stored draft made createForm throw, so a script on the origin can stop the application building the form at all",
      detail: JSON.stringify(deep),
    });
  },
);
