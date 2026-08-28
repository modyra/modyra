/**
 * An index of the vocabularies is only worth having if it knows about all of them.
 *
 * The failure it exists to prevent was measured three times in one session, and each time in the
 * direction of "everything is fine":
 *
 *   an enumerator that knew one catalogue of nine   reported 39 declared properties and 0 mute
 *   a class census reading the package index        reported 3 published names as undeclared,
 *     and not its `./vocabulary` subpath              because the shared names live only there
 *   a role check reading three doors of four        reported 16 roles as declared by nobody
 *
 * **A tool built against "the contract" takes the first vocabulary it trips over and looks
 * complete.** None of the three could tell it was reading one door of several.
 *
 * **The index is found, not named.** A check that looks for a name it decided in advance goes red on
 * an index that exists under another one — which is what happened here: this was written expecting
 * `MDY_VOCABULARIES` and the index shipped as `MDY_CONTRACT_VOCABULARIES`. So it is recognised by
 * shape: the published export whose entries carry a `name` that is itself a published export.
 *
 * **What counts as a vocabulary**, and this is the perimeter: a published `MDY_` export whose value
 * is a non-empty object or array. A scalar — a delimiter, a depth limit, an error code — is a
 * constant and not a catalogue. That rule is coarse: some collections are data rather than
 * vocabulary, and the answer to those is for the index to say so with a shape of its own, not for
 * this check to carry a list of names it agrees to ignore.
 */
import * as index from "@modyra/widgets";
import * as vocabulary from "@modyra/widgets/vocabulary";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Every `MDY_`-named export the package publishes, with the door it came from and its value. */
const publishedNames = () => {
  const found = new Map();
  for (const [door, module] of [["index", index], ["./vocabulary", vocabulary]]) {
    for (const [name, value] of Object.entries(module)) {
      if (name.startsWith("MDY_") && !found.has(name)) found.set(name, { door, value });
    }
  }
  return found;
};

/** A catalogue is a collection; a constant is a scalar. */
const isCollection = (value) =>
  (Array.isArray(value) && value.length > 0)
  || (value !== null && typeof value === "object" && Object.keys(value).length > 0);

/** The index, recognised by what it contains rather than by a name chosen here. */
const findIndex = (published) => {
  for (const [, { value }] of published) {
    const entries = Array.isArray(value) ? value : null;
    if (entries === null || entries.length === 0) continue;
    const named = entries.filter((one) => one !== null && typeof one === "object" && typeof one.name === "string");
    if (named.length === entries.length && named.every((one) => published.has(one.name))) return entries;
  }
  return null;
};

battle(
  {
    claims: ["ADP-001"],
    title: "an index that knows every vocabulary",
    environments: ["node"],
  },
  async (ctx) => {
    const published = publishedNames();

    // What was swept, recorded: a battle that inspects rather than drives still has to say what
    // population it looked at, or a green means "found nothing" and "looked at nothing" alike.
    ctx.log.note("the MDY_ names both doors publish", {
      total: published.size,
      collections: [...published.values()].filter(({ value }) => isCollection(value)).length,
    });

    // The premise: a package that published nothing satisfies every comparison below.
    expectClaim(published.size >= 10, {
      claimIds: ["ADP-001"],
      what: "the package published almost no MDY_ name, so this compared nothing",
      detail: `${published.size} names`,
    });

    const catalogue = findIndex(published);

    expectClaim(catalogue !== null, {
      claimIds: ["ADP-001"],
      what: "no published export is an index of the vocabularies, so a tool asking for every "
        + "vocabulary has to guess which ones exist — which is the defect this exists to prevent",
      detail: `${published.size} MDY_ names published, none of them an index`,
    });

    const known = new Set(catalogue.map((one) => one.name));
    ctx.log.note("the index found, and what it knows", {
      entries: catalogue.length,
      shapes: [...new Set(catalogue.map((one) => one.shape))].sort(),
    });

    // A shape beside each name is what makes the index usable by a tool rather than by a reader: a
    // catalogue keyed by kind and a flat list of names are read by different code.
    const shapeless = catalogue.filter((one) => typeof one.shape !== "string" || one.shape === "").map((one) => one.name);
    expectEqual(shapeless, [], {
      claimIds: ["ADP-001"],
      what: "entries with no shape: a tool told a vocabulary exists and not how it is arranged has "
        + "to guess, which is the guessing this index removes",
    });

    const missing = [...published.entries()]
      .filter(([name, { value }]) => isCollection(value) && !known.has(name))
      .map(([name, { door }]) => `${name} (${door})`)
      .sort();

    expectEqual(missing, [], {
      claimIds: ["ADP-001"],
      what: "published catalogues the index does not know: a tool asking it for every vocabulary "
        + "gets an answer missing these, and has no way to find out. A collection that is data "
        + "rather than vocabulary belongs in the index under a shape that says so",
    });
  },
);
