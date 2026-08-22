/**
 * What a page does with a file it will not take, and what it holds when it takes one.
 *
 * `fileSelectionTransition` answers both questions and hands back three things: the value, the files
 * it kept, and the files it turned away. The value is now always a list, whatever `multiple` says —
 * `MDY_VALUE_CONTRACTS.file` declares `file[]` and there is no second shape.
 *
 * A renderer has to use both halves of that answer. Writing the value is the obvious half; the other
 * is that a file the field refused is a thing that happened to the user. They chose it, and the only
 * evidence is a `rejected` array nobody on the page ever sees.
 *
 * So two questions per renderer. After a file the field accepts, does the model hold a list? After a
 * file it does not, does anything on the page say so — a message, a live region, any change at all?
 *
 * The contract has no message for the second. That is part of the finding rather than an excuse: the
 * five published message tables carry a word for an unreadable date and none for a refused file, so a
 * renderer wanting to say it has nothing to say it with.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

const PNG = { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("x") };
const TXT = { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") };

for (const host of HOSTS) {
  test(`a file field holds a list, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("one", [{ name: "x", kind: "file", label: "X" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    const held = () => page.evaluate(({ api }) => {
      const root = document.querySelector('[data-form="one"]');
      const value = (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("one").x;
      return {
        isArray: Array.isArray(value),
        error: (root?.querySelector('[id$="__errors"]')?.textContent ?? "").trim() || null,
      };
    }, { api: host.api });

    // The premise: a file field starts holding the empty list its contract declares.
    expect((await held()).isArray, "a file field did not start as a list").toBe(true);

    await page.locator('[data-form="one"] input[type="file"]').first().setInputFiles(PNG);
    await page.waitForTimeout(420);

    const after = await held();
    expect(after.isArray, "a file field stopped holding a list once a file was picked").toBe(true);
    expect(after.error, "a file the field accepted left the field reporting an error").toBeNull();
  });

  test(`a file the field will not take is not taken in silence, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("pic", [{ name: "x", kind: "file", label: "X", accept: "image/*" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    const page_ = () => page.evaluate(() => {
      const root = document.querySelector('[data-form="pic"]');
      return {
        text: (root?.textContent ?? "").replace(/\s+/g, " ").trim(),
        announced: Array.from(root?.querySelectorAll('[role="status"], [role="alert"], [aria-live]') ?? [])
          .map((each) => (each.textContent ?? "").trim())
          .filter((each) => each !== ""),
      };
    });

    const before = await page_();
    await page.locator('[data-form="pic"] input[type="file"]').first().setInputFiles(TXT);
    await page.waitForTimeout(460);
    const after = await page_();

    // The control: a file it does take changes the page, so "nothing changed" below is the refusal
    // rather than a page that never reacts to a pick at all.
    await page.locator('[data-form="pic"] input[type="file"]').first().setInputFiles(PNG);
    await page.waitForTimeout(460);
    const accepted = await page_();
    expect(accepted.text, "the page did not react to a file the field accepts").not.toBe(before.text);

    expect(
      after.text !== before.text || after.announced.length > 0,
      "a file the field refused changed nothing on the page: the user chose it and was told nothing",
    ).toBe(true);
  });
}
