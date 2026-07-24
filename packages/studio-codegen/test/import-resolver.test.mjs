/**
 * Plan section 10 gate: "collects, deduplicates, sorts" — and the P8 gate
 * "no unused imports" depends on this never emitting a name nobody added.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ImportResolver } from "../dist/index.js";

test("collects names per source and prints one import per source", () => {
  const resolver = new ImportResolver();
  resolver.add("@modyra/core", "createForm", "field");
  resolver.add("@modyra/core", "required");
  resolver.add("./stubs.js", "createOrder");

  assert.equal(
    resolver.print(),
    'import { createOrder } from "./stubs.js";\nimport { createForm, field, required } from "@modyra/core";',
  );
});

test("deduplicates repeated names from the same source", () => {
  const resolver = new ImportResolver();
  resolver.add("@modyra/core", "required");
  resolver.add("@modyra/core", "required");
  assert.equal(resolver.print(), 'import { required } from "@modyra/core";');
});

test("sources and names are both sorted, independent of add() order", () => {
  const resolver = new ImportResolver();
  resolver.add("./z.js", "z");
  resolver.add("@modyra/core", "min", "email", "required");
  assert.equal(
    resolver.print(),
    'import { z } from "./z.js";\nimport { email, min, required } from "@modyra/core";',
  );
});

test("an empty resolver prints an empty string", () => {
  assert.equal(new ImportResolver().print(), "");
});
