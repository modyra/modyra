import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { POST as nextSignup } from "./next-route.mjs";
import { createApp as createExpressApp } from "./express-app.mjs";
import { createApp as createHonoApp } from "./hono-app.mjs";

const BAD_PAYLOAD = { email: "not-an-email", age: 10 };
const GOOD_PAYLOAD = { email: "a@b.co", age: 20 };

test("Next.js route handler: forged payload rejected, valid payload accepted", async () => {
  const rejected = await nextSignup(
    new Request("http://localhost/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(BAD_PAYLOAD),
    }),
  );
  assert.equal(rejected.status, 422);
  assert.deepEqual(
    (await rejected.json()).errors.map((e) => e.path),
    ["email", "age"],
  );

  const accepted = await nextSignup(
    new Request("http://localhost/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(GOOD_PAYLOAD),
    }),
  );
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { ok: true });
});

test("Express route: forged payload rejected, valid payload accepted", async () => {
  const server = createServer(createExpressApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const url = `http://localhost:${port}/api/signup`;

  try {
    const rejected = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(BAD_PAYLOAD),
    });
    assert.equal(rejected.status, 422);
    assert.deepEqual(
      (await rejected.json()).errors.map((e) => e.path),
      ["email", "age"],
    );

    const accepted = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(GOOD_PAYLOAD),
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { ok: true });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Hono route: forged payload rejected, valid payload accepted", async () => {
  const app = createHonoApp();

  const rejected = await app.request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(BAD_PAYLOAD),
  });
  assert.equal(rejected.status, 422);
  assert.deepEqual(
    (await rejected.json()).errors.map((e) => e.path),
    ["email", "age"],
  );

  const accepted = await app.request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(GOOD_PAYLOAD),
  });
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { ok: true });
});
