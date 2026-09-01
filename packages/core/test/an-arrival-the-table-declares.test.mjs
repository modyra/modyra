/**
 * Every arrival the table declares is one the parser enforces.
 *
 * `MDY_DYNAMIC_MEMBER_ARRIVALS` says which version each member arrived with, and it is read twice:
 * the parser refuses the member in a document whose version predates it, and the schema audit
 * excuses the published schemas that were written before it existed. A table nobody exercises is a
 * declaration that agrees with whatever the code does — so the assertion runs over the table's own
 * entries rather than over a list of members written here, and an arrival added tomorrow is
 * enforced by this the same day.
 *
 * The document a member is placed in differs by slot, so each slot says how to build one. A slot
 * the table gains and this does not know about fails loudly, which is the right way to find out.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MDY_DYNAMIC_MEMBER_ARRIVALS, parseDynamicForm } from "../dist/index.js";

/** Where each slot's members live in a document, and what a value for one looks like. */
const PLACE = {
  document: (member, version) => ({
    version,
    id: "arrival",
    fields: [{ name: "a", kind: "text", label: "A" }],
    [member]: member === "requiresContext" ? ["who"] : true,
  }),
  validators: (member, version) => ({
    version,
    id: "arrival",
    fields: [{ name: "n", kind: "number", label: "N", validators: { [member]: true } }],
  }),
};

const entries = Object.entries(MDY_DYNAMIC_MEMBER_ARRIVALS)
  .flatMap(([slot, members]) => Object.entries(members).map(([member, version]) => ({ slot, member, version })));

test("the table is not empty, or this asserts nothing", () => {
  assert.ok(entries.length > 0, "no arrivals declared, so every case below is vacuous");
});

for (const { slot, member, version } of entries) {
  test(`${slot}.${member} is refused before v${version} and accepted at it`, () => {
    const build = PLACE[slot];
    assert.ok(build, `the table declares a "${slot}" arrival this test does not know how to place`);

    const accepted = parseDynamicForm(build(member, version));
    assert.equal(
      accepted.ok,
      true,
      `v${version} must accept the member the table says arrived with it: ${JSON.stringify(accepted.diagnostics)}`,
    );

    const predates = version - 1;
    const refused = parseDynamicForm(build(member, predates));
    assert.equal(refused.ok, false, `v${predates} accepted "${member}", which the table says it predates`);

    const finding = refused.diagnostics.find((d) => d.code === "MDY_DYNAMIC_UNSUPPORTED_VERSION");
    assert.ok(finding, `v${predates} refused "${member}" without saying it was a version matter`);
    assert.match(
      finding.message,
      new RegExp(`arrived with version ${version}`),
      "the refusal must name the version that has the member, not merely refuse",
    );
  });
}
