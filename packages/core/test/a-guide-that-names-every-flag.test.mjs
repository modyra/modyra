/**
 * The adapter guide names every capability, and none that does not exist.
 *
 * The guide carried a copied type dump listing `writableComputed`, a member the interface does not
 * have and may never have had — the same silent drift a hand-written mirror always has, in the one
 * document an adapter author reads before writing a line.
 *
 * The list is compared against the type as the code publishes it, so a capability added tomorrow
 * fails here until the guide says what answering it costs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { vanillaReactivity } from "../dist/index.js";

const guide = readFileSync(
  fileURLToPath(new URL("../../../docs/guides/reactivity-adapter-guide.md", import.meta.url)),
  "utf8",
);

/**
 * The capabilities the contract actually has.
 *
 * Read off a real adapter rather than parsed out of the `.d.ts`: an interface is erased and a
 * declaration file is a second place to be wrong, while what vanilla answers is what a consumer
 * meets. Vanilla declares every member, which is what makes it usable as the roll-call.
 */
const FLAGS = Object.keys(vanillaReactivity().capabilities);

test("vanilla answers every capability, or it cannot serve as the roll-call", () => {
  assert.ok(FLAGS.length >= 10, `only ${FLAGS.length} capabilities answered`);
});

test("the guide names every capability the contract has", () => {
  const unnamed = FLAGS.filter((flag) => !new RegExp(`\\b${flag}\\b`).test(guide));
  assert.deepEqual(unnamed, [], "a capability an author must answer is not in the guide");
});

test("the guide names no capability the contract does not have", () => {
  // Only inside the interface block: the prose elsewhere legitimately mentions methods and options
  // that are not capabilities.
  const block = guide.match(/interface MdyReactivityCapabilities \{([\s\S]*?)\}/);
  assert.ok(block, "the guide no longer shows the capability interface");
  const shown = [...block[1].matchAll(/readonly (\w+):/g)].map((match) => match[1]);
  assert.ok(shown.length > 0, "the interface block named nothing");
  assert.deepEqual(
    shown.filter((flag) => !FLAGS.includes(flag)),
    [],
    "the guide shows a capability that does not exist — the drift this test was written for",
  );
});

test("every capability is placed in one of the guide's three groups", () => {
  const groups = [
    "Read by the engine — answering changes behaviour.",
    "Read only by the conformance suite — answering costs you a check.",
    "Read by nothing, today.",
  ];
  for (const heading of groups) {
    assert.ok(guide.includes(heading), `the guide lost the group "${heading}"`);
  }
  // Each flag has a table row of its own, which is what carries the cost of answering it.
  for (const flag of FLAGS) {
    assert.match(
      guide,
      new RegExp(`^\\| \`${flag}\` \\|`, "m"),
      `${flag} is mentioned but has no row saying what answering it costs`,
    );
  }
});
