# Server validation — one schema, two sides

A client-only validator is a suggestion: any request that skips your form
(curl, a bug in a different client, a malicious user) reaches your handler
unchecked. `serverValidate(schema, payload)` runs the **same** Zod or
Standard Schema definition your form already uses, and returns errors in
the exact `MdyFormError[]` shape a `form.submit()` action returns — so one
schema feeds both the client's inline errors and the server's rejection,
and one error shape flows through both.

```ts
import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  age: z.number().min(18, "18+ only"),
});
```

On the client, `createZodForm(signupSchema)` (or `@modyra/angular/zod`'s
`mdyFormFromSchema`) drives the same rules keystroke-by-keystroke. On the
server, every route below runs the identical schema through
`serverValidate` and answers `422` with the same error paths/messages the
client would have shown, or `200` once the payload is clean.

The three examples below are the literal, tested source in
[`docs/examples/server-validation/`](../examples/server-validation/) —
`npm run test:guides` runs all three against the built `@modyra/zod`
package, so nothing here is an unverified snippet.

## Next.js (App Router)

A route handler already receives/returns the standard `Request`/`Response`
— no framework glue needed:

```ts
// app/api/signup/route.ts
import { serverValidate } from "@modyra/zod";
import { signupSchema } from "./schema";

export async function POST(request: Request) {
  const payload = await request.json();
  const errors = serverValidate(signupSchema, payload);
  if (errors.length > 0) {
    return new Response(JSON.stringify({ errors }), {
      status: 422,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
```

## Express

```ts
import express from "express";
import { serverValidate } from "@modyra/zod";
import { signupSchema } from "./schema";

const app = express();
app.use(express.json());
app.post("/api/signup", (req, res) => {
  const errors = serverValidate(signupSchema, req.body);
  if (errors.length > 0) {
    res.status(422).json({ errors });
    return;
  }
  res.json({ ok: true });
});
```

## Hono

```ts
import { Hono } from "hono";
import { serverValidate } from "@modyra/zod";
import { signupSchema } from "./schema";

const app = new Hono();
app.post("/api/signup", async (c) => {
  const payload = await c.req.json();
  const errors = serverValidate(signupSchema, payload);
  if (errors.length > 0) return c.json({ errors }, 422);
  return c.json({ ok: true });
});
```

## Feeding the errors back into the client form

`serverValidate`'s return value is already what `form.submit()` expects, so
wiring a rejected response back into the form needs no extra glue:

```ts
await form.submit(async (value) => {
  const res = await fetch("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
  if (res.status === 422) return (await res.json()).errors; // MdyFormError[]
});
```

## Standard Schema (Valibot, ArkType, …)

`@modyra/standard-schema` exports the same function, `async` — the
Standard Schema spec allows `~standard.validate` to return a `Promise`,
and unlike the library's sync form-level validator (which rejects async
schemas up front — see [Schema adapters](schemas.md)), a server call is
free to await one:

```ts
import { serverValidate } from "@modyra/standard-schema";

const errors = await serverValidate(signupSchema, payload);
```

## Why no `applyServerErrors()` helper

`form.submit(action)` already accepts any `action` that returns
`MdyFormError[]` — including one that calls `serverValidate` directly
against a local schema instead of a network round-trip (useful for a
same-process SSR action). There is no separate glue method: `submit()` is
already the single entry point that stores returned errors and surfaces
them through `errorsFor()`.
