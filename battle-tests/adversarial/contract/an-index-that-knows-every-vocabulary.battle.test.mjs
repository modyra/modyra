/**
 * An index of the vocabularies is only worth having if it knows about all of them.
 *
 * The failure it exists to prevent has been measured three times in one session, and each time in
 * the direction of "everything is fine":
 *
 *   an enumerator that knew one catalogue of nine   reported 39 declared properties and 0 mute
 *   a class census that read the package index      reported 3 published names as undeclared,
 *     and not its `./vocabulary` subpath              because the shared names live only there
 *   a role check that read three doors of four      reported 16 roles as declared by nobody
 *
 * **A tool built against "the contract" takes the first vocabulary it trips over and looks
 * complete.** None of those three could tell that it was reading one door of several, and none of
 * them was wrong in a way a reader would notice.
 *
 * So the index is not documentation: it is the thing that makes "all of them" checkable, and this is
 * the check. Every `MDY_`-named export, from either published door, is either in the index or is a
 * name the next tool will miss.
 *
 * Both doors are read on purpose. Reading the barrel alone is the exact error above.
 */
import * as index from "@modyra/widgets";
import * as vocabulary from "@modyra/widgets/vocabulary";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Every `MDY_`-named export the package publishes, and the door it came from. */
const publishedNames = () => {
  const found = new Map();
  for (const [door, module] of [["index", index], ["./vocabulary", vocabulary]]) {
    for (const name of Object.keys(module)) {
      if (name.startsWith("MDY_") && !found.has(name)) found.set(name, door);
    }
  }
  return found;
};

battle(
  {
    claims: ["ADP-001"],
    title: "an index that knows every vocabulary",
    environments: ["node"],
  },
  async () => {
    const doors = publishedNames();

    // The premise: a package that published nothing would satisfy every comparison below.
    expectClaim(doors.size >= 10, {
      claimIds: ["ADP-001"],
      what: "the package published almost no MDY_ name, so this compared nothing",
      detail: `${doors.size} names`,
    });

    const catalogue = index.MDY_VOCABULARIES ?? vocabulary.MDY_VOCABULARIES;

    expectClaim(catalogue !== undefined, {
      claimIds: ["ADP-001"],
      what: "no `MDY_VOCABULARIES` is published from either door, so a tool asking for every "
        + "vocabulary has to guess which ones exist — which is the defect this exists to prevent",
      detail: `${doors.size} MDY_ names published, none of them an index`,
    });

    // The index may be a list of names or a map from name to a description of its shape. Both are
    // read the same way: what matters is which names it knows, not how it says what they are.
    const known = new Set(
      Array.isArray(catalogue)
        ? catalogue.map((one) => (typeof one === "string" ? one : String(one?.name)))
        : Object.keys(catalogue),
    );

    const missing = [...doors.entries()]
      .filter(([name]) => !known.has(name))
      .map(([name, door]) => `${name} (published from ${door})`)
      .sort();

    expectEqual(missing, [], {
      claimIds: ["ADP-001"],
      what: "published vocabularies the index does not know: a tool asking it for every vocabulary "
        + "gets an answer missing these, and has no way to find out",
    });

    const invented = [...known].filter((name) => !doors.has(name)).sort();
    expectEqual(invented, [], {
      claimIds: ["ADP-001"],
      what: "names the index lists and the package does not publish, which send a tool looking for "
        + "a door that is not there",
    });
  },
);
