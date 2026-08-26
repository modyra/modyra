/**
 * Whether a list that is open answers the keyboard, however it came to be open.
 *
 * There are two ways into an open list: press the field, or reach it with the keyboard and press a
 * key. They arrive at the same place — the same panel, over the same field, holding the same options —
 * and from that place a person has to be able to leave. Dismissing an overlay is the one command every
 * overlay owes, and it is owed to a person who used a pointer to open it exactly as much as to one who
 * did not: **the two are frequently the same person**, moving between a mouse and the keys within a
 * single task, and the route in is not a declaration of which they will use next.
 *
 * When the two routes disagree, what a person meets is a panel they opened themselves and cannot
 * close. The field beneath it is covered, the key that closes everything else does nothing, and there
 * is no visible focus to tell them where they are — because the answer to *where is the reading
 * position* is what actually differs, and its absence is invisible until a key is pressed.
 *
 * **This file asserts that the two routes agree, and does not say what they should agree on.** Where
 * focus lands, and what an arrow does once the list is open, are decisions this file leaves alone:
 * a renderer that puts the reading position on the opener and one that puts it on the first option are
 * both answering. What none of them may do is answer through one door and not the other.
 *
 * **The control is the keyboard route.** If dismissal fails for both routes, the two agree, and they
 * agree about a control that never worked — so the keyboard route is asserted to work on its own
 * before the two are compared, and the file says so instead of passing.
 *
 * Claims under attack: A11Y-001, A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The contract's own class for a part, so a rename moves this file with it. */
const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .multiselect.parts;
  return (parts[part]?.classes ?? [])[0] ?? "";
};

const OPTIONS = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

for (const host of HOSTS) {
  test(`an open list answers the keyboard whichever way it was opened, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const mount = async (id: string) => {
      await page.setViewportSize({ width: 1_200, height: 700 });
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      await page.evaluate(({ api, mountId, options }) => {
        (window as never as Api)[api].mountFields(mountId, [{
          name: "m", kind: "multiselect", label: "Scelte", clearable: true, options, initialValue: ["a"],
        }] as never);
      }, { api: host.api, mountId: id, options: OPTIONS });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(350);
    };

    const open = (id: string) => page.evaluate((mountId) =>
      document.querySelector(`[data-form="${mountId}"] [aria-expanded]`)?.getAttribute("aria-expanded") ?? "(none)", id);

    /** Where the reading position is, named by the part it sits in rather than by the element. */
    const reading = () => page.evaluate(() => {
      const active = document.activeElement;
      if (active === null || active === document.body) return "nowhere";
      const named = active.closest("[class*='mdy-']");
      return named === null ? active.tagName.toLowerCase()
        : Array.from(named.classList).find((one) => one.startsWith("mdy-")) ?? active.tagName.toLowerCase();
    });

    /** Opens the list the named way and reports whether the key that dismisses it does. */
    const travel = async (id: string, by: "a press" | "the keyboard") => {
      await mount(id);
      if (by === "a press") {
        // The mark at the trailing edge takes no pointer events, so this press reaches the field.
        const box = await page.locator(`[data-form="${id}"] .${classOf("arrow")}`).first().boundingBox();
        expect(box, `${host.name} drew no mark at the trailing edge to press`).not.toBeNull();
        await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      } else {
        await page.locator(`[data-form="${id}"] .${classOf("trigger")}`).focus();
        await page.keyboard.press("ArrowDown");
      }
      await page.waitForTimeout(450);
      const opened = await open(id);
      const at = await reading();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      return { opened, at, dismissed: (await open(id)) === "false" };
    };

    const byKeyboard = await travel("in_keys", "the keyboard");
    const byPress = await travel("in_press", "a press");

    // Both routes reached the same place. A route that did not open the list is not a second way in,
    // and comparing what the keyboard does next would be comparing an open panel with no panel.
    expect(
      [byKeyboard.opened, byPress.opened],
      `${host.name}: the list is ${byKeyboard.opened} after the keyboard route and ${byPress.opened} `
      + "after a press, so the two did not arrive at the same place and there is nothing to compare",
    ).toEqual(["true", "true"]);

    // The control: the keyboard route works on its own. Without it, two routes that both fail agree.
    expect(
      byKeyboard.dismissed,
      `${host.name}: a list opened with the keyboard does not close on the key that closes overlays, `
      + "so this renderer has no working dismissal to compare the other route against",
    ).toBe(true);

    expect(
      byPress.dismissed,
      `${host.name}: a list opened with a press does not close on the key that closes overlays, while `
      + `one opened with the keyboard does. The reading position after the press is ${byPress.at}, `
      + `where after the keyboard it is ${byKeyboard.at} — so a person who opened this panel with a `
      + "mouse and reached for the keys is holding a panel they cannot dismiss, over the field it "
      + "covers, with nothing focused to tell them where they are.",
    ).toBe(true);
  });
}
