/**
 * An option the document said could not be chosen.
 *
 * `spec/dynamic-form-v3.schema.json` closes `$defs.option` over exactly three keys — `value`, `label`
 * and `disabled` — so a document saying an option is unavailable is saying it in the contract's own
 * words. A renderer that ignores it hands the form a value the document forbade.
 *
 * Plain refuses the choice: clicking the option leaves the field as it was. Lit renders `select` as a
 * native control and does not mark the option `disabled`, so the browser lets it be chosen, the value
 * lands in the form, and `aria-invalid` stays `"false"` — nothing downstream catches it either.
 *
 * The controls are what make that a renderer's gap rather than a document nobody reads: an *enabled*
 * option can be chosen in both, and the same document is refused by one of them.
 *
 * Claims under attack: DYN-004, UI-003.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta", disabled: true },
];

/** Choose `label` however this renderer offers it, and report the form's value afterwards. */
async function choose(page: import("@playwright/test").Page, host: typeof HOSTS[number], id: string, label: string) {
  // A short bound on every attempt, because refusing is the answer this battle is looking for. Without
  // one, choosing a disabled option waits the whole test out — Playwright retries until the test's own
  // timeout — and the run reports `Test timeout of 120000ms exceeded` instead of what the page did.
  // `.catch()` cannot help: the call does not reject, it simply never settles.
  const REFUSAL = { timeout: 3000 };
  const native = page.locator(`[data-form="${id}"] select`);
  if (await native.count() > 0) {
    await native.selectOption({ label }, REFUSAL).catch(() => undefined);
  } else {
    const toggle = page.locator(`[data-form="${id}"] button`).first();
    await toggle.click(REFUSAL).catch(() => undefined);
    await page.waitForTimeout(240);
    await page.locator("[role='option']", { hasText: label }).first().click({ force: true, ...REFUSAL }).catch(() => undefined);
  }
  await page.waitForTimeout(300);
  return page.evaluate(
    ({ mountId, api }) => (window as never as Record<string, { valueOf(id: string): Record<string, unknown> }>)[api].valueOf(mountId),
    { mountId: id, api: host.api },
  );
}

async function mount(page: import("@playwright/test").Page, host: typeof HOSTS[number], id: string) {
  await page.evaluate(
    ({ mountId, api, options }) => {
      (window as never as Record<string, { mountFields(id: string, f: unknown[], o?: unknown): unknown }>)[api]
        .mountFields(mountId, [{ name: "f", kind: "select", label: "L", options }]);
    },
    { mountId: id, api: host.api, options: OPTIONS },
  );
  await page.waitForTimeout(240);
}

for (const host of HOSTS) {
  test(`${host.name}: an option the document disabled is one nobody can choose`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The control: the offered option can be chosen. Without it, a field that never changes would
    // pass the assertion below by being broken in the other direction.
    await mount(page, host, "open");
    const chose = await choose(page, host, "open", "Alpha");
    expect(chose, JSON.stringify(chose)).toEqual({ f: "a" });

    await mount(page, host, "closed");
    const after = await choose(page, host, "closed", "Beta");
    expect(after, JSON.stringify(after)).toEqual({ f: null });
  });
}
