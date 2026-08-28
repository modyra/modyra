/**
 * Every control has a name, whether or not the document gave it one.
 *
 * A label is optional in a document and a name is not. A control with no accessible name is
 * inoperable by anyone who cannot see it: a screen reader announces "edit text" and nothing else,
 * and voice control has nothing to say to reach it. That rule carries no conditional clause — it is
 * not softened by the field being unimportant, or by the page being at fault for omitting the label.
 *
 * **The document being wrong does not make the library right.** A page that declares no label is
 * defective, and a library that lets the omission arrive at a person silently is defective too. What
 * this asks is only the floor: that something is announced. Whether the fallback should be the field's
 * own key, shown as a key rather than dressed as a label, is a separate decision this does not take —
 * every renderer that names the control at all passes here.
 *
 * **The name is the one the platform computes, not the attribute we wrote.** An `aria-label` on an
 * element whose role forbids it is dropped in silence, and a `aria-labelledby` pointing at an id that
 * is not there names nothing while looking correct in the markup. So the reference is followed to its
 * element, `label[for]` and a wrapping `label` are resolved, and what is compared is the text a person
 * would hear.
 *
 * **The control is the same form with a label.** A renderer that names nothing at all would pass the
 * claim by having no controls this can find, so every kind is mounted a second time with a label
 * declared and must be named then.
 *
 * Claims under attack: A11Y-004, UI-002.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** A key a page would plausibly use, and never a word a renderer could mistake for a label. */
const KEY = "citta";
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`every control is announced as something, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = async (id: string, kind: string, label: string | undefined) => {
      await page.evaluate(({ api, mountId, k, options, caption }) => {
        const field: Record<string, unknown> = { name: "citta", kind: k, options };
        if (caption !== undefined) field.label = caption;
        (window as never as Api)[api].mountFields(mountId, [field] as never);
      }, { api: host.api, mountId: id, k: kind, options: OPTIONS, caption: label });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(110);
    };

    /** What a person would hear, resolved the way the platform resolves it. */
    const announced = (id: string) => page.evaluate((mountId) => {
      const root = document.querySelector(`[data-form="${mountId}"]`);
      const control = root?.querySelector<HTMLElement>(
        'input, textarea, select, [role="slider"], [role="radiogroup"], [role="combobox"], [role="group"], button',
      ) ?? null;
      if (control === null) return null;
      const fromReference = (control.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .join(" ").trim();
      const fromAttribute = (control.getAttribute("aria-label") ?? "").trim();
      const fromFor = control.id
        ? (document.querySelector(`label[for="${CSS.escape(control.id)}"]`)?.textContent ?? "").trim()
        : "";
      const fromWrapping = (control.closest("label")?.textContent ?? "").trim();
      return fromReference || fromAttribute || fromFor || fromWrapping;
    }, id);

    const nameless: string[] = [];
    const namedWithALabel: string[] = [];
    const noControl: string[] = [];

    for (const kind of MDY_WIDGET_KINDS) {
      const bare = `bare_${kind}`;
      await mount(bare, kind, undefined);
      const heard = await announced(bare);
      if (heard === null) noControl.push(kind);
      else if (heard === "") nameless.push(kind);

      const captioned = `said_${kind}`;
      await mount(captioned, kind, "Città");
      if ((await announced(captioned) ?? "") !== "") namedWithALabel.push(kind);
    }

    expect(
      namedWithALabel.length,
      `${host.name} announces nothing for any kind even when the document declares a label`
      + `${noControl.length > 0 ? ` (no control found for ${JSON.stringify(noControl)})` : ""}, so the `
      + "silence below is this run failing to find the controls rather than the controls being nameless",
    ).toBeGreaterThan(10);

    expect(
      nameless,
      `${host.name} leaves ${JSON.stringify(nameless)} with no accessible name when the document `
      + `declares no label — nothing to announce and nothing for voice control to say. The page `
      + `omitting the label is a defect of the page; letting the omission reach a person in silence is `
      + `a defect here. A key such as "${KEY}" is a poor label and it is a name, and this asks only `
      + "for the floor: that the control is announced as something.",
    ).toEqual([]);
  });
}
