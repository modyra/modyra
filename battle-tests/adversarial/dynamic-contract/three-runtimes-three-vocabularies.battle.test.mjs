/**
 * Which documents exist, asked of the three runtimes that are supposed to agree.
 *
 * H-6 of `charter/fable5-hunts.md`: *"the same conditional semantics hold in `@modyra/core`, the Rust
 * SDK and the Java SDK, proven by the shared fixtures in `spec/fixtures/dynamic-form/` — including
 * the v4 `when` forms, which the SDKs may not yet parse."*
 *
 * Before semantics can agree, the three have to agree on which documents are documents. They do not:
 *
 *   @modyra/core      accepts 1, 2, 3, 4
 *   sdk/rust          accepts 2, 3        "expected contract version 2 or 3"
 *   sdk/java          accepts 2, 3        version == 2 || version == 3
 *
 * Each SDK **states its position**, which is the letter of what H-6 asks: a version it does not know
 * is refused with a message. What that leaves is a v4 document — the one carrying `when`,
 * `asyncWhen` and `requiresContext`, which is exactly the conditional semantics H-6 wants proven
 * identical — rendered by one runtime and refused by the other two. Not a divergence in behaviour;
 * an absence of it in two places out of three.
 *
 * And the sentences do not agree either. `@modyra/core` says *"expected 1, 2 or 3"* while accepting
 * 4 in the tree shape (finding 235); Rust says *"expected contract version 2 or 3"*; Java says it in
 * code and not in words. Three runtimes, three vocabularies for one question, and the one that is
 * wrong about itself is the reference implementation.
 *
 * The battle asserts the narrow thing H-6 states — every version one runtime accepts is one the
 * others have a position on — and reads that position from the sources, because a Rust crate and a
 * Maven module are not things a node battle can run. What it cannot do is prove the *semantics*
 * agree; the shared fixtures exist for that, and there are none for v4 (finding 237).
 *
 * @source-inspection — the accepted version set of a Rust crate and a Java class is a fact about
 * their sources, and this suite has no toolchain to ask them at runtime. The check is deliberately
 * shallow: it reads the numbers each guard names, and a control requires it to find all three.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const REPO = resolve(dirname(new URL(import.meta.url).pathname), "..", "..", "..");

/** Versions `@modyra/core` really takes, asked rather than read. */
function versionsTypeScriptAccepts() {
  const leaf = { node: "field", field: { kind: "text", label: "A" } };
  const accepted = [];
  for (const version of [1, 2, 3, 4, 5]) {
    const flat = parseDynamicForm({ version, fields: [{ name: "a", kind: "text", label: "A" }] }, { mode: "strict" });
    const tree = parseDynamicForm({ version, schema: { node: "group", children: { a: leaf } } }, { mode: "strict" });
    if (flat.fields.length > 0 || tree.fields.length > 0) accepted.push(version);
  }
  return accepted;
}

/**
 * The version numbers a guard names, read off the source, in either spelling.
 *
 * A guard states its set as literals — `version != 2 && version != 3` — or as a range once the set
 * grows past the point where writing them out reads well. Both are the same statement, and reading
 * only the first form returns an empty set from a guard that is perfectly clear: Rust said
 * `!(2..=5).contains(&form.version)` and this reported that it accepts nothing.
 *
 * An empty set is the dangerous answer here, because every other runtime agrees with it — a
 * comparison against nothing finds no disagreement. The caller's own guard catches that, and it did;
 * this makes the case not arise.
 */
function versionsNamedIn(path, pattern) {
  const source = readFileSync(join(REPO, path), "utf8");
  const line = source.split("\n").find((each) => pattern.test(each)) ?? "";
  const span = /\b([1-9])\s*\.\.=\s*([1-9])\b/.exec(line);
  if (span !== null) {
    const [from, to] = [Number(span[1]), Number(span[2])];
    return Array.from({ length: to - from + 1 }, (_, step) => from + step);
  }
  return [...line.matchAll(/\b([1-9])\b/g)].map((match) => Number(match[1])).sort((a, b) => a - b);
}

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "every version one runtime accepts is one the others have a position on",
    environments: ["node"],
  },
  async (ctx) => {
    const typescript = versionsTypeScriptAccepts();
    // Either spelling of the same guard: the crate wrote its set out until it grew, and now names a
    // range. A pattern that knows only the older one reads the newer as silence.
    const rust = versionsNamedIn(
      "sdk/rust/modyra-contract/src/lib.rs",
      /form\.version != \d|\.\.=\s*\d\s*\)\.contains\(&form\.version\)/,
    );
    const java = versionsNamedIn(
      "sdk/java/modyra-contract/src/main/java/dev/modyra/contract/MdyDynamicFormParser.java",
      /version == \d+ \|\| version == \d+/,
    );
    ctx.log.note("which versions each runtime takes", { typescript, rust, java });

    // The instrument: all three must have been found, and each must name at least two versions.
    // A regex that matched nothing would make every runtime look like it agrees with an empty set.
    expectClaim(
      typescript.length >= 3 && rust.length >= 2 && java.length >= 2,
      {
        claimIds: ["DYN-003"],
        what: "one of the three runtimes could not be read, so the comparison below is between a real set and an empty one",
        detail: JSON.stringify({ typescript, rust, java }),
      },
    );

    const missingFrom = (theirs) => typescript.filter((version) => !theirs.includes(version));
    expectEqual(
      { rust: missingFrom(rust), java: missingFrom(java) },
      { rust: [], java: [] },
      {
        claimIds: ["DYN-001", "DYN-003"],
        what: "a version the TypeScript parser builds a form from is one the other runtimes refuse, so a document that renders on one of the three does not exist for the other two",
      },
    );
  },
);
