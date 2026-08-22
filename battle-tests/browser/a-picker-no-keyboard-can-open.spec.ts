/**
 * Opening a picker without a mouse.
 *
 * `MDY_WIDGET_KEYBOARD` declares, for every kind with a popup, the keys that open it while closed —
 * `Enter` for the date and time fields, `Enter`, `Space` and either arrow for the listboxes. The
 * suite's keyboard sweep asks whether those bindings do *something*; it does not ask whether the
 * person pressing them could have got there.
 *
 * That is the question here, and it has two halves that only fail together. A toggle taken out of the
 * tab order is fine as long as the control beside it opens the popup — one tab stop instead of two,
 * which is the better design. A control that does not open the popup is fine as long as the toggle is
 * reachable. Do both and the picker cannot be opened at all without a mouse.
 *
 * So the check is deliberately generous: every part a keyboard can actually reach — `tabindex="-1"`
 * excluded, because that is precisely what "cannot reach" means — is focused in turn and offered every
 * key the contract names. The kind passes if *any* of them opens it.
 *
 * A field the browser draws is excluded: its popup is not in the document and the platform owns the
 * keys.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

/** Everything a keyboard can land on inside a field, in tab order. */
const REACHABLE = "button, input, select, textarea, [tabindex]";

for (const host of HOSTS) {
  test(`every picker opens without a mouse, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const unopenable: string[] = [];
    let tried = 0;

    for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
      const id = `kb-${kind}`;
      await page.evaluate(({ mountId, k, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options: [{ value: "a", label: "A" }] }]);
      }, { mountId: id, k: kind, api: host.api });
      await page.waitForTimeout(240);

      // A field with no expanded state to read is one the browser draws for us.
      const readable = await page.evaluate((sel) =>
        document.querySelector(`${sel} [aria-expanded]`) !== null, `[data-form="${id}"]`);
      if (!readable) {
        await page.evaluate(({ mountId, api }) =>
          (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
          { mountId: id, api: host.api });
        continue;
      }

      const keys = (MDY_WIDGET_KEYBOARD[kind] ?? [])
        .filter((each) => each.when === "closed" && each.intent === "open")
        .map((each) => each.key);

      // The premise: the contract says this kind opens on a key at all.
      expect(keys.length, `${kind} declares no key that opens it`).toBeGreaterThan(0);

      const reachable = await page.evaluate(({ sel, selector }) =>
        Array.from(document.querySelectorAll(`${sel} ${selector}`))
          .filter((each) => (each.getAttribute("tabindex") ?? "0") !== "-1" && each.getClientRects().length > 0)
          .length, { sel: `[data-form="${id}"]`, selector: REACHABLE });

      let opened = false;
      for (let part = 0; part < reachable && !opened; part += 1) {
        for (const key of keys) {
          await page.evaluate(({ sel, selector, index }) => {
            const parts = Array.from(document.querySelectorAll(`${sel} ${selector}`))
              .filter((each) => (each.getAttribute("tabindex") ?? "0") !== "-1" && each.getClientRects().length > 0);
            (parts[index] as HTMLElement | undefined)?.focus();
          }, { sel: `[data-form="${id}"]`, selector: REACHABLE, index: part });

          await page.keyboard.press(key === " " ? "Space" : key).catch(() => undefined);
          await page.waitForTimeout(200);
          tried += 1;

          if (await page.evaluate((sel) =>
            document.querySelector(`${sel} [aria-expanded="true"]`) !== null, `[data-form="${id}"]`)) {
            opened = true;
            await page.keyboard.press("Escape");
            await page.waitForTimeout(160);
            break;
          }
        }
      }

      if (!opened) unopenable.push(`${kind} (${reachable} reachable part(s), keys ${keys.map((k) => k === " " ? "Space" : k).join("/")})`);

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(70);
    }

    // The control: keys were pressed on reachable parts. A run that found none would report every
    // kind unopenable and mean nothing by it.
    expect(tried, "no key was pressed on any reachable part, so nothing was measured").toBeGreaterThan(5);

    expect(
      unopenable,
      "a picker cannot be opened with the keyboard: no part a keyboard can reach answers a key the contract names",
    ).toEqual([]);
  });
}
