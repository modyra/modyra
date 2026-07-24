import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStubsModule } from "../dist/index.js";

function project(implementations) {
  return { studioVersion: 1, id: "p", name: "P", schema: { node: "group", id: "root", name: "root", children: [] }, formValidators: [], behaviors: {}, implementations, presentation: {}, targets: {}, metadata: {} };
}

test("emits one typed, throwing stub per implementation, named after displayName", () => {
  const { code, nameFor, diagnostics } = buildStubsModule(project({
    impl_a: { id: "impl_a", role: "submitAction", displayName: "createOrder", mode: "stub" },
    impl_b: { id: "impl_b", role: "serverValidator", displayName: "validateCoupon", mode: "stub" },
    impl_c: { id: "impl_c", role: "customValidator", displayName: "checkThing", mode: "stub" },
  }));
  assert.deepEqual(diagnostics, []);
  assert.equal(nameFor.get("impl_a"), "createOrder");
  assert.equal(nameFor.get("impl_b"), "validateCoupon");
  assert.equal(nameFor.get("impl_c"), "checkThing");
  assert.match(code, /export async function createOrder\(value: Record<string, unknown>\): Promise<void>/);
  assert.match(code, /export async function validateCoupon\(value: unknown, ctx: MdyAsyncValidationContext\): Promise<readonly string\[\]>/);
  assert.match(code, /export function checkThing\(value: unknown\): readonly string\[\]/);
  assert.match(code, /throw new Error\("TODO: implement createOrder"\)/);
});

test("only imports MdyAsyncValidationContext when a serverValidator stub exists", () => {
  const withServer = buildStubsModule(project({ impl_a: { id: "impl_a", role: "serverValidator", displayName: "check", mode: "stub" } }));
  assert.match(withServer.code, /import type \{ MdyAsyncValidationContext \} from "@modyra\/core";/);

  const withoutServer = buildStubsModule(project({ impl_a: { id: "impl_a", role: "submitAction", displayName: "check", mode: "stub" } }));
  assert.doesNotMatch(withoutServer.code, /MdyAsyncValidationContext/);
});

test("a displayName that collides after sanitizing gets a disambiguated name and a diagnostic", () => {
  const { nameFor, diagnostics } = buildStubsModule(project({
    impl_a: { id: "impl_a", role: "submitAction", displayName: "check", mode: "stub" },
    impl_b: { id: "impl_b", role: "submitAction", displayName: "check", mode: "stub" },
  }));
  assert.equal(nameFor.get("impl_a"), "check");
  assert.notEqual(nameFor.get("impl_b"), "check");
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, "STUB_NAME_COLLISION");
});

test("a displayName that is not a valid identifier is sanitized", () => {
  const { nameFor } = buildStubsModule(project({ impl_a: { id: "impl_a", role: "submitAction", displayName: "2 do it!", mode: "stub" } }));
  const name = nameFor.get("impl_a");
  assert.match(name, /^[A-Za-z_$][A-Za-z0-9_$]*$/);
});

test("no implementations at all still produces a valid, empty module", () => {
  const { code, nameFor, diagnostics } = buildStubsModule(project({}));
  assert.equal(code, "export {};\n");
  assert.equal(nameFor.size, 0);
  assert.deepEqual(diagnostics, []);
});

test("is deterministic: stub order is sorted by implementation id regardless of object key insertion order", () => {
  const a = buildStubsModule(project({ impl_z: { id: "impl_z", role: "submitAction", displayName: "z", mode: "stub" }, impl_a: { id: "impl_a", role: "submitAction", displayName: "a", mode: "stub" } }));
  assert.ok(a.code.indexOf("function a(") < a.code.indexOf("function z("));
});
