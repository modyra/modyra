// app/api/signup/route.ts — Next.js App Router route handler.
// Uses only the standard Request/Response the App Router already hands you;
// no Next.js dependency needed to run or test this file.
import { serverValidate } from "@modyra/zod";
import { signupSchema } from "./schema.mjs";

export async function POST(request) {
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
