/**
 * The value that leaves a page, read where it leaves it.
 *
 * SUB-001 is "submission contains no undeclared path introduced by rendering" and VAL-002 is
 * "disabled values are retained in edit state and excluded from submission". Both are asserted at
 * engine level and neither had ever been read from a page: the browser host answered submissions
 * without recording what it was handed, so every spec here could see what a renderer did with the
 * *answer* and none could see what it sent.
 *
 * The host now keeps each value its submit action receives, cloned at the moment it receives it, and
 * these two tests read it. What they check is what a server would get: exactly the names the document
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
