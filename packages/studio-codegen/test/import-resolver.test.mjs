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

test("a name that cannot be a binding is refused, not printed", () => {
  // An imported binding is a declaration, so it is the same question a stub name asks — the third
  // place this package needed `isValidBindingName`, and the second where the answer was already
  // written two files away.
  const resolver = new ImportResolver();
  resolver.add("@modyra/core", "field", "with space", "class");

  assert.equal(resolver.problems.length, 2);
  assert.ok(resolver.problems.some((p) => p.includes("with space")));
  assert.ok(resolver.problems.some((p) => p.includes("class")));
  // The name that can be a binding is still there: refusing one is not refusing the block.
  assert.equal(resolver.print(), 'import { field } from "@modyra/core";');
});

test("one binding comes from one module", () => {
  // `factoryImportSource` and `validatorsImportSource` are separate profile fields and nothing says
  // they are distinct. The shipped mapper's names happen not to overlap — factory takes
  // field/group/array, validators take the kind names — which is load-bearing and was written
  // nowhere.
  const resolver = new ImportResolver();
  resolver.add("a", "field");
  resolver.add("b", "field");

  assert.equal(resolver.problems.length, 1);
  assert.match(resolver.problems[0], /imported from both "a" and "b"/);
  assert.equal(resolver.print(), 'import { field } from "a";');
});

test("a source is printed as a string, whatever it contains", () => {
  const resolver = new ImportResolver();
  resolver.add('a"b', "field");
  assert.equal(resolver.print(), 'import { field } from "a\\"b";');
});

test("the block a mapper actually builds is unchanged", () => {
  // The known-good cases in the same run: an ordinary block compiles, the same source twice merges
  // to one line, and two sources are two lines. Two lines from one module is legal, so a check that
  // only asked "does it compile" would not notice the resolver forgetting what it is for.
  const resolver = new ImportResolver();
  resolver.add("@modyra/core", "field", "group");
  resolver.add("@modyra/core", "array");
  resolver.add("@modyra/zod", "createZodForm");

  assert.deepEqual(resolver.problems, []);
  assert.equal(
    resolver.print(),
    'import { array, field, group } from "@modyra/core";\nimport { createZodForm } from "@modyra/zod";',
  );
});
