/**
 * The one place a security policy is told about a value it had to cut.
 *
 * `security: { sanitize, maxValueLength, onViolation }` is a policy, and `onViolation` is the only
 * channel it has: a consumer wiring it to their telemetry learns that a value arrived over the limit
 * and was cut. What that channel is worth depends entirely on how many doors it stands at — a policy
 * that hears about a `set` and not about a restored draft reports a clean origin while the hostile
 * one goes past it.
 *
 * Every public door into a value is here, and the draft is deliberately last: it is the one the
 * security guide names as the threat model in those words — a draft lives where every script on the
 * origin can write it — and the one where a violation matters most and is easiest to miss.
 *
 * This battle is green. It exists because a ninth door added later would pass every other test in
 * this suite while being invisible to the policy, and because nothing else asserts that the channel
 * is complete rather than merely present.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 80));
const saved = () => new Promise((resolve) => setTimeout(resolve, 760));

/** Longer than the limit the policy declares, so every door has the same thing to refuse. */
const LIMIT = 10;
const TOO_LONG = "x".repeat(50);
const CUT = "x".repeat(LIMIT);

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

/** Drive one door and report what the policy heard and what the form kept. */
async function through(act, options = {}) {
  const heard = [];
  const form = createForm(
    {
      a: field(""),
      rows: record(group({ code: field("") }), { initial: { r1: { code: "" } } }),
    },
    {
      devWarnings: false,
      security: { maxValueLength: LIMIT, onViolation: (violation) => heard.push(violation) },
      ...options,
    },
  );
  await act(form);
  await settled();
  const value = form.getValue();
  form.destroy();
  return { heard, value };
}

battle(
  {
    claims: ["SEC-001", "SEC-003"],
    title: "every door into a value is a door the policy is told about",
    environments: ["node"],
  },
  async (ctx) => {
    const doors = [
      ["field.set", (form) => form.f.a.set(TOO_LONG), (value) => value.a],
      ["patch", (form) => form.patch({ a: TOO_LONG }), (value) => value.a],
      ["setValue", (form) => form.setValue({ a: TOO_LONG, rows: { r1: { code: "" } } }), (value) => value.a],
      ["a cell of a row", (form) => form.f.rows.row("r1").code.set(TOO_LONG), (value) => value.rows.r1.code],
      ["upsert a new row", (form) => form.f.rows.upsert("r2", { code: TOO_LONG }), (value) => value.rows.r2.code],
      ["patch a row", (form) => form.f.rows.patch({ r1: { code: TOO_LONG } }), (value) => value.rows.r1.code],
      ["setInitialValue then reset", (form) => {
        form.setInitialValue("a", TOO_LONG);
        form.reset();
      }, (value) => value.a],
    ];

    const silent = [];
    const uncut = [];
    for (const [name, act, read] of doors) {
      const outcome = await through(act);
      const kept = read(outcome.value);
      ctx.log.note("a value over the limit, through one door", {
        door: name,
        heard: outcome.heard.map((each) => each.code ?? each.kind ?? "unnamed"),
        kept,
      });
      if (outcome.heard.length === 0) silent.push(name);
      if (kept !== CUT) uncut.push({ door: name, kept });
    }

    // The control: a value inside the limit is not a violation, so what is asserted above is the
    // length rather than the policy reporting every write.
    const ordinary = await through((form) => form.f.a.set("short"));
    expectEqual([ordinary.heard.length, ordinary.value.a], [0, "short"], {
      claimIds: ["SEC-001"],
      what: "a value within the limit was reported as a violation, or was changed",
      detail: JSON.stringify(ordinary),
    });

    expectEqual(silent, [], {
      claimIds: ["SEC-001"],
      what: "a door let an over-long value in without the policy being told",
    });

    expectEqual(uncut, [], {
      claimIds: ["SEC-003"],
      what: "a door kept a value longer than the policy allows",
    });

    // And the door the security guide names as the threat model: a draft is where every script on
    // the origin can write, so a policy that does not stand here stands nowhere that matters.
    const storage = memoryStorage();
    const heard = [];
    const options = {
      devWarnings: false,
      security: { maxValueLength: LIMIT, onViolation: (violation) => heard.push(violation) },
      draft: { key: "hostile", storage },
    };

    const honest = createForm({ a: field("") }, options);
    honest.f.a.set("ok");
    await saved();
    const envelope = JSON.parse(storage.written.get("hostile"));
    envelope.value.a = TOO_LONG;
    storage.written.set("hostile", JSON.stringify(envelope));
    honest.destroy();

    const reopened = createForm({ a: field("") }, options);
    await settled();
    await settled();
    const restored = reopened.getValue().a;
    reopened.destroy();
    ctx.log.note("a draft somebody rewrote in storage", { heard: heard.length, restored });

    expectEqual([heard.length > 0, restored], [true, CUT], {
      claimIds: ["SEC-001", "SEC-003"],
      what: "a hostile draft carried a value past the policy, or past it without the policy being told",
      detail: JSON.stringify({ heard, restored }),
    });
  },
);
