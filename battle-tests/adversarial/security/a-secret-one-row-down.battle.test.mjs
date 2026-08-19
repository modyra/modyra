/**
 * A field that says it is a secret, declared one row down.
 *
 * ADR 0089 makes `sensitive` a statement about the value, honoured everywhere the value would
 * otherwise be copied: the draft leaves it out of storage, the devtools panel masks it without
 * needing the name to look like a password, and `form.sensitivePaths()` publishes the list so a
 * consumer can honour it too. Declared once, where the field is written.
 *
 * A row of a collection is where a form keeps the fields most likely to carry one. A card per row
 * and a CVV in it; a beneficiary per row and a tax number in it; a user per row and a token in it.
 * The row is a template, declared once and instantiated per key, which is exactly the arrangement
 * that makes declaring the flag once worthwhile.
 *
 * The flag does not cross that boundary. The same declaration, on the same kind of field, with a
 * name carrying nothing a guess could catch:
 *
 *                          panel        sensitivePaths()   draft
 *   answer                 •••          listed             withheld
 *   inGroup.answer         •••          listed             withheld
 *   rows.a.answer          in clear     absent             written in clear
 *   list.0.answer          in clear     absent             written in clear
 *
 * The first two lines are this battle's control: the mechanism works, and works through a group, so
 * what fails is the collection boundary rather than the feature.
 *
 * The name matters to the measurement. A panel also guesses from names — a field called `cvv` or
 * `number` inside a row *is* masked — so a secret with an ordinary name is the only way to see that
 * the declaration itself is not arriving. `answer` is that name.
 *
 * Worst of the three is the draft, because it is the one that persists, and because of *how* it
 * fails. It withholds by **leaf name** rather than by path, so what a row's secret gets depends on
 * whether some other field happens to share its name:
 *
 *   root `answer` sensitive, row `answer` sensitive   row's secret withheld — by coincidence
 *   root `token`  sensitive, row `answer` sensitive   row's secret written in clear
 *   root `answer` sensitive, row `answer` ORDINARY    row's ordinary value withheld
 *
 * Both directions are wrong and the third is the one that proves the mechanism: an ordinary cell is
 * dropped from the draft because an unrelated field elsewhere is a secret, so a person restoring
 * their work finds a column of it missing. And the protection in the first line is the worst kind —
 * it holds in a test where the names line up and fails in an application where they do not.
 *
 * The second battle below is that measurement, kept separate because it is a different claim: not
 * *the flag does not reach a row* but *what reaches a row is the name, not the declaration*.
 */

import { array, createForm, field, group, record } from "@modyra/core";
import { mdyFormSnapshot } from "@modyra/core/devtools";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SECRET = "THE SECRET";

/** A storage that keeps what it was given, so what reached it can be read back verbatim. */
function watchedStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => {
      written.set(key, value);
    },
    remove: (key) => {
      written.delete(key);
    },
  };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 200));
const saved = () => new Promise((resolve) => setTimeout(resolve, 900));

battle(
  {
    claims: ["SEC-005", "SEC-002", "COL-001"],
    title: "a field that says it is a secret is treated as one wherever it is declared",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = watchedStorage();
    const form = createForm(
      {
        // An ordinary field, so the draft has something to save whatever else is withheld.
        label: field(""),
        answer: field("", [], { sensitive: true }),
        inGroup: group({ answer: field("", [], { sensitive: true }) }),
        rows: record(group({ label: field(""), answer: field("", [], { sensitive: true }) })),
        list: array(group({ label: field(""), answer: field("", [], { sensitive: true }) })),
      },
      { draft: { key: "k", storage }, devWarnings: false },
    );

    try {
      await settled();
      form.f.label.set("an ordinary answer");
      form.f.answer.set(SECRET);
      form.f.inGroup.answer.set(SECRET);
      form.f.rows.upsert("a", { label: "a row", answer: SECRET });
      form.f.list.push({ label: "an item", answer: SECRET });
      await saved();

      const envelope = storage.written.get("k");
      const draft = envelope ? JSON.parse(envelope).value : {};
      const panel = mdyFormSnapshot(form).fields ?? [];
      const listed = new Set(form.sensitivePaths());

      const WHERE = ["answer", "inGroup.answer", "rows.a.answer", "list.0.answer"];
      const observed = WHERE.map((path) => ({
        path,
        panelShows: panel.find((row) => row.path === path)?.value,
        listed: listed.has(path),
        inDraft: Object.hasOwn(draft, path) ? draft[path] : null,
      }));
      ctx.log.note("the same declaration, in four places", { observed, draftKeys: Object.keys(draft) });

      // The control, and it is the whole reason this reads as a boundary rather than as a feature
      // that does not work: the draft saved something, and the mechanism holds at the root and
      // through a group.
      expectClaim(envelope !== undefined && Object.keys(draft).length > 0, {
        claimIds: ["SEC-005"],
        what: "no draft was written at all, so nothing below is about what a draft withholds",
      });

      const shallow = observed.filter((row) => !row.path.includes(".a.") && !row.path.includes(".0."));
      expectClaim(
        shallow.every((row) => row.listed && row.inDraft === null && row.panelShows !== SECRET),
        {
          claimIds: ["SEC-005"],
          what: "the flag does not work even at the root, so this battle is measuring the feature rather than the boundary",
          detail: JSON.stringify(shallow),
        },
      );

      // The secret is never written down.
      expectEqual(
        observed.filter((row) => row.inDraft === SECRET).map((row) => row.path),
        [],
        {
          claimIds: ["SEC-005"],
          what: "a field declared sensitive was autosaved to storage in clear, where it outlives the session",
        },
      );

      // The panel masks it without being told what it looks like.
      expectEqual(
        observed.filter((row) => row.panelShows === SECRET).map((row) => row.path),
        [],
        {
          claimIds: ["SEC-002"],
          what: "the panel printed a field declared sensitive",
        },
      );

      // And the list a consumer honours names it.
      expectEqual(
        observed.filter((row) => !row.listed).map((row) => row.path),
        [],
        {
          claimIds: ["SEC-005", "COL-001"],
          what: "a field declared sensitive is missing from sensitivePaths(), so a consumer honouring that list copies it",
        },
      );
    } finally {
      form.destroy();
    }
  },
);

/** One schema, driven, reporting only what the draft ended up holding. */
async function draftOf(schema, drive) {
  const storage = watchedStorage();
  const form = createForm(schema, { draft: { key: "k", storage }, devWarnings: false });
  try {
    await settled();
    drive(form);
    await saved();
    const envelope = storage.written.get("k");
    return {
      listed: form.sensitivePaths(),
      draft: envelope ? JSON.parse(envelope).value : null,
    };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["SEC-005", "COL-001"],
    title: "what a draft withholds is the declaration, not a name that happens to match",
    environments: ["node"],
  },
  async (ctx) => {
    const rowsWith = (cell) => record(group({ answer: cell, label: field("") }));

    const sameName = await draftOf(
      {
        answer: field("", [], { sensitive: true }),
        rows: rowsWith(field("", [], { sensitive: true })),
      },
      (form) => {
        form.f.answer.set(SECRET);
        form.f.rows.upsert("a", { answer: SECRET, label: "ordinary" });
      },
    );

    const otherName = await draftOf(
      {
        token: field("", [], { sensitive: true }),
        rows: rowsWith(field("", [], { sensitive: true })),
      },
      (form) => {
        form.f.token.set(SECRET);
        form.f.rows.upsert("a", { answer: SECRET, label: "ordinary" });
      },
    );

    const ordinaryCell = await draftOf(
      {
        answer: field("", [], { sensitive: true }),
        rows: rowsWith(field("")),
      },
      (form) => {
        form.f.answer.set(SECRET);
        form.f.rows.upsert("a", { answer: "ordinary", label: "ordinary" });
      },
    );

    ctx.log.note("the same row cell under three arrangements of names", {
      sameName,
      otherName,
      ordinaryCell,
    });

    // The control: all three drafts were written, and the row's ordinary neighbour survived each
    // time — so what follows is about one cell rather than about drafts failing.
    expectClaim(
      [sameName, otherName, ordinaryCell].every(
        (run) => run.draft !== null && run.draft["rows.a.label"] === "ordinary",
      ),
      {
        claimIds: ["SEC-005"],
        what: "a draft was not written or lost the row entirely, so the probe is wrong before the product is",
        detail: JSON.stringify({ sameName, otherName, ordinaryCell }),
      },
    );

    // A secret is withheld because it was declared a secret.
    expectEqual(otherName.draft["rows.a.answer"] ?? null, null, {
      claimIds: ["SEC-005"],
      what: "a row's secret was written in clear because no other field happened to share its name",
    });

    // And an ordinary value is kept because it was not declared one.
    expectEqual(ordinaryCell.draft["rows.a.answer"] ?? null, "ordinary", {
      claimIds: ["SEC-005", "COL-001"],
      what: "an ordinary cell was dropped from the draft because an unrelated field shares its name, so restoring returns work with a column missing",
    });
  },
);
