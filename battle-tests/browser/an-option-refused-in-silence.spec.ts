/**
 * An option a document says is unavailable.
 *
 * A document may declare an option disabled, and the parser keeps that member — so by the time a
 * renderer receives the list, "not available" is part of what it was told. What a person then meets
 * depends on the shape the field takes.
 *
 * In the native shape the platform does the work: a disabled `<option>` is announced as unavailable,
 * skipped by the keyboard, and cannot be chosen. In the combobox shape the renderer owns all three,
 * and getting only the last one right is the failure this file is about: the option looks like every
 * other option, reads to a screen reader like every other option, invites the press — and the press
 * does nothing. No message, no movement, no reason. A person who cannot see the list concludes the
 * control is broken, and a person who can concludes they mis-clicked and tries again.
 *
 * Refusing the value is necessary and is not sufficient. The refusal has to be legible *before* it
 * happens, which is what `aria-disabled` on the option is for.
 *
 * The check is by shape rather than by renderer, because which shape a field takes is a decision the
 * field makes and not a difference between adapters — a renderer that draws a native select is
 * measured on the platform's own marking, one that draws a listbox on the ARIA equivalent.
 *
 * **The enabled sibling is asserted too.** A renderer that marked every option unavailable would
 * satisfy a check that only looked at the disabled one, and would be a worse control than the one
 * this file is about.
 *
 * The option element is found through the contract's own part rather than through a role: the two
 * kinds draw their options as different things, and a selector written from one of them reports the
 * other as having no options at all.
 *
 * Claims under attack: A11Y-004, UI-011.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [
  { value: "a", label: "Libero" },
  { value: "b", label: "Occupato", disabled: true },
];

for (const host of HOSTS) {
  for (const kind of ["select", "multiselect"]) {
    test(`an unavailable option says so, ${kind}, ${host.name}`, async ({ page }) => {
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      const id = `refused_${kind}`;
      await page.evaluate(({ api, id, kind, options }) => {
        (window as never as Api)[api].mountFields(id, [{ name: "s", kind, label: "Posto", options }] as never);
      }, { api: host.api, id, kind, options: OPTIONS });

      const root = `[data-form="${id}"]`;
      await page.locator(root).waitFor({ timeout: 5_000 });

      const native = await page.locator(`${root} select`).count() > 0;
      if (native) {
        const marks = await page.evaluate((sel) => Array.from(document.querySelectorAll<HTMLOptionElement>(`${sel} select option`))
          .filter((option) => option.value !== "")
          .map((option) => ({ value: option.value, unavailable: option.disabled })), root);
        expect(marks, `${host.name} drew a native ${kind} whose options do not carry the document's own availability`)
          .toEqual([{ value: "a", unavailable: false }, { value: "b", unavailable: true }]);
        return;
      }

      await page.locator(`${root} [aria-haspopup]`).first().click({ timeout: 5_000 });
      const part = (MDY_WIDGET_CONTRACTS[kind]?.parts?.option?.classes ?? [])
        .map((className: string) => `.${className}`).join("");
      // A kind whose contract names no option part cannot be measured by this file, and saying so is
      // better than measuring whatever a role happens to match.
      expect(part, `the contract names no option part for ${kind}`).not.toBe("");
      const selector = `${part}, [role='option']`;
      await expect(page.locator(selector).first()).toBeVisible({ timeout: 5_000 });

      const marks = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((option) => ({
        label: (option.textContent ?? "").trim(),
        // Either spelling is a legitimate way to say it; a renderer using neither says nothing.
        unavailable: option.getAttribute("aria-disabled") === "true" || option.hasAttribute("disabled"),
      })), selector);

      const free = marks.find((mark) => mark.label.startsWith("Libero"));
      const taken = marks.find((mark) => mark.label.startsWith("Occupato"));
      expect(free?.unavailable, `${host.name}: the available option in a ${kind} is marked unavailable`).toBe(false);
      expect(
        taken?.unavailable,
        `${host.name}: a ${kind} draws the unavailable option exactly like the available one, so the only way to `
        + "discover it cannot be chosen is to choose it and watch nothing happen",
      ).toBe(true);
    });
  }
}
