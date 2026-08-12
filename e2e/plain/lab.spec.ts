import { expect, test } from "@playwright/test";

/**
 * The laboratory, panel by panel.
 *
 * Each panel exists so a person can drive one part of the engine into the states where defects hide.
 * A panel that throws, or that shows a readout one state behind what is on screen, is worse than no
 * panel: it reports the previous answer with the authority of the current one. These are the checks
 * that the controls do what the panel says they do.
 */
const PANELS = ["states", "validation", "collections", "lifecycle", "dynamic", "security"];

async function open(page: import("@playwright/test").Page, id: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`/lab.html#${id}`);
  await expect(page.locator(`[data-panel="${id}"]`)).toBeVisible();
  return errors;
}

const readout = (page: import("@playwright/test").Page) =>
  page.locator("[data-readout]").textContent().then((t) => JSON.parse(t ?? "{}"));

test("every panel mounts, names its invariant, and raises nothing", async ({ page }) => {
  for (const id of PANELS) {
    const errors = await open(page, id);
    await expect(page.locator("[data-invariant]")).not.toBeEmpty();
    await page.waitForTimeout(120);
    expect(errors, `${id} raised: ${errors.join(" | ")}`).toEqual([]);
  }
});

test("states: out of play withdraws the verdict and keeps the errors", async ({ page }) => {
  await open(page, "states");
  await page.locator('[data-toggle="Touched"]').click();
  await page.waitForTimeout(120);
  const failing = await readout(page);
  expect(failing.partsPaintedAsFailing).toBeGreaterThan(0);

  await page.locator('[data-toggle="Out of play"]').click();
  await page.waitForTimeout(120);
  const quiet = await readout(page);
  expect(quiet.partsPaintedAsFailing).toBe(0);
  expect(quiet.errorsHeld).toBe(failing.errorsHeld);
  expect(quiet.formValid).toBe(true);
});

test("validation: a composed rule reaches the input as attributes", async ({ page }) => {
  await open(page, "validation");
  await page.waitForTimeout(120);
  const state = await readout(page);
  // `compose(required(), minLength(2), maxLength(8), pattern(…))` — every one of the four has to
  // arrive, which is the thing composition used to swallow.
  expect(state.code).toMatchObject({ maxlength: "8", minlength: "2" });
  expect(state.code.pattern).toBeTruthy();
  expect(state.code["aria-required"] ?? state.code.required).toBeTruthy();
});

test("validation: an answer from elsewhere arrives, and can be withdrawn", async ({ page }) => {
  await open(page, "validation");
  await page.locator('[data-action="Take the handle"]').click();
  await expect.poll(async () => (await readout(page)).errors?.handle?.[0], { timeout: 5000 })
    .toBe("That handle is taken");

  await page.locator('[data-action="Server rejects the email"]').click();
  await expect.poll(async () => (await readout(page)).errors?.email?.join(" "), { timeout: 5000 })
    .toContain("Already registered");
  await page.locator('[data-action="Server changes its mind"]').click();
  await expect.poll(async () => (await readout(page)).errors?.email?.join(" ") ?? "", { timeout: 5000 })
    .not.toContain("Already registered");
});

test("collections: a row exists because it was declared, not because it was drawn", async ({ page }) => {
  await open(page, "collections");
  await page.locator('[data-action="Push a row"]').click();
  await page.waitForTimeout(120);
  expect((await readout(page)).items).toHaveLength(3);

  await page.locator('[data-action="Clear the model only"]').click();
  await page.waitForTimeout(120);
  const split = await readout(page);
  expect(split.items).toHaveLength(0);
  expect(split.itemsDrawn).toBeGreaterThan(0);

  await page.locator('[data-action="Redraw"]').click();
  await page.waitForTimeout(120);
  expect((await readout(page)).itemsDrawn).toBe(0);
});

test("collections: a rename keeps the value with the row", async ({ page }) => {
  await open(page, "collections");
  await page.locator('[data-action="Rename ada → ada2"]').click();
  await page.waitForTimeout(120);
  const state = await readout(page);
  expect(Object.keys(state.people)).toContain("ada2");
  expect(state.people.ada2).toBe("Ada");
});

test("lifecycle: three writes undo once, and the secret never reaches storage", async ({ page }) => {
  await open(page, "lifecycle");
  await page.locator('[data-action="Clear the draft"]').click();
  await page.locator('[data-action="Three writes, one undo step"]').click();
  await expect.poll(async () => (await readout(page)).value?.title, { timeout: 5000 }).toBe("A title");
  await expect.poll(async () => (await readout(page)).stored, { timeout: 5000 }).not.toBeNull();

  const stored = (await readout(page)).stored as string[];
  expect(stored).not.toContain("secret");

  await page.locator('[data-action="Undo"]').click();
  await page.waitForTimeout(150);
  const undone = await readout(page);
  expect(undone.value.title).toBe("");
  expect(undone.value.notes).toBe("");
});

test("dynamic: a refused document mounts nothing and says why", async ({ page }) => {
  await open(page, "dynamic");
  await page.waitForTimeout(150);
  const good = await readout(page);
  expect(good.ok).toBe(true);
  expect(good.controlsMounted).toBeGreaterThan(0);

  for (const label of ["a kind nobody declared", "a name that is not a path"]) {
    await page.locator(`[data-action="${label}"]`).click();
    await page.waitForTimeout(150);
    const refused = await readout(page);
    expect(refused.controlsMounted, `${label} mounted controls`).toBe(0);
    expect((refused.diagnostics ?? []).length, `${label} produced no diagnostic`).toBeGreaterThan(0);
  }
});

test("security: markup is intercepted at the boundary, not by the renderer", async ({ page }) => {
  await open(page, "security");
  await page.locator('[data-action="Paste markup"]').click();
  await page.locator('[data-action="Paste 300 characters"]').click();
  await page.waitForTimeout(150);
  const state = await readout(page);
  expect(state.value.bio).not.toContain("<img");
  expect(state.lengths.nickname).toBeLessThanOrEqual(24);
  expect(state.elementsInjected).toBe(0);
  expect(state.violations.length).toBeGreaterThan(0);
});
