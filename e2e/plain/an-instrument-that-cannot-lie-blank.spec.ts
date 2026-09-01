/**
 * The inspection panel says where every value came from, and says so about a real widget.
 *
 * ADR 0188 makes a claim of a shape that has to be planted rather than believed: **nothing the panel
 * shows is a bare value.** A cell either carries what was read and where it came from, or it carries
 * the reason nobody could read it — because a blank cell asserts "this is absent" when it may mean
 * "nobody looked", and those are two findings with two different repairs.
 *
 * A claim like that is only worth the checks nobody has seen fail, so each property below is driven
 * against the drawn table rather than against the type that produces it: a type can forbid a shape
 * the renderer still puts on the screen.
 *
 * The accessible name is the one worth the most attention. It is *computed*, not read: an element
 * carrying `aria-label` and `aria-labelledby` has one name and it is not the one written closest to
 * hand, and a `labelledby` pointing at nothing is not a name at all. A panel reporting the attribute
 * it found first would be right about the markup and wrong about what a screen reader says.
 */
import { expect, test } from "@playwright/test";

const INSPECTION = "table:has-text('control id')";

/** The drawn table, row by row, as a reader sees it — not the model behind it. */
async function readTable(page: import("@playwright/test").Page): Promise<string[][]> {
  return page.locator(INSPECTION).first().evaluate((table) =>
    [...table.querySelectorAll("tr")].map((tr) =>
      [...tr.children].map((cell) => (cell.textContent ?? "").trim())));
}

const rowNamed = (rows: string[][], label: string): string[] =>
  rows.find((row) => row[0] === label) ?? [];

test.beforeEach(async ({ page }) => {
  await page.goto("/lab.html#contracts");
  await expect(page.locator('[data-panel="contracts"]')).toBeVisible();
  await expect(page.locator(INSPECTION).first()).toBeVisible();
});

/** Re-reading is the panel's own act: an absence that has become present has to be seen again. */
async function reread(page: import("@playwright/test").Page): Promise<void> {
  await page.getByRole("button", { name: /Re-read the page/i }).click();
  await expect.poll(async () => (await readTable(page)).length).toBeGreaterThan(1);
}

test("every row carries where its value came from, and an unread one carries why", async ({ page }) => {
  const rows = await readTable(page);

  // The premise, before anything is asserted about the rows: this is a table of several readings and
  // not one row that happens to agree with everything below.
  expect(rows.length, "the panel drew too few rows to be the inspection table").toBeGreaterThan(3);

  for (const [label, value, provenance] of rows) {
    expect(provenance, `"${label}" shows a value with nothing saying where it came from`).not.toBe("");
    // The two endings, and a row must be one of them: read with a source, or unread with a reason.
    // A row saying "(not read)" and nothing else is the blank cell wearing a phrase.
    if (value.startsWith("(not read)")) {
      expect(value, `"${label}" is unread and does not say why`).toMatch(/\(not read\).+\S/);
    }
  }

  // The deliberate absence, drawn beside full rows in the same table rather than omitted: a panel
  // that hid what it could not read would look complete and be silent about its own reach.
  const absent = rows.find((row) => row[1]?.startsWith("(not read)"));
  expect(absent, "no row shows an unread reading, so nothing here proves one is drawn").toBeDefined();
});

test("the name a control has is the computed one, not the attribute nearest to hand", async ({ page }) => {
  // Both mechanisms at once. `aria-labelledby` wins by the platform's own rules, and a panel
  // reporting `aria-label` here would be reporting the markup rather than the name.
  await page.evaluate(() => {
    const control = document.querySelector<HTMLElement>(".mdy-renderer--text input, .mdy-renderer input");
    const target = document.createElement("span");
    target.id = "spec-resolved-name";
    target.textContent = "The resolved name";
    control?.parentElement?.append(target);
    control?.setAttribute("aria-labelledby", "spec-resolved-name");
  });
  await reread(page);

  const named = rowNamed(await readTable(page), "control is named");
  expect(named[1], "the panel drew no row for the control's name").toBeDefined();
  expect(named[1]).toContain("The resolved name");
  expect(named[1], "the panel reported the attribute it found rather than the computed name")
    .toContain("aria-labelledby");
});

test("a reference pointing at nothing is not a name", async ({ page }) => {
  // The dangling half, and the direction that matters: a `labelledby` naming an id that is not on
  // the page contributes nothing, so the name falls to the next mechanism. Reporting the dangling
  // reference would tell an author their control is named when a screen reader says otherwise.
  await page.evaluate(() => {
    document.querySelector(".mdy-renderer--text input, .mdy-renderer input")
      ?.setAttribute("aria-labelledby", "spec-id-that-is-not-there");
  });
  await reread(page);

  const named = rowNamed(await readTable(page), "control is named");
  expect(named[1], "the panel drew no row for the control's name").toBeDefined();
  expect(named[1], "a dangling aria-labelledby was reported as the control's name")
    .not.toContain("spec-id-that-is-not-there");
  expect(named[1], "the name fell through to nothing rather than to the next mechanism")
    .toMatch(/\S/);
});

test("a value read and empty is named, not left blank", async ({ page }) => {
  // The one value that used to produce a blank cell, and the reason the claim needed planting rather
  // than believing: `null` prints "null" and `undefined` prints "undefined", so the empty string was
  // the only reading that rendered as nothing — and it is a legitimate, common one. A reader glancing
  // at a blank cell cannot tell "read, and it was empty" from "nobody looked", which are two findings
  // with two different repairs.
  await page.evaluate(() => {
    document.querySelector(".mdy-renderer--text input, .mdy-renderer input")?.setAttribute("id", "");
  });
  await reread(page);

  const row = rowNamed(await readTable(page), "control id");
  expect(row[1], "the panel drew no row for the control's id").toBeDefined();
  expect(row[1], "an empty read rendered as a blank cell").toMatch(/\S/);
  // Named as empty, and not as unread: it *was* read, and the cell says what was found rather than
  // whether anyone looked. Reporting it as unread would be the same lie in the other direction.
  expect(row[1]).toContain("empty");
  expect(row[1], "a value that was read was reported as not read").not.toContain("not read");
});

test("no cell a reader is shown is blank, whatever the reading found", async ({ page }) => {
  // The property over the whole table rather than over one row: the guard that used to exist
  // protected the branch that could not fail — an unread reading always builds a sentence — while
  // the branch that could was left alone.
  await page.evaluate(() => {
    const control = document.querySelector(".mdy-renderer--text input, .mdy-renderer input");
    control?.setAttribute("id", "");
    control?.setAttribute("aria-label", "");
  });
  await reread(page);

  const blank = (await readTable(page)).filter((row) => row.some((cell) => cell === ""));
  expect(blank, `${blank.length} cell(s) are blank: ${JSON.stringify(blank)}`).toEqual([]);
});
