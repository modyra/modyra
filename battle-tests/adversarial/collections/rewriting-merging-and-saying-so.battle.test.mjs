/**
 * Four sentences of contract about writing to a collection, and the calls it refuses out loud.
 *
 * The guide states the whole of it in a paragraph: `upsert(key, value)` **rewrites** — a field the
 * value does not name goes back to the initial its schema declares — while `patch({ [key]: partial })`
 * **merges**, leaving the other fields alone. *What the user did — `touched`, `dirty` — survives
 * both.* And in development the collection reports the calls that could not do anything, naming three
 * of them.
 *
 * Nothing in this suite held any of it, and everything else about collections is built on top: a
 * renderer that reads `dirty` to decide whether to warn before leaving, a form that writes a server's
 * response back with `patch` and expects the user's half-finished edits to stay.
 *
 * The dev warnings are the counterpoint to this campaign's largest family. Findings 60 to 65 were
 * about doors that could not do what they were asked and said nothing — and the collection, where
 * that habit was designed in, says something every time. The vocabulary those findings asked for
 * already existed one call away, and this is where.
 */

import { createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

/** A row with two cells and two initials, so "went back to its initial" is distinguishable. */
const openRows = () =>
  createForm(
    { rows: record(group({ a: field("ia"), b: field("ib") }), { initial: { r1: { a: "va", b: "vb" } } }) },
    { devWarnings: true },
  );

const rowState = (form) => {
  const row = form.f.rows.row("r1");
  return { a: row.a.value(), b: row.b.value(), touched: row.a.touched(), dirty: row.a.dirty() };
};

/** Whatever the collection says while one call runs. */
async function saying(form, act) {
  const said = [];
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...parts) => said.push(parts.join(" "));
  console.error = (...parts) => said.push(parts.join(" "));
  try {
    act(form);
  } catch (error) {
    said.push(`threw: ${error.message}`);
  } finally {
    console.warn = realWarn;
    console.error = realError;
  }
  await settled();
  return said;
}

battle(
  {
    claims: ["COL-002", "COL-007"],
    title: "upsert rewrites, patch merges, and what the user did survives both",
    environments: ["node"],
  },
  async (ctx) => {
    const rewritten = openRows();
    rewritten.f.rows.row("r1").a.markAsTouched();
    rewritten.f.rows.row("r1").a.markAsDirty();
    await settled();

    // The control: the row starts where the schema and the initial value put it, and the user has
    // been there. Without this, "survives" below could be true of state that was never set.
    expectEqual(rowState(rewritten), { a: "va", b: "vb", touched: true, dirty: true }, {
      claimIds: ["COL-002"],
      what: "the row did not start where the initial value and the user left it",
    });

    rewritten.f.rows.upsert("r1", { a: "new" });
    await settled();
    ctx.log.note("after an upsert that names one of two cells", rowState(rewritten));

    // Rewrites: the cell it named takes the value, the cell it did not goes back to its schema's
    // initial — not to what it held, and not to empty.
    expectEqual(rowState(rewritten), { a: "new", b: "ib", touched: true, dirty: true }, {
      claimIds: ["COL-007"],
      what: "an upsert did not rewrite the row, or lost what the user had done to it",
    });
    rewritten.destroy();

    const merged = openRows();
    merged.f.rows.row("r1").a.markAsTouched();
    merged.f.rows.row("r1").a.markAsDirty();
    await settled();
    merged.f.rows.patch({ r1: { a: "merged" } });
    await settled();
    ctx.log.note("after a patch that names one of two cells", rowState(merged));

    // Merges: the cell it did not name is left exactly alone.
    expectEqual(rowState(merged), { a: "merged", b: "vb", touched: true, dirty: true }, {
      claimIds: ["COL-007"],
      what: "a patch did not merge, or lost what the user had done to the row",
    });
    merged.destroy();
  },
);

battle(
  {
    claims: ["API-001", "COL-002"],
    title: "a collection says which of its calls could not do anything",
    environments: ["node"],
  },
  async (ctx) => {
    // The control first: a call that works says nothing, so each report below is the call rather than
    // a collection that narrates everything.
    const quiet = openRows();
    const nothingSaid = await saying(quiet, (form) => form.f.rows.patch({ r1: { a: "ok" } }));
    quiet.destroy();

    expectEqual(nothingSaid, [], {
      claimIds: ["API-001"],
      what: "a patch that worked was reported, so a report is not what separates a call that did nothing",
      detail: JSON.stringify(nothingSaid),
    });

    for (const [what, act, mentions] of [
      ["a cell() path the row does not have", (form) => form.f.rows.cell?.("r1.nope"), "addresses nothing"],
      ["a rename onto a key already taken", (form) => {
        form.f.rows.upsert("r2", {});
        form.f.rows.rename("r1", "r2");
      }, "already names a row"],
      ["a patch whose row value is not an object", (form) => form.f.rows.patch({ r1: "nope" }), "ignored a string"],
      ["setAll handed something that is not an object", (form) => form.f.rows.setAll("nope"), "ignored a string"],
    ]) {
      const form = openRows();
      const said = await saying(form, act);
      form.destroy();
      ctx.log.note("a call that could not do anything", { what, said });

      expectClaim(said.some((line) => line.includes("[modyra]") && line.includes(mentions)), {
        claimIds: ["API-001"],
        what: `${what} was not reported, or was reported without saying what it could not do`,
        detail: JSON.stringify(said),
      });

      // And each names the collection it was called on, which is what makes a report actionable in a
      // form with more than one.
      expectClaim(said.some((line) => line.includes("rows")), {
        claimIds: ["COL-002"],
        what: `${what} was reported without naming the collection it was called on`,
        detail: JSON.stringify(said),
      });
    }
  },
);
