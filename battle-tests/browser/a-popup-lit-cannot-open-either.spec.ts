import type { LitHost } from "./host-api";
import { expect, test } from "@playwright/test";

/**
 * The keyboard question, asked of the second renderer.
 *
 * A control declaring `role="combobox"` with `aria-haspopup` has told assistive technology that it
 * owns a popup and that the keyboard opens it. Plain's datepicker and timepicker declare it and open
 * on no key; `a-popup-only-a-mouse-can-open.spec.ts` is that.
 *
 * Lit declares the same thing on the same two kinds, and opens on no key either. Five tried — both
 * arrows, `Alt+ArrowDown`, `Enter`, `Space`, `F4` — against a control the pointer opens: clicking the
 * toggle beside the input sets `aria-expanded` on both and renders the grid.
 *
 * Two renderers built from one contract failing the same way is what separates this from a quirk. It
 * is not that one of them forgot; it is that nothing between them says a declared popup must open
 * from the keyboard.
 *
 * `daterange` is left out of the loop deliberately: in Lit it has no `role="combobox"` at all, so it
 * promises nothing and cannot be held to this. What its inputs *do* carry is `aria-expanded` with no
 * role, which the auditor next door reports as critical.
 */

const KEYS = ["ArrowDown", "ArrowUp", "Alt+ArrowDown", "Enter", " ", "F4"];

const settled = (page) => page.waitForTimeout(160);

test.beforeEach(async ({ page }) => {
  await page.goto("/lit.html");
  await page.waitForFunction(() => (window as never as { battleLitReady?: boolean }).battleLitReady === true);
});

test("a pointer opens both pickers, which is what makes the keyboard the question", async ({ page }) => {
  for (const kind of ["datepicker", "timepicker"]) {
    const id = `mouse-${kind}`;
    await page.evaluate(
      ({ k, mountId }) =>
        (window as never as { battleLit: LitHost }).battleLit.mountFields(mountId, [
          { name: "f", kind: k, label: "L" },
        ]),
      { k: kind, mountId: id },
    );
    await settled(page);

    await page.locator(`[data-form="${id}"] button`).first().click();
    await settled(page);
    const expanded = await page.evaluate(
      (selector) => document.querySelector(`${selector} [role="combobox"]`)?.getAttribute("aria-expanded"),
      `[data-form="${id}"]`,
    );
    expect(expanded, `${kind} did not open on a click`).toBe("true");
  }
});

test("every lit control that declares a popup opens it from the keyboard", async ({ page }) => {
  const closed: Array<{ kind: string; tried: string[] }> = [];

  for (const kind of ["datepicker", "timepicker"]) {
    const opened: string[] = [];
    for (const [index, key] of KEYS.entries()) {
      const id = `kb-${kind}-${index}`;
      await page.evaluate(
        ({ k, mountId }) =>
          (window as never as { battleLit: LitHost }).battleLit.mountFields(mountId, [
            { name: "f", kind: k, label: "L" },
          ]),
        { k: kind, mountId: id },
      );
      await settled(page);

      const combobox = page.locator(`[data-form="${id}"] [role="combobox"]`).first();
      // The premise for each kind: it declares the role that promises this.
      expect(await combobox.count(), `${kind} declares no combobox, so it promises nothing`).toBeGreaterThan(0);

      await combobox.focus();
      await page.keyboard.press(key);
      await settled(page);
      const expanded = await page.evaluate(
        (selector) => document.querySelector(`${selector} [role="combobox"]`)?.getAttribute("aria-expanded"),
        `[data-form="${id}"]`,
      );
      if (expanded === "true") opened.push(key);
    }
    if (opened.length === 0) closed.push({ kind, tried: KEYS });
  }

  expect(closed, JSON.stringify(closed, null, 1)).toEqual([]);
});
