# @modyra/zod

Framework-agnostic [Zod](https://zod.dev) adapter for the Modyra form engine — schema-first typed forms.

Turns a `z.object(...)` schema into a Modyra form: field tree, initial values and validators are derived from the schema, and object-level refinements become cross-field validators.

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

## API

- `createZodForm(schema, options?)` — builds a Modyra form engine from a `z.ZodObject`.
- `buildZodTree(schema)` — derives the `MdyFormSchema` field tree from an object schema.
- `buildZodRefinementValidator(schema)` — wraps object-level refinements (`.refine`, `.superRefine`) as a Modyra cross-field validator.
- `MdyZodSchemaTree`, `MdyZodFormOptions` — supporting types.

See the [Modyra repository](https://github.com/modyra/modyra#readme) for full documentation and guides.

## License

MIT
