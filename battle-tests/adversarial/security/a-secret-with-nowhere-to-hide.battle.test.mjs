/**
 * A card number the form was told to keep out of storage, in storage.
 *
 * The draft guide carries a security warning in bold, and it is an instruction rather than a caveat:
 * the default storage is plain text, readable by every script on the origin, and it survives logout,
 * so **always exclude passwords, card numbers, tokens and any other sensitive field**.
 *
 * `exclude` matches an exact leaf path and nothing else. For a field at the top of the form that is
 * enough. For a card number, it is not: cards come in a list, the row key is data, and a consumer
 * cannot name paths that do not exist until a user adds a row.
 *
 * Every way of writing the intent is tried here. Naming the collection does nothing. A wildcard does
 * nothing, because there are no wildcards. The bare cell name does nothing. The only spelling that
 * works is the one nobody can write in advance — the full path including a row key the user has not
 * created yet.
 *
 * The control is the flat case, which works: a password beside the collection is kept out, written
 * and restored alike. So this is about where the field lives, not about `exclude` being broken.
 */

import { buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 700));

/** A number that is unmistakable in a blob of JSON. */
const PAN = "4111111111111111";

const document = {
  node: "group",
  children: {
    who: { node: "field", field: { kind: "text", label: "W" } },
    password: { node: "field", field: { kind: "password", label: "P" } },
    cards: {
      node: "record",
      item: {
        node: "group",
        children: {
          label: { node: "field", field: { kind: "text", label: "L" } },
          pan: { node: "field", field: { kind: "password", label: "PAN" } },
        },
      },
    },
  },
};

/** Fill a form whose draft excludes `exclude`, and give back what reached storage. */
async function storedWith(exclude) {
  const storage = memoryStorage();
  const form = createForm(buildDynamicFormSchema(document), {
    draft: { key: "k", storage, exclude },
    devWarnings: false,
  });
  form.f.who.set("lorenzo");
  form.f.password.set("hunter2");
  form.f.cards.upsert("a", { label: "Visa", pan: PAN });
  await saved();
  const raw = String(storage.written.get("k") ?? "");
  form.destroy();
  return raw;
}

battle(
  {
    claims: ["SEC-006", "PER-001"],
    title: "a sensitive cell inside a collection can be kept out of a draft",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the flat case works, so `exclude` is not broken and what follows is about the
    // collection.
    const flat = await storedWith(["password"]);
    ctx.log.note("a password beside the collection", { keptOut: !flat.includes("hunter2") });

    expectClaim(!flat.includes("hunter2"), {
      claimIds: ["SEC-006"],
      what: "a field named in exclude was written to storage, so nothing below is about collections",
      detail: flat.slice(0, 160),
    });

    // And every way a consumer would write the same intent for a cell inside a row.
    const spellings = [
      ["the collection itself", ["cards"]],
      ["a wildcard row", ["cards.*.pan"]],
      ["the cell's own name", ["pan"]],
      ["every row, spelled out", ["cards.a.pan"]],
    ];

    const results = [];
    for (const [what, exclude] of spellings) {
      const raw = await storedWith(exclude);
      results.push({ what, exclude, keptOut: !raw.includes(PAN) });
    }
    ctx.log.note("what reached storage for each way of saying it", { results });

    // The last spelling is the one that works, and it is the one nobody can write: `a` is a row key
    // the user creates at runtime. Asserted so that a repair which only fixes the others is visible.
    expectClaim(results.at(-1).keptOut, {
      claimIds: ["SEC-006"],
      what: "even the full path including the row key did not keep the cell out",
      detail: JSON.stringify(results),
    });

    for (const result of results.slice(0, -1)) {
      expectClaim(result.keptOut, {
        claimIds: ["SEC-006", "PER-001"],
        what: `excluding ${JSON.stringify(result.exclude)} — ${result.what} — left the card number in storage`,
        detail: JSON.stringify(results),
      });
    }
  },
);
