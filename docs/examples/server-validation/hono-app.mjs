// Hono route — same schema, same serverValidate call.
import { Hono } from "hono";
import { serverValidate } from "@modyra/zod";
import { signupSchema } from "./schema.mjs";

export function createApp() {
  const app = new Hono();
  app.post("/api/signup", async (c) => {
    const payload = await c.req.json();
    const errors = serverValidate(signupSchema, payload);
    if (errors.length > 0) return c.json({ errors }, 422);
    return c.json({ ok: true });
  });
  return app;
}
