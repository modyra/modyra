/**
 * A fixture the kit cannot drive is refused by name, before anything is driven.
 *
 * The reference config delegates `mount` to a fixture it already has, so somebody copying it sees
 * `export const mount = fixture.mount` and never learns what one returns. The first missing member
 * used to arrive as `fixture.drive is not a function`, thrown inside a kit file the author has
 * never opened — a stack trace about somebody else's code, for a requirement nobody stated.
 *
 * Read from the contract rather than restated: the members asserted below come from
 * `missingFixtureMembers` itself, so a member added to `MdyStateFixture` is covered here the day it
 * is added rather than the day somebody remembers this file.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { missingFixtureMembers } from "../dist/testing/index.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));

/** The full set, named by asking the checker what an empty object is missing. */
const OWED = missingFixtureMembers({}).map((line) => line.split(" — ")[0]);

test("a fixture that is not an object owes every member", () => {
  assert.ok(OWED.length >= 5, "the checker named too few members to be reading the contract");
  for (const value of [null, undefined, "a string", 7]) {
    assert.deepEqual(
      missingFixtureMembers(value).map((line) => line.split(" — ")[0]),
      OWED,
      `${String(value)} was treated as a usable fixture`,
    );
  }
});

test("each owed member is missed on its own, and named with what it is for", () => {
  const whole = Object.fromEntries(OWED.map((member) => [member, member === "root" ? {} : () => {}]));
  assert.deepEqual(missingFixtureMembers(whole), [], "a complete fixture was reported as missing something");

  for (const member of OWED) {
    const without = { ...whole };
    delete without[member];
    const reported = missingFixtureMembers(without);
    assert.equal(reported.length, 1, `dropping ${member} reported ${reported.length} members`);
    assert.ok(reported[0].startsWith(`${member} — `), `${member} was reported without saying what it is for`);
  }
});

test("a member of the wrong type is as missing as an absent one", () => {
  const whole = Object.fromEntries(OWED.map((member) => [member, member === "root" ? {} : () => {}]));
  const callable = OWED.filter((member) => member !== "root");
  for (const member of callable) {
    const reported = missingFixtureMembers({ ...whole, [member]: "not a function" });
    assert.equal(reported.length, 1, `a string ${member} was accepted`);
  }
});

test("the conformance tool refuses such a config, and says which member", () => {
  let output = "";
  let code = 0;
  try {
    execFileSync(
      process.execPath,
      ["packages/widgets/bin/modyra-conformance.mjs", "packages/widgets/test/fixtures/nodrive.config.mjs"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    code = error.status;
  }
  assert.equal(code, 2, "a config the kit cannot drive must exit as a config problem");
  assert.match(output, /drive — /, "the refusal did not name the missing member");
  assert.doesNotMatch(output, /is not a function/, "the kit leaked its own stack instead of speaking");
});
