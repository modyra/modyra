/**
 * A project's identifiers are refused at the door when they could leave the quotes they are written in.
 *
 * The editor writes every id into quoted HTML attributes and CSS selectors. A project is a file anyone
 * may hand to Studio, so an id holding a quote or an angle bracket is markup waiting to run when the
 * project is opened. The loader refuses it and names where it is; a project whose ids Studio made
 * itself, or that uses ordinary separators, opens as before.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadProject, StudioModelError } from "../dist/index.js";
import { createCheckoutProject } from "./fixtures/checkout.fixture.mjs";

const HOSTILE = `x"><img src=x onerror=alert(1)>`;

/** The checkout project with one identifier replaced, wherever `place` puts it. */
function withId(place) {
  const project = structuredClone(createCheckoutProject());
  place(project);
  return project;
}

const firstField = (node) => (node.node === "field" ? node : node.children?.map(firstField).find(Boolean) ?? null);

test("the fixture opens: the control for every refusal below", () => {
  assert.doesNotThrow(() => loadProject(createCheckoutProject()));
});

test("a node id that leaves its quotes is refused, naming the place", () => {
  const project = withId((p) => { firstField(p.schema).id = HOSTILE; });
  assert.throws(() => loadProject(project), (error) => error instanceof StudioModelError && /schema.*\.id/.test(error.message));
});

test("a validator id that leaves its quotes is refused", () => {
  const project = withId((p) => {
    const node = firstField(p.schema);
    node.validators = [{ id: HOSTILE, kind: "required" }];
  });
  assert.throws(() => loadProject(project), StudioModelError);
});

test("an implementation key that leaves its quotes is refused", () => {
  const project = withId((p) => {
    p.implementations = { ...p.implementations, [HOSTILE]: { id: "impl_ok", role: "serverValidator", displayName: "X" } };
  });
  assert.throws(() => loadProject(project), StudioModelError);
});

test("ordinary separators in a hand-written id are accepted", () => {
  const project = withId((p) => { firstField(p.schema).id = "billing.address:line-1_v2"; });
  assert.doesNotThrow(() => loadProject(project));
});
