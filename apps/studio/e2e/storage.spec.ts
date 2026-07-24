import { expect, test } from "@playwright/test";

/**
 * P11 gate: "reload restores, corrupt snapshot recovers." Real IndexedDB
 * in a real browser — this is exactly the part storage.test.mjs (Node,
 * no IndexedDB) cannot cover.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".studio");
});

test("reload restores the last auto-saved session", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-name]").fill("myFieldName");
  await page.locator("[data-name]").blur();
  // autosave is fire-and-forget on commit() — give the IndexedDB write a moment to land.
  await page.waitForTimeout(200);

  await page.reload();
  await page.waitForSelector(".studio");
  await expect(page.locator(".tree-node")).toHaveCount(1);
  // Restore does not preserve "last selected" (there is nothing to restore it from) — select the field explicitly.
  await page.locator("[data-select]").first().click();
  await expect(page.locator("[data-name]")).toHaveValue("myFieldName");
});

test("a corrupt IndexedDB snapshot recovers to a blank project instead of crashing", async ({ page }) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("modyra-studio", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("sessions")) req.result.createObjectStore("sessions");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put({ this: "is not a valid studio project" }, "last");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.reload();
  await page.waitForSelector(".studio");
  await page.waitForTimeout(200); // let the async restore attempt run and fail gracefully

  expect(errors).toEqual([]);
  await expect(page.locator(".title h1")).toHaveText("Untitled form"); // createBlankProject()'s default name
});

test("export via the JSON target, then Import that same file back in, round-trips the real project", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator("[data-add-validator]").selectOption("required");

  await page.locator('[data-inspector-tab="export"]').click();
  await page.locator("[data-export-generate]").click();
  await expect(page.locator(".export-file")).toHaveCount(2);

  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-export-download="project.mdy-studio.json"]').click();
  const download = await downloadPromise;
  const path = await download.path();

  await page.locator('[data-import-button]').locator("input[type=file]").setInputFiles(path);
  await expect(page.locator(".tree-node")).toHaveCount(1);
  await expect(page.locator('[data-select]').first().locator(".node-label")).toContainText("New text");

  // Re-selecting the imported field: the required validator survived the round-trip.
  await page.locator("[data-select]").first().click();
  await expect(page.locator(".validator-row")).toHaveCount(1);
});

test("a malformed import file reports an error and never touches the current project", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  const badFile = { name: "bad.json", mimeType: "application/json", buffer: Buffer.from("not json") };
  await page.locator('[data-import-button]').locator("input[type=file]").setInputFiles(badFile);

  await expect(page.locator("footer")).toContainText("Import failed");
  await expect(page.locator(".tree-node")).toHaveCount(1); // the original field is still there, untouched
});
