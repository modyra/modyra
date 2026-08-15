/**
 * The value that leaves a page, read where it leaves it.
 *
 * SUB-001 is "submission contains no undeclared path introduced by rendering" and VAL-002 is
 * "disabled values are retained in edit state and excluded from submission". Both are asserted at
 * engine level and neither had ever been read from a page: the browser host answered submissions
 * without recording what it was handed, so every spec here could see what a renderer did with the
 * *answer* and none could see what it sent.
 *
 * The host now keeps each value its submit action receives, cloned at the moment it receives it, on
 * every mounting path rather than one, and these tests read it. What they check is what a server would get: exactly the names the document
 * declared, nothing a renderer added — no widget ids, no `__`-prefixed bookkeeping, no key for a
 * control that happens to be on the page — and a field taken out of play kept in the form and left
 * out of the payload.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

/** Mount with a submit action, press the button, and report what the action was handed. */
async function submitted(page: import("@playwright/test").Page, id: string, fields: unknown[]) {
  await page.evaluate(
    ({ mountId, given }) => {
      (window as never as {
        battle: { mountWithSubmit(id: string, f: unknown[], e: unknown): { mounted: boolean } };
      }).battle.mountWithSubmit(mountId, given as never, null);
    },
    { mountId: id, given: fields },
  );
  await page.waitForTimeout(200);
  await page.locator(`[data-form="${id}"] button`).last().click().catch(() => undefined);
  await page.waitForTimeout(320);
  return page.evaluate(
    (mountId) => (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
    id,
  );
}

test("a page sends the names the document declared, and no others", async ({ page }) => {
  // Every kind at once, so a key a renderer adds for any of them has somewhere to show up.
  const fields = [...MDY_WIDGET_KINDS].map((kind) => {
    const field: Record<string, unknown> = { name: kind, kind, label: kind };
    if (/select|radio|segmented/.test(kind)) field.options = [{ value: "a", label: "A" }];
    return field;
  });

  const sent = await submitted(page, "sends", fields);

  // The control: it submitted at all. A page that never called the action would report no extra
  // keys by having no payload.
  expect(sent.length, JSON.stringify(sent)).toBeGreaterThan(0);

  const declared = fields.map((each) => (each as { name: string }).name).sort();
  const keys = Object.keys(sent[0] as object).sort();
  expect(keys, JSON.stringify({ keys, declared })).toEqual(declared);
});

test("a field taken out of play is kept in the form and left out of the payload", async ({ page }) => {
  const id = "outofplay";
  await page.evaluate(
    ({ mountId }) => {
      (window as never as {
        battle: { mountWithSubmit(id: string, f: unknown[], e: unknown): { mounted: boolean } };
      }).battle.mountWithSubmit(mountId, [
        { name: "kept", kind: "text", label: "Kept" },
        { name: "gone", kind: "text", label: "Gone" },
      ] as never, null);
    },
    { mountId: id },
  );
  await page.waitForTimeout(200);

  const inputs = page.locator(`[data-form="${id}"] input`);
  await inputs.nth(0).fill("first");
  await inputs.nth(1).fill("second");
  await page.waitForTimeout(160);

  // The control: both values are in the form before either is taken out of play.
  const typed = await page.evaluate(
    (mountId) => (window as never as { battle: { valueOf(id: string): unknown } }).battle.valueOf(mountId),
    id,
  );
  expect(typed, JSON.stringify(typed)).toEqual({ kept: "first", gone: "second" });

  await page.evaluate(
    ({ mountId }) => (window as never as { battle: { disable(id: string, path: string): void } })
      .battle.disable(mountId, "gone"),
    { mountId: id },
  );
  await page.waitForTimeout(220);

  // Retained: the form still holds what was typed into the field that left play.
  const held = await page.evaluate(
    (mountId) => (window as never as { battle: { valueOf(id: string): unknown } }).battle.valueOf(mountId),
    id,
  );
  expect(held, JSON.stringify(held)).toEqual({ kept: "first", gone: "second" });

  await page.locator(`[data-form="${id}"] button`).last().click().catch(() => undefined);
  await page.waitForTimeout(320);

  const sent = await page.evaluate(
    (mountId) => (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
    id,
  );
  expect(sent.length, JSON.stringify(sent)).toBe(1);
  expect(sent[0], JSON.stringify(sent[0])).toEqual({ kept: "first" });
});

test("a row-shaped form sends its rows by key, and a removed row leaves nothing behind", async ({ page }) => {
  const id = "rowform";
  await page.evaluate(
    (mountId) => (window as never as { battle: { mount(id: string, o: unknown): unknown } }).battle.mount(mountId, { key: "a" }),
    id,
  );
  await page.waitForTimeout(240);

  await page.evaluate(
    (mountId) => (window as never as { battle: { declareRow(id: string, k: string, v: unknown): void } })
      .battle.declareRow(mountId, "b", { code: "B", note: "n" }),
    id,
  );
  await page.waitForTimeout(220);

  // Fill what the form requires, so it will submit at all.
  const inputs = page.locator(`[data-form="${id}"] input`);
  const count = await inputs.count();
  for (let index = 0; index < count; index += 1) await inputs.nth(index).fill("x").catch(() => undefined);
  await page.waitForTimeout(200);

  await page.locator(`[data-form="${id}"] button`).last().click().catch(() => undefined);
  await page.waitForTimeout(360);

  const sent = await page.evaluate(
    (mountId) => (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
    id,
  );

  // The control: it submitted, and it submitted both rows — so the absence below is the removal.
  expect(sent.length, JSON.stringify(sent)).toBeGreaterThan(0);
  const rows = (sent.at(-1) as { rows: Record<string, unknown> }).rows;
  expect(Array.isArray(rows), JSON.stringify(rows)).toBe(false);
  expect(Object.keys(rows).sort(), JSON.stringify(rows)).toEqual(["a", "b"]);

  await page.evaluate(
    (mountId) => (window as never as { battle: { removeRow(id: string, k: string): void } }).battle.removeRow(mountId, "b"),
    id,
  );
  await page.waitForTimeout(240);
  await page.locator(`[data-form="${id}"] button`).last().click().catch(() => undefined);
  await page.waitForTimeout(360);

  const after = await page.evaluate(
    (mountId) => (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
    id,
  );
  expect(after.length, JSON.stringify(after)).toBeGreaterThan(sent.length - 1);
  const rowsAfter = (after.at(-1) as { rows: Record<string, unknown> }).rows;
  expect(Object.keys(rowsAfter), JSON.stringify(rowsAfter)).toEqual(["a"]);
});

test("an array-shaped form sends a list, and removing from the middle closes the gap", async ({ page }) => {
  const id = "arrayform";
  const mounted = await page.evaluate(
    (mountId) => {
      const fields = [0, 1, 2].map((index) => ({ name: `rows.${index}.code`, kind: "text", label: `Code ${index}` }));
      return (window as never as {
        battle: { mountFields(id: string, f: unknown[], o: unknown): { mounted: boolean; message?: string } };
      }).battle.mountFields(mountId, fields, { collections: [{ path: "rows", kind: "array" }] });
    },
    id,
  );
  expect(mounted, JSON.stringify(mounted)).toMatchObject({ mounted: true });
  await page.waitForTimeout(240);

  const inputs = page.locator(`[data-form="${id}"] input`);
  const count = await inputs.count();
  for (let index = 0; index < count; index += 1) await inputs.nth(index).fill(`v${index}`).catch(() => undefined);
  await page.waitForTimeout(200);

  await page.locator(`[data-form="${id}"] button`).last().click().catch(() => undefined);
  await page.waitForTimeout(360);

  const sent = await page.evaluate(
    (mountId) => (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
    id,
  );

  // The control: three rows went out, as a list. A form that sent two from the start would make the
  // check below meaningless.
  expect(sent.length, JSON.stringify(sent)).toBeGreaterThan(0);
  expect(sent.at(-1), JSON.stringify(sent.at(-1))).toEqual({
    rows: [{ code: "v0" }, { code: "v1" }, { code: "v2" }],
  });

  await page.evaluate(
    (mountId) => (window as never as { battle: { removeRow(id: string, k: string): void } }).battle.removeRow(mountId, "1"),
    id,
  );
  await page.waitForTimeout(260);
  await page.locator(`[data-form="${id}"] button`).last().click().catch(() => undefined);
  await page.waitForTimeout(360);

  const after = await page.evaluate(
    (mountId) => (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
    id,
  );
  // The row that was second is gone and the third has closed up behind it: no hole, no null, and no
  // index left pointing at a row that is not there.
  expect(after.at(-1), JSON.stringify(after.at(-1))).toEqual({ rows: [{ code: "v0" }, { code: "v2" }] });
});

test("an id prefix scopes the page and not the payload", async ({ page }) => {
  // Two forms over the same names is what `idPrefix` exists for. What it must not do is reach the
  // data: a server receiving "one-email" instead of "email" is the failure this guards against.
  const seen: Array<{ label: string; ids: string[]; sent: unknown }> = [];

  for (const [label, options] of [["bare", {}], ["prefixed", { idPrefix: "one" }]] as Array<[string, Record<string, unknown>]>) {
    const id = `prefix-${label}`;
    await page.evaluate(
      ({ mountId, given }) => {
        (window as never as {
          battle: { mountFields(id: string, f: unknown[], o: unknown): { mounted: boolean } };
        }).battle.mountFields(mountId, [
          { name: "email", kind: "text", label: "Email" },
          { name: "note", kind: "text", label: "Note" },
        ] as never, given);
      },
      { mountId: id, given: options },
    );
    await page.waitForTimeout(200);

    const inputs = page.locator(`[data-form="${id}"] input`);
    await inputs.nth(0).fill("a@b.c");
    await inputs.nth(1).fill("hello");
    await page.waitForTimeout(170);

    const ids = await page.evaluate(
      (selector) => Array.from(document.querySelectorAll(`${selector} input`)).map((element) => element.id),
      `[data-form="${id}"]`,
    );
    await page.locator(`[data-form="${id}"] button`).last().click().catch(() => undefined);
    await page.waitForTimeout(330);
    const sent = await page.evaluate(
      (mountId) => (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
      id,
    );
    seen.push({ label, ids, sent: sent.at(-1) });
  }

  const bare = seen[0];
  const prefixed = seen[1];

  // The control: the prefix did something. If the ids were the same in both, the payload agreeing
  // would say nothing about scoping.
  expect(bare.ids, JSON.stringify(seen)).toEqual(["email", "note"]);
  expect(prefixed.ids, JSON.stringify(seen)).toEqual(["one-email", "one-note"]);

  // And the thing that must not move.
  expect(bare.sent, JSON.stringify(seen)).toEqual({ email: "a@b.c", note: "hello" });
  expect(prefixed.sent, JSON.stringify(seen)).toEqual({ email: "a@b.c", note: "hello" });
});
