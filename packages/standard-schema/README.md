# @modyra/standard-schema

Framework-agnostic [Standard Schema](https://standardschema.dev) adapter for the Modyra form engine — one adapter for every Standard Schema v1 library: **Zod ≥3.24, Valibot, ArkType** and any other vendor implementing the spec.

## Install

```bash
npm install @modyra/standard-schema
# plus your schema library of choice, e.g.: npm install valibot
```

There are no peer dependencies: the schema is yours, the adapter only relies on the structural `~standard` interface (it never imports a vendor package).

## The model (read this first)

The Standard Schema spec standardizes **validation only** — there is no introspection API to discover fields. So this adapter follows the same model as TanStack Form:

- **you declare the field tree** with `field()` / `group()` / `array()` — initial values, sync validators, `required` flags;
- **the schema validates the whole form value** through a form-level validator, and every issue is attributed to its dotted field path (`address.city`, `items.0.name`), gating `form.state.valid()` and surfacing in the field's error list;
- when `validate({})` succeeds, its output **seeds the matching field initials** (schema-level defaults).

If you want full schema-driven derivation (tree, defaults and `required` flags inferred from the schema), use the introspecting [`@modyra/zod`](../zod/README.md) adapter instead.

## Usage

```ts
import * as v from "valibot";
import { field, group } from "@modyra/core";
import { createStandardForm } from "@modyra/standard-schema";

const schema = v.object({
  email: v.pipe(v.string(), v.email("Invalid email")),
  age: v.pipe(v.number(), v.minValue(18, "18+ only")),
});

const form = createStandardForm(schema, {
  email: field<string | null>(null),
  age: field(18),
});

form.f.email.set("not-an-email");
form.f.email.errors(); // ["Invalid email"] — issue from the Valibot schema
form.state.valid();    // false
```

The identical code works with a Zod schema (`z.object({...})`) — the adapter tests run the same suite against both vendors and assert identical results.

### Schema defaults

When every top-level field is optional or defaulted, `validate({})` succeeds and its output seeds the declared initials:

```ts
const schema = v.object({
  name: v.optional(v.string(), "Ada"),
  tags: v.optional(v.array(v.string()), ["news"]),
});

const form = createStandardForm(schema, {
  name: field(""),        // → initial "Ada"
  tags: array(field("")), // → initial ["news"]
});
```

Schemas with at least one required top-level field reject `{}` wholesale — declare initials in `field()` as usual.

### Type-level agreement (opt-in)

Annotate the declared tree with `MdyStandardSchemaTree` so a drift between schema and fields does not compile. Leaves are typed `Output | null` (`null` = not filled in yet — the schema rejects it for required pieces, same convention as the Zod adapter):

```ts
const fields: MdyStandardSchemaTree<typeof schema> = {
  email: field<string | null>(null),
  age: field<number | null>(18),
};
```

### Async schemas

Form-level validation in the engine is synchronous, so async schemas are **not supported**: schemas that are async for every input throw at creation time; schemas whose async branch is only reached for valid input hold the form invalid with a clear global error. Move server-side rules to the engine's async validation (`serverValidator` / field-level `asyncValidators`), which adds cancellation, debounce and `dependsOn` re-validation.

## API

- `createStandardForm(schema, fields, options?)` — builds a Modyra form from a declared tree + a Standard Schema.
- `buildStandardTree(schema, fields)` — returns the declared tree with initials seeded from the schema's defaults.
- `buildStandardValidator(schema)` — wraps the schema as a Modyra form-level validator.
- `MdyStandardSchemaV1`, `MdyStandardSchemaTree`, `MdyStandardFormOptions`, `MdyStandardInput`, `MdyStandardOutput` — supporting types.

Works with any Modyra adapter: `createStandardForm` runs anywhere (Node included); on Angular bind the same building blocks to the framework's reactivity instead:

```ts
import { mdyForm } from "@modyra/angular/adapter";
import { buildStandardTree, buildStandardValidator } from "@modyra/standard-schema";

readonly form = mdyForm(buildStandardTree(schema, fields), {
  validators: [buildStandardValidator(schema)],
});
```
