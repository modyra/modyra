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
import { SETTLES } from "./bench";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

/** Mount with a submit action, press the button, and report what the action was handed. */

/**
 * Press the form's own submit button, named rather than positional.
 *
 * This was `button.last().click().catch(() => undefined)` at six sites. The submit is appended to
 * the container, so it is last — until a row is declared and brings buttons of its own, and then
 * the last button is a row's. The click landed on that instead, the swallowed error said nothing,
 * and the spec reported an empty payload as the form losing every row.
 *
 * Named, and unguarded errors are no longer swallowed: a submit that cannot be found is a failure
 * with a sentence, not a silent pass through to an assertion about the wrong thing.
 */
async function submitForm(page: import("@playwright/test").Page, id: string) {
  const button = page.locator(`[data-form="${id}"]`).getByRole("button", { name: "Submit", exact: true });
  await expect(
    button,
    `no submit button was found in "${id}" — pressing whichever button came last is how this spec ` +
      "used to report a row's own control as the form",
  ).toHaveCount(1, { timeout: 5_000 });
  await button.click();
}

/**
 * What a form submitted, waited for by name.
 *
 * A pause after pressing submit is approximating "the submission has landed" — which is a condition,
 * so it is stated as one. The read is retried until something arrived rather than for a fixed number
 * of milliseconds, and the message says which form said nothing when it never does.
 */
async function whatLanded(page: import("@playwright/test").Page, id: string) {
  const collected = () => page.evaluate(
    (mountId) => (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
    id,
  );
  await expect
    .poll(collected, { message: `"${id}" submitted nothing, so there is no payload to read`, ...SETTLES })
    .not.toHaveLength(0);
  return collected();
}

async function submitted(page: import("@playwright/test").Page, id: string, fields: unknown[]) {
  await page.evaluate(
    ({ mountId, given }) => {
      (window as never as {
        battle: { mountWithSubmit(id: string, f: unknown[], e: unknown): { mounted: boolean } };
      }).battle.mountWithSubmit(mountId, given as never, null);
    },
    { mountId: id, given: fields },
  );
  // No pause before pressing: `submitForm` asserts the button is there with a retrying matcher, so it
  // already waits exactly as long as the mount takes.
  await submitForm(page, id);

  return whatLanded(page, id);
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

  await submitForm(page, id);
  const sent = await whatLanded(page, id);
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

  await submitForm(page, id);
  const sent = await whatLanded(page, id);

  // The control: it submitted, and it submitted both rows — so the absence below is the removal.
  expect(sent.length, JSON.stringify(sent)).toBeGreaterThan(0);
  const rows = (sent.at(-1) as { rows: Record<string, unknown> }).rows;
  expect(Array.isArray(rows), JSON.stringify(rows)).toBe(false);
  expect(Object.keys(rows).sort(), JSON.stringify(rows)).toEqual(["a", "b"]);

  await page.evaluate(
    (mountId) => (window as never as { battle: { removeRow(id: string, k: string): void } }).battle.removeRow(mountId, "b"),
    id,
  );
  await submitForm(page, id);
  const after = await whatLanded(page, id);
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

  await submitForm(page, id);
  const sent = await whatLanded(page, id);

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
  await submitForm(page, id);
  const after = await whatLanded(page, id);
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
    await submitForm(page, id);
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
  //
  // The bare ids are not pinned to the field names. A form carries a scope whether or not anyone
  // named one, and its default value is minted from the document — so writing it down here would pin
  // a value the contract deliberately does not promise. What is asserted is that the scope is
  // *there* and that it is not the supplied one.
  expect(
    bare.ids.map((id) => id.replace(/^.*?-/, "")),
    `the bare mount published ${JSON.stringify(bare.ids)}, whose tails are not the field names — so `
    + "the id is not a function of the document within its scope and the comparison below is not "
    + `about scoping at all. ${JSON.stringify(seen)}`,
  ).toEqual(["email", "note"]);
  expect(
    bare.ids,
    `the bare mount and the prefixed one published the same ids, so the prefix did nothing and the `
    + `payload agreeing says nothing about scoping. ${JSON.stringify(seen)}`,
  ).not.toEqual(prefixed.ids);
  expect(prefixed.ids, JSON.stringify(seen)).toEqual(["one-email", "one-note"]);

  // And the thing that must not move.
  expect(bare.sent, JSON.stringify(seen)).toEqual({ email: "a@b.c", note: "hello" });
  expect(prefixed.sent, JSON.stringify(seen)).toEqual({ email: "a@b.c", note: "hello" });
});

test("a form in the middle of submitting does not send again, and does once it is done", async ({ page }) => {
  // A synchronous action leaves no window for a second press to land in, so the question can only be
  // asked of one that is still running — and a slow network is exactly when somebody presses again.
  const id = "slowsubmit";
  const mounted = await page.evaluate(
    (mountId) => (window as never as {
      battle: { mountSlowSubmit(id: string, f: unknown[], ms: number): { mounted: boolean } };
    }).battle.mountSlowSubmit(mountId, [{ name: "a", kind: "text", label: "A" }] as never, 600),
    id,
  );
  expect(mounted, JSON.stringify(mounted)).toMatchObject({ mounted: true });
  await page.waitForTimeout(220);

  await page.locator(`[data-form="${id}"] input`).fill("x");
  await page.waitForTimeout(150);
  const button = page.locator(`[data-form="${id}"] button`).last();

  await button.click();
  await page.waitForTimeout(130);

  // The window is open: the form says so and the control says so.
  const midFlight = await page.evaluate((mountId) => ({
    submitting: (window as never as { battle: { submittingOf(id: string): boolean } }).battle.submittingOf(mountId),
    disabled: (document.querySelector(`[data-form="${mountId}"] button:last-of-type`) as HTMLButtonElement | null)?.disabled ?? null,
  }), id);
  expect(midFlight, JSON.stringify(midFlight)).toEqual({ submitting: true, disabled: true });

  // Press again, twice, while it is still running.
  await button.click({ force: true }).catch(() => undefined);
  await button.click({ force: true }).catch(() => undefined);
  const during = await whatLanded(page, id);
  expect(during.length, JSON.stringify(during)).toBe(1);

  // The control, and the half that a permanently disabled button would fail: the window closes.
  //
  // Waited on the closing rather than on a duration, and the two are not the same condition — the
  // payload arrives while the form is still in flight, so waiting for it to *land* leaves this
  // reading the middle of the flight. What this asserts is that the flight is over.
  await expect
    .poll(() => page.evaluate((mountId) => ({
      submitting: (window as never as { battle: { submittingOf(id: string): boolean } }).battle.submittingOf(mountId),
      disabled: (document.querySelector(`[data-form="${mountId}"] button:last-of-type`) as HTMLButtonElement | null)?.disabled ?? null,
    }), id), { message: "the submitting window never closed", ...SETTLES })
    .toEqual({ submitting: false, disabled: false });

  await button.click().catch(() => undefined);
  await page.waitForTimeout(950);
  const deliberate = await page.evaluate(
    (mountId) => (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
    id,
  );
  expect(deliberate.length, JSON.stringify(deliberate)).toBe(2);
});

test("an answer that arrives after its form is gone reaches nothing, including its replacement", async ({ page }) => {
  const FIELDS = [{ name: "a", kind: "text", label: "A" }];
  const ANSWER = [{ path: "a", message: "FROM THE OLD FORM" }];

  // The control first: left standing, this answer is visible. Without it, a clean replacement below
  // would only mean the answer never showed anywhere.
  await page.evaluate(
    ({ mountId, fields, answer }) => (window as never as {
      battle: { mountSlowSubmit(id: string, f: unknown[], ms: number, e: unknown): { mounted: boolean } };
    }).battle.mountSlowSubmit(mountId, fields as never, 400, answer),
    { mountId: "standing", fields: FIELDS, answer: ANSWER },
  );
  await page.waitForTimeout(220);
  await page.locator('[data-form="standing"] input').fill("old");
  await page.waitForTimeout(150);
  await page.locator('[data-form="standing"] button').last().click();
  await page.waitForTimeout(900);

  const standing = await page.evaluate(() => ({
    errors: (window as never as { battle: { lastSubmitErrorsOf(id: string): unknown[] } }).battle.lastSubmitErrorsOf("standing"),
    onThePage: (document.querySelector('[data-form="standing"]')?.textContent ?? "").replace(/\s+/g, " "),
  }));
  expect(standing.errors, JSON.stringify(standing)).toEqual(ANSWER);
  expect(standing.onThePage, JSON.stringify(standing)).toContain("FROM THE OLD FORM");

  // Now the same thing, with the form torn down and replaced before the answer lands — a route change
  // while a submission is in the air.
  const id = "replaced";
  await page.evaluate(
    ({ mountId, fields, answer }) => (window as never as {
      battle: { mountSlowSubmit(id: string, f: unknown[], ms: number, e: unknown): { mounted: boolean } };
    }).battle.mountSlowSubmit(mountId, fields as never, 700, answer),
    { mountId: id, fields: FIELDS, answer: ANSWER },
  );
  await page.waitForTimeout(220);
  await page.locator(`[data-form="${id}"] input`).fill("old");
  await page.waitForTimeout(150);
  await page.locator(`[data-form="${id}"] button`).last().click();
  await page.waitForTimeout(170);

  await page.evaluate(
    (mountId) => (window as never as { battle: { dispose(id: string): void } }).battle.dispose(mountId),
    id,
  );
  await page.evaluate(
    ({ mountId, fields }) => (window as never as {
      battle: { mountFields(id: string, f: unknown[], o: unknown): { mounted: boolean } };
    }).battle.mountFields(mountId, fields as never, {}),
    { mountId: id, fields: FIELDS },
  );
  await page.waitForTimeout(220);
  await page.locator(`[data-form="${id}"] input`).fill("new");

  // The old answer lands in here.
  await page.waitForTimeout(950);

  const replacement = await page.evaluate((mountId) => ({
    value: (window as never as { battle: { valueOf(id: string): unknown } }).battle.valueOf(mountId),
    errors: (window as never as { battle: { lastSubmitErrorsOf(id: string): unknown[] } }).battle.lastSubmitErrorsOf(mountId),
    onThePage: (document.querySelector(`[data-form="${mountId}"]`)?.textContent ?? "").replace(/\s+/g, " "),
    sent: (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
  }), id);

  expect(replacement.value, JSON.stringify(replacement)).toEqual({ a: "new" });
  expect(replacement.errors, JSON.stringify(replacement)).toEqual([]);
  expect(replacement.onThePage, JSON.stringify(replacement)).not.toContain("FROM THE OLD FORM");
  expect(replacement.sent, JSON.stringify(replacement)).toEqual([]);
});

test("a submission carries what was there when it started, and the typing that follows is kept", async ({ page }) => {
  const id = "kepttyping";
  await page.evaluate(
    (mountId) => (window as never as {
      battle: { mountSlowSubmit(id: string, f: unknown[], ms: number, e: unknown): { mounted: boolean } };
    }).battle.mountSlowSubmit(mountId, [{ name: "a", kind: "text", label: "A" }] as never, 700, null),
    id,
  );
  await page.waitForTimeout(220);

  const input = page.locator(`[data-form="${id}"] input`);
  await input.fill("at submit time");
  await page.waitForTimeout(160);
  await page.locator(`[data-form="${id}"] button`).last().click();
  await page.waitForTimeout(160);

  // The control: the field is still the person's to use. Only the button closes.
  expect(await input.evaluate((element) => (element as HTMLInputElement).disabled)).toBe(false);

  await input.fill("edited during the save").catch(() => undefined);
  await page.waitForTimeout(950);

  const seen = await page.evaluate((mountId) => ({
    value: (window as never as { battle: { valueOf(id: string): unknown } }).battle.valueOf(mountId),
    sent: (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
    onScreen: (document.querySelector(`[data-form="${mountId}"] input`) as HTMLInputElement | null)?.value ?? null,
  }), id);

  // What went out is what was there when it went out.
  expect(seen.sent, JSON.stringify(seen)).toEqual([{ a: "at submit time" }]);
  // What is here is what the person has since written, on screen and in the form alike.
  expect(seen.value, JSON.stringify(seen)).toEqual({ a: "edited during the save" });
  expect(seen.onScreen, JSON.stringify(seen)).toBe("edited during the save");
});
