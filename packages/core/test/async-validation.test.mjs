/**
 * Async server validation: cancellation, form context, dependsOn, timeout,
 * when, destroy, and backward compatibility.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createForm, field, group, serverValidator } from "../dist/index.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("ctx.signal aborts the superseded run (last-wins)", async () => {
  const signals = [];
  const form = createForm({
    user: field("", [], {
      asyncValidators: [
        async (v, ctx) => {
          signals.push(ctx.signal);
          await tick();
          return v === "taken" ? ["Name taken"] : [];
        },
      ],
    }),
  });
  await tick(); // initial run

  form.f.user.set("first");
  await tick();
  form.f.user.set("taken");
  await tick();
  await tick();
  await tick();

  assert.equal(signals.length >= 2, true);
  assert.equal(signals[signals.length - 2].aborted, true);
  assert.equal(signals[signals.length - 1].aborted, false);
});

test("an abort does not produce a validation error", async () => {
  const form = createForm({
    user: field("", [], {
      asyncValidators: [
        async (v, ctx) => {
          await new Promise((resolve, reject) => {
            ctx.signal.addEventListener("abort", () => reject(new Error("aborted")));
            setTimeout(resolve, 20);
          });
          // Only the superseded run ("a") would report an error; if abort
          // suppression fails, this leaks into the final errors() below.
          return v === "a" ? ["Name taken"] : [];
        },
      ],
    }),
  });
  await tick();
  form.f.user.set("a");
  await tick();
  form.f.user.set("b"); // supersedes the first run before it settles
  await new Promise((r) => setTimeout(r, 30));

  assert.deepEqual(form.f.user.errors(), []);
});

test("ctx.form.fieldValue reads a sibling field", async () => {
  const form = createForm({
    country: field("IT"),
    phone: field("", [], {
      asyncValidators: [
        async (v, ctx) => {
          const country = ctx.form.fieldValue("country");
          return country === "IT" && v === "000" ? ["Invalid for IT"] : [];
        },
      ],
    }),
  });
  await tick();
  form.f.phone.set("000");
  await tick();
  await tick();
  assert.deepEqual(
    form.f.phone.errors().map((e) => e.message),
    ["Invalid for IT"],
  );
});

test("dependsOn re-runs the async validator when the dependency changes", async () => {
  let calls = 0;
  const form = createForm({
    country: field("IT"),
    phone: field("000", [], {
      asyncValidators: [
        async (v, ctx) => {
          calls++;
          const country = ctx.form.fieldValue("country");
          return country === "IT" ? ["Invalid for IT"] : [];
        },
      ],
      asyncDependsOn: ["country"],
    }),
  });
  await tick();
  const callsAfterInitial = calls;

  form.f.country.set("FR"); // phone value unchanged
  await tick();
  await tick();

  assert.equal(calls > callsAfterInitial, true);
  assert.deepEqual(form.f.phone.errors(), []);
});

test("timeoutMs settles pending with kind async-timeout", async () => {
  const form = createForm({
    user: field("", [], {
      asyncValidators: [async () => new Promise(() => {})], // never resolves
      asyncTimeoutMs: 20,
    }),
  });
  await tick();
  form.f.user.set("x");
  await tick();
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(form.f.user.pending(), false);
  assert.deepEqual(
    form.f.user.errors().map((e) => e.kind),
    ["async-timeout"],
  );
});

test("when=false skips the call and pending never turns true", async () => {
  let invoked = false;
  const form = createForm({
    phone: field("", [], {
      asyncValidators: [
        async () => {
          invoked = true;
          return [];
        },
      ],
      asyncWhen: (v) => /^\d{3}$/.test(v),
    }),
  });
  await tick();
  form.f.phone.set("ab");
  await tick();
  await tick();

  assert.equal(invoked, false);
  assert.equal(form.f.phone.pending(), false);
});

test("form.destroy() aborts an in-flight run", async () => {
  let sawAbort = false;
  const form = createForm({
    user: field("", [], {
      asyncValidators: [
        async (v, ctx) => {
          await new Promise((resolve) => {
            ctx.signal.addEventListener("abort", () => {
              sawAbort = true;
              resolve();
            });
          });
          return ["Name taken"];
        },
      ],
    }),
  });
  await tick();
  form.f.user.set("x");
  await tick();
  form.destroy();
  await tick();

  assert.equal(sawAbort, true);
});

test("backward compat: single-argument validator behaves as before", async () => {
  const form = createForm({
    user: field("", [], {
      asyncValidators: [async (v) => (v === "taken" ? ["Name taken"] : [])],
    }),
  });
  await tick();
  form.f.user.set("taken");
  await tick();
  await tick();
  assert.deepEqual(
    form.f.user.errors().map((e) => e.message),
    ["Name taken"],
  );
  form.f.user.set("free");
  await tick();
  await tick();
  assert.deepEqual(form.f.user.errors(), []);
});

test("serverValidator factory produces a working field option", async () => {
  const form = createForm({
    email: field("", [], serverValidator(async (v) => (v === "taken@x.com" ? "Email taken" : null), {
      debounceMs: 0,
    })),
  });
  await tick();
  form.f.email.set("taken@x.com");
  await tick();
  await tick();
  assert.deepEqual(
    form.f.email.errors().map((e) => e.message),
    ["Email taken"],
  );
});
