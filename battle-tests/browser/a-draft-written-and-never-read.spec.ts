/**
 * A draft that is kept and a draft that comes back.
 *
 * A draft exists for one moment: the person's tab closed, or the browser crashed, or they navigated
 * away mid-form, and they return. Everything else it does is preparation for that moment. A form
 * that writes a draft faithfully and does not read it back has done all of the work and none of the
 * good — and it has done it silently, because writing is the half that leaves evidence and reading is
 * the half a person notices.
 *
 * It is worse than not offering drafts at all. A consumer who asks for one and watches storage fill
 * up has every reason to believe the feature works, and the person who needed it is the only one who
 * finds out otherwise, at the moment they can least afford to.
 *
 * The two halves are asserted separately so that a failure names which one broke:
 *
 *   - the draft is **written** — the key reached the form and something was persisted under it;
 *   - the draft is **read back** — a form built afresh against that key shows what was typed.
 *
 * The second half is driven across a **reload**, not a remount. A remount inside a live page shares
 * a module graph, a form registry and whatever the previous mount left in memory, so a renderer can
 * appear to restore a draft while only remembering it. Reloading throws all of that away and leaves
 * storage as the only thing that crossed, which is the path a draft is actually for.
 *
 * The value is typed into the control rather than written through the model, because a draft is
 * meant to capture what a person did.
 *
 * Claims under attack: PER-003, PER-004.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const TYPED = "scritto prima del ricarico";

for (const host of HOSTS) {
  test(`a draft is read back, not only written, ${host.name}`, async ({ page }) => {
    const key = `battle_draft_${host.name}`;

    // Both spellings, because the door differs: a form mounted over a field list takes the whole
    // option object, a component takes the key as an input. A host is free to read either.
    const mount = async (id: string) => {
      await page.evaluate(({ api, id, key }) => {
        (window as never as Api)[api].mountFields(
          id,
          [{ name: "who", kind: "text", label: "Chi" }] as never,
          { draft: { key, debounceMs: 0 }, draftKey: key } as never,
        );
      }, { api: host.api, id, key });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
    };

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    // A draft left by an earlier run would restore a value this run never typed, and the assertion
    // below would pass on somebody else's evidence.
    await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), key);

    await mount("first");
    await page.locator('[data-form="first"] input').first().fill(TYPED);
    await page.waitForTimeout(600);

    const written = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), key);
    expect(written, `${host.name} was given a draft key and persisted nothing under it`).not.toBeNull();

    await page.reload();
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount("second");
    await page.waitForTimeout(1_200);

    const shown = await page.evaluate(() =>
      (document.querySelector('[data-form="second"] input') as HTMLInputElement | null)?.value ?? null);

    await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), key);

    expect(
      shown,
      `${host.name} wrote the draft and did not read it back: storage still holds it after the reload, `
      + "and the form came up empty",
    ).toBe(TYPED);
  });
}
