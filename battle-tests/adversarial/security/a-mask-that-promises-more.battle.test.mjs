/**
 * The panel masks two kinds of field, and only one of them is protected anywhere else.
 *
 * ADR 0089 made `sensitive` a statement about the value, honoured wherever the value would otherwise
 * be copied. The panel honours it — and it also **guesses**, from the name, so that a field called
 * `password` is masked whether or not anyone declared it. The guess is a kindness to a developer
 * reading the panel, and there is a battle beside this one that pins which names it covers.
 *
 * The two are indistinguishable in the panel's own output:
 *
 *   path        panel   sensitivePaths()   autosaved draft
 *   password    •••     no                 "VALUE-password"
 *   apiToken    •••     no                 "VALUE-apiToken"
 *   secret      •••     no                 "VALUE-secret"
 *   answer      •••     yes                withheld
 *   ordinary    plain   no                 "VALUE-ordinary"
 *
 * A snapshot row carries `path`, `value`, `valid`, `touched`, `dirty`, `pending`, `errors` — and
 * nothing that says which of the two decided the bullets. So a developer opens the panel, sees
 * `•••` beside `password`, and draws the only available conclusion: the framework knows this is a
 * secret and is treating it as one. It is treating it as one **here**. The draft, which is the
 * surface that persists, writes it to storage in clear.
 *
 * The battle does not ask the draft to start guessing. Guessing what to withhold from a draft is
 * the defect from the other direction — finding 206 is a column of a person's work vanishing because
 * an unrelated field shared its name — and it should stay declared-only.
 *
 * It asks the narrower thing: **what the panel masks is either protected elsewhere, or
 * distinguishable from what is.** A mask that means two different things, with no way to tell which,
 * is a promise the product does not keep. Either fix satisfies it: carry the reason in the row, or
 * stop masking what nobody declared.
 */

import { createForm, field } from "@modyra/core";
import { mdyFormSnapshot } from "@modyra/core/devtools";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const MASKED = "•••";

function watchedStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => {
      written.set(key, value);
    },
    remove: (key) => {
      written.delete(key);
    },
  };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 200));
const saved = () => new Promise((resolve) => setTimeout(resolve, 900));

battle(
  {
    claims: ["SEC-002", "SEC-005"],
    title: "what the panel masks is protected elsewhere, or says it is only a guess",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = watchedStorage();
    // Three names a guess catches and nobody declared, one declaration a guess would never catch,
    // and one of neither.
    const NAMES = ["password", "apiToken", "secret", "answer", "ordinary"];
    const form = createForm(
      {
        password: field(""),
        apiToken: field(""),
        secret: field(""),
        answer: field("", [], { sensitive: true }),
        ordinary: field(""),
      },
      { draft: { key: "k", storage }, devWarnings: false },
    );

    try {
      await settled();
      for (const name of NAMES) form.f[name].set(`VALUE-${name}`);
      await saved();

      const rows = mdyFormSnapshot(form).fields ?? [];
      const listed = new Set(form.sensitivePaths());
      const envelope = storage.written.get("k");
      const draft = envelope ? JSON.parse(envelope).value : {};

      const observed = NAMES.map((name) => {
        const row = rows.find((each) => each.path === name);
        return {
          path: name,
          masked: row?.value === MASKED,
          // Anything on the row that could tell a reader why it was masked.
          rowSays: Object.keys(row ?? {}).filter((key) => !["path", "value", "valid", "touched", "dirty", "pending", "errors"].includes(key)),
          declared: listed.has(name),
          inDraft: Object.hasOwn(draft, name) ? draft[name] : null,
        };
      });
      ctx.log.note("what the panel masks, and what happens to it elsewhere", observed);

      // The instrument, three ways: the draft ran, an undeclared ordinary field is neither masked nor
      // withheld, and a declared one is both. Without these, "masked but written" could describe a
      // panel that masks everything or a draft that saves nothing.
      const ordinary = observed.find((row) => row.path === "ordinary");
      const declared = observed.find((row) => row.path === "answer");
      expectClaim(
        envelope !== undefined &&
          ordinary.masked === false &&
          ordinary.inDraft === "VALUE-ordinary" &&
          declared.masked === true &&
          declared.inDraft === null,
        {
          claimIds: ["SEC-002"],
          what: "the panel or the draft is not behaving at all, so the probe is wrong before the product is",
          detail: JSON.stringify({ ordinary, declared }),
        },
      );

      expectEqual(
        observed
          .filter((row) => row.masked && row.inDraft !== null && row.rowSays.length === 0)
          .map((row) => row.path),
        [],
        {
          claimIds: ["SEC-002", "SEC-005"],
          what: "the panel masked a value the draft then wrote to storage in clear, and the row it printed says nothing to distinguish the two",
        },
      );
    } finally {
      form.destroy();
    }
  },
);
