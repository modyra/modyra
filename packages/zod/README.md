# @modyra/zod

Framework-agnostic [Zod](https://zod.dev) adapter for the Modyra form engine — schema-first typed forms.

Turns a `z.object(...)` schema into a Modyra form: field tree, initial values and validators are derived from the schema, `z.array()`s become typed field arrays, and object-level refinements become cross-field validators.

## Install

```bash
npm install @modyra/zod zod
```

`zod` is a peer dependency (`>=3.25.0`, Zod 4 supported). The adapter uses only public Zod APIs (`safeParse`, `.shape`, `instanceof ZodObject`), so it stays compatible across Zod 3.25+ and 4.x.

## Usage

```ts
import { z } from "zod";
import { createZodForm } from "@modyra/zod";

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

const form = createZodForm(schema);
```

## Arrays and refinements

```ts
const bookingSchema = z.object({
  flight: z.string().min(1, "Pick a flight"),
  passengers: z
    .array(z.object({ fullName: z.string().min(1), infant: z.boolean() }))
    .min(1, "At least one passenger"),
});

const form = createZodForm(bookingSchema);
form.f.passengers.push({ fullName: "Ada Lovelace", infant: false });
// z.array()      → typed field array (push/insert/remove/move, typed rows)
// .min(1)        → array-level validator gating form.state.valid()
// .refine(...)   → cross-field validator over the whole typed value
```

Works with any Modyra adapter: pass the schema to `createZodForm` (core),
`mdyFormFromSchema()` (`@modyra/angular/zod`), or the equivalent entry of
your framework binding.

## API

- `createZodForm(schema, options?)` — builds a Modyra form engine from a `z.ZodObject`.
- `buildZodTree(schema)` — derives the `MdyFormSchema` field tree from an object schema (nested `z.object()` → groups, `z.array()` → arrays).
- `buildZodRefinementValidator(schema)` — wraps object-level refinements (`.refine`, `.superRefine`) as a Modyra cross-field validator.
- `MdyZodSchemaTree`, `MdyZodFormOptions` — supporting types.

Async refinements (`refine(async ...)`) are not mapped — use the engine's
own [async validation](https://github.com/modyra/modyra/blob/main/docs/guides/typed-forms.md)
(`serverValidator`) for server-side checks, which adds cancellation,
debounce and `dependsOn` re-validation on top.

See the [Modyra repository](https://github.com/modyra/modyra#readme) for full documentation and guides.

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
