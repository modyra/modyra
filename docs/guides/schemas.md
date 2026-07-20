# Schema adapters: Zod and Standard Schema

Two ways to connect a validation schema to a Modyra form. Pick the first
when you are all-in on Zod, the second for everything else.

| | `@modyra/zod` | `@modyra/standard-schema` |
| :-- | :-- | :-- |
| Schema libraries | Zod ≥3.25 only | Any Standard Schema v1 vendor (Zod ≥3.24, Valibot, ArkType, …) |
| Field tree | **Derived** from `z.object(...)` — nested objects → groups, `z.array()` → typed field arrays | **Declared by you** with `field()`/`group()`/`array()` |
| Defaults / `required` | Inferred from the schema | Declared in `field()`; schema defaults seed initials when `validate({})` succeeds |
| Whole-schema rules | Object `.refine()` → cross-field validator | Every issue → form error on its dotted path |
| Peer dependency | `zod` | none |

## Why the models differ

The [Standard Schema spec](https://standardschema.dev) standardizes
**validation only**: `~standard.validate(value)` → `{ value } | { issues }`.
There is no introspection API, so the adapter cannot discover fields from
the schema — it follows the same model as TanStack Form:

1. you declare the field tree (initials, sync validators, `required`);
2. the schema validates the whole form value; issues are attributed to
   their dotted field path (`address.city`, `items.0.name`), gate
   `form.state.valid()` and surface in the field's error list;
3. schema defaults seed the declared initials when the whole schema
   accepts `{}` (all top-level fields optional/defaulted).

```ts
import * as v from "valibot";
import { field } from "@modyra/core";
import { createStandardForm, MdyStandardSchemaTree } from "@modyra/standard-schema";

const schema = v.object({
  email: v.pipe(v.string(), v.email("Invalid email")),
  age: v.pipe(v.number(), v.minValue(18, "18+ only")),
});

// Opt-in: annotate with MdyStandardSchemaTree so schema/field drift
// does not compile. Leaves are `Output | null` (null = not filled in).
const fields: MdyStandardSchemaTree<typeof schema> = {
  email: field<string | null>(null),
  age: field<number | null>(18),
};

const form = createStandardForm(schema, fields);
```

The identical code works with a `z.object(...)` schema — the adapter test
suite runs against both Zod and Valibot and asserts identical results.

## Async rules

Form-level validation is synchronous, so async schemas are rejected:
fully-async schemas throw at creation time, input-dependent async branches
hold the form invalid with a clear global error. Server-side checks belong
in the engine's own async validation (`serverValidator` / field-level
`asyncValidators`), which adds cancellation, debounce and `dependsOn`
re-validation — see [Typed forms](typed-forms.md#async-validation).

## On Angular

Bind the same building blocks to the framework's reactivity:

```ts
import { mdyForm } from "@modyra/angular/adapter";
import { buildStandardTree, buildStandardValidator } from "@modyra/standard-schema";

readonly form = mdyForm(buildStandardTree(schema, fields), {
  validators: [buildStandardValidator(schema)],
});
```

## API summary

- `createStandardForm(schema, fields, options?)` — form from a declared tree + a Standard Schema.
- `buildStandardTree(schema, fields)` — declared tree with initials seeded from schema defaults.
- `buildStandardValidator(schema)` — schema as a form-level validator.
- `MdyStandardSchemaTree<TSchema>` — opt-in type-level agreement.

For the Zod adapter API see [packages/zod](../../packages/zod/README.md);
for field arrays see [Typed forms](typed-forms.md).
