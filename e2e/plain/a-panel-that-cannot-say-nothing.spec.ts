import { expect, test } from "@playwright/test";

/**
 * The inspection table, drawn from a real widget.
 *
 * ADR 0188's claim is that a reader can tell "this is empty" from "nobody looked". The check is that
 * both appear in one table and neither is blank — a panel where an unread rendered as an empty cell
 * would pass every test about the values it *did* read.
 */
test("every row says something, including the ones with no value", async ({ page }) => {
  await page.goto("/lab.html#contracts");
  const table = page.locator("[data-inspection] table");
  await expect(table).toBeVisible();

  const cells = table.locator("td");
  const count = await cells.count();
  expect(count).toBeGreaterThan(6);

  for (let at = 0; at < count; at += 1) {
    const text = (await cells.nth(at).textContent()) ?? "";
    expect(text.trim(), `cell ${at} was blank, which reads as an absent value`).not.toBe("");
  }
});

test("a probe with nothing to read says so, beside one that read something", async ({ page }) => {
  await page.goto("/lab.html#contracts");
  const table = page.locator("[data-inspection] table");
  await expect(table).toBeVisible();

  // The row deliberately pointed at a part the renderer does not draw.
  await expect(table.getByText("a part nobody probes")).toBeVisible();
  await expect(table.getByText(/not read/).first()).toBeVisible();

  // And a row that did read something, so the two are visible together rather than in two runs.
  await expect(table.getByText("control id")).toBeVisible();
  const idRow = table.locator("tr", { has: page.getByText("control id") });
  await expect(idRow.locator("td").nth(1)).not.toHaveText(/not read/);
});

/**
 * Every door on the page answers with what it puts on an element.
 *
 * The door list is drawn from `MDY_CLASS_DOORS`, and the sample arguments each door is asked with
 * are written by hand on the page — so the door added tomorrow is exactly the one that arrives
 * without a sample. Its row says so, in words, and until now nobody read those words: the page was
 * honest and unenforced, which is a state that lasts until someone happens to look.
 *
 * The failure this catches is not a crash. It is a row that would otherwise teach the opposite of
 * what the page exists to show — a door reading as one that puts no class on anything.
 */
test("no door on the page is missing the example it is asked with", async ({ page }) => {
  await page.goto("/lab.html#contracts");
  const doors = page.locator("dl[data-class-doors]");
  await expect(doors).toBeVisible();

  const terms = doors.locator("dt");
  const answers = doors.locator("dd");
  const count = await terms.count();
  expect(count, "no doors were listed, so this test is measuring nothing").toBeGreaterThan(4);

  for (let at = 0; at < count; at += 1) {
    const name = (await terms.nth(at).textContent())?.trim() ?? "";
    const said = (await answers.nth(at).textContent())?.trim() ?? "";
    expect(said, `the ${name} row is blank`).not.toBe("");
    // Read from the row's own declaration, never from its wording.
    //
    // This assertion used to match the sentence the page wrote for a door with no sample. The
    // wording then moved into the contract, the page stopped writing that sentence, and this test
    // went **green on the plant that had made it red** — passing on exactly the defect it exists
    // for, and saying nothing while it did. A check that reads prose stops seeing its subject the
    // day the prose changes, and reports that as success.
    const kind = await answers.nth(at).getAttribute("data-answer");
    expect(kind, `the ${name} row does not say what kind of answer it is`).not.toBeNull();
    expect(kind, `${name} was asked with nothing — it has no sample in SAMPLE_CALL, so its row cannot `
      + "say what it puts on an element").not.toBe("unasked");
  }
});
