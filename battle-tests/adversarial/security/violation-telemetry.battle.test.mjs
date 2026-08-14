/**
 * The four things a form says it intercepted.
 *
 * `onViolation` is how an application learns that the engine dropped or changed something on its
 * behalf, and the contract names four kinds: `sanitized`, `max-length`, `draft-shape`, `error-path`.
 * Each has a different trigger and each is the only evidence of an interception that is otherwise
 * invisible by design — the point of dropping a hostile draft entry is that nothing downstream ever
 * sees it.
 *
 * A kind that stops firing is therefore a silent loss: the form keeps protecting the application and
 * stops telling it, and the first sign is an incident nobody has a log line for. So all four are
 * driven here, with the path each reports, because a report naming the wrong path is a log a person
 * cannot act on.
 *
 * The hostile draft is built by writing one with the engine and editing a single entry of it. A
 * hand-built envelope fails as an envelope — this battle's first version did, and reported
 * `draft-shape` against `value` and `savedAt`, the envelope's own keys, which looks exactly like the
 * defect it would have reported.
 *
 * Last, the promise that makes the hook safe to install: a telemetry pipeline that throws cannot
 * break a form. The write still lands and the value is still sanitised.
 */

import { createForm, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { buildSchema } from "../../models/schemas.mjs";

const SPEC = Object.freeze({
  version: 1,
  fields: Object.freeze({
    note: Object.freeze({ kind: "text", initial: "" }),
    count: Object.freeze({ kind: "number", initial: 0 }),
  }),
});

/** A bidi override, which the "text" profile is documented to strip. */
const OVERRIDE = "a‮b";

const settled = () => new Promise((resolve) => setTimeout(resolve, 40));

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

function watched(security = {}, extra = {}) {
  const seen = [];
  const form = createForm(buildSchema(SPEC).schema, {
    reactivity: vanillaReactivity(),
    devWarnings: false,
    security: { onViolation: (violation) => seen.push(violation), ...security },
    ...extra,
  });
  return { form, seen };
}

battle(
  {
    claims: ["SEC-001", "SEC-002"],
    title: "every kind of interception the contract names is reported, against the path it happened at",
    environments: ["node"],
  },
  async (ctx) => {
    const reported = new Map();

    // sanitized — a value the profile changed on its way in.
    {
      const { form, seen } = watched({ sanitize: "text" });
      form.f.note.set(OVERRIDE);
      ctx.log.note("a sanitised write", { seen: seen.map((each) => `${each.kind}@${each.path}`) });
      for (const violation of seen) reported.set(violation.kind, violation);

      expectEqual(form.getValue().note, "ab", {
        claimIds: ["SEC-001"],
        what: "the profile did not strip what it declares it strips, so nothing was intercepted",
      });
      form.destroy();
    }

    // max-length — a string longer than the form allows.
    {
      const { form, seen } = watched({ sanitize: "text", maxValueLength: 5 });
      form.f.note.set("far too long to keep");
      for (const violation of seen) reported.set(violation.kind, violation);

      expectEqual(form.getValue().note, "far t", {
        claimIds: ["SEC-001"],
        what: "a string past the limit was not truncated",
      });
      form.destroy();
    }

    // draft-shape — a stored entry whose type the field cannot hold. The envelope is the engine's
    // own, with one entry replaced: an invented envelope fails as an envelope instead.
    {
      const storage = memoryStorage();
      const draft = { key: "d", storage, debounceMs: 5 };
      const honest = createForm(buildSchema(SPEC).schema, {
        reactivity: vanillaReactivity(),
        devWarnings: false,
        draft,
      });
      honest.f.note.set("typed");
      honest.f.count.set(7);
      await settled();
      honest.destroy();

      const envelope = JSON.parse(storage.written.get("d"));
      envelope.value.note = { evil: true };
      storage.written.set("d", JSON.stringify(envelope));

      const { form, seen } = watched({}, { draft });
      await settled();
      ctx.log.note("a hostile draft entry", {
        restored: form.getValue(),
        seen: seen.map((each) => `${each.kind}@${each.path}`),
      });
      for (const violation of seen) reported.set(violation.kind, violation);

      // Only the offending entry is dropped: a draft that loses everything because one entry was
      // hostile costs the user work the attacker never touched.
      expectEqual(form.getValue().count, 7, {
        claimIds: ["SEC-001"],
        what: "a draft lost an entry nothing was wrong with",
      });
      expectEqual(form.getValue().note, "", {
        claimIds: ["SEC-001"],
        what: "the hostile draft entry reached the field",
      });
      form.destroy();
    }

    // error-path — a server error naming a path that would pollute a prototype.
    {
      const { form, seen } = watched({});
      form.f.note.set("something");
      await form.submit(async () => [{ path: "__proto__.polluted", message: "hostile" }]);
      for (const violation of seen) reported.set(violation.kind, violation);

      expectClaim(({}).polluted === undefined, {
        claimIds: ["SEC-001"],
        what: "a server error path reached Object.prototype",
      });
      form.destroy();
    }

    // All four, and each naming where it happened. A report against the wrong path is a log line a
    // person cannot act on, which is the same as not having one.
    for (const [kind, path] of [
      ["sanitized", "note"],
      ["max-length", "note"],
      ["draft-shape", "note"],
      ["error-path", "__proto__.polluted"],
    ]) {
      const violation = reported.get(kind);
      expectClaim(violation !== undefined, {
        claimIds: ["SEC-002"],
        what: `nothing reported a ${kind} interception, so an application cannot know it happened`,
        detail: JSON.stringify([...reported.keys()]),
      });

      expectEqual(violation?.path, path, {
        claimIds: ["SEC-002"],
        what: `a ${kind} interception was reported against a path it did not happen at`,
        detail: JSON.stringify(violation ?? null),
      });

      expectClaim(typeof violation?.detail === "string" && violation.detail.length > 0, {
        claimIds: ["SEC-002"],
        what: `a ${kind} interception was reported with nothing a person could read`,
        detail: JSON.stringify(violation ?? null),
      });
    }
  },
);

battle(
  {
    claims: ["SEC-002", "LIF-001"],
    title: "a telemetry pipeline that is down cannot break a form",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm(buildSchema(SPEC).schema, {
      reactivity: vanillaReactivity(),
      devWarnings: false,
      security: {
        sanitize: "text",
        onViolation: () => {
          throw new Error("telemetry is down");
        },
      },
    });

    // The hook is installed by an application and runs inside a write. If it can throw through, the
    // form a user is typing into stops working because a logging endpoint did.
    let raised = null;
    try {
      form.f.note.set(OVERRIDE);
    } catch (error) {
      raised = error;
    }
    ctx.log.note("a write whose telemetry threw", {
      raised: raised === null ? null : String(raised.message),
      value: form.getValue().note,
    });

    expectEqual(raised, null, {
      claimIds: ["LIF-001", "SEC-002"],
      what: "a throwing telemetry hook broke the write it was watching",
    });

    // And the interception still happened: swallowing the report must not mean skipping the work.
    expectEqual(form.getValue().note, "ab", {
      claimIds: ["SEC-001", "SEC-002"],
      what: "a throwing telemetry hook took the sanitisation down with it",
    });

    form.destroy();
  },
);
