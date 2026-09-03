/**
 * Whether the way out of a panel stays open when a modifier happens to be held.
 *
 * Escape is the one gesture that has no conditions. A person who reaches for it is leaving, and the
 * cost of the two mistakes is not symmetric: a panel that closes when it should not costs a reopen,
 * and a panel that refuses to close leaves somebody inside it with the way out shut — under a
 * modifier nobody thinks to test. So a binding that adds is refused while a modifier is held, and a
 * binding that removes is honoured whatever is held.
 *
 * Six kinds declare that policy on Escape. This asks each of them, in the gesture a person makes:
 * open the panel by its own declared opener, hold the accelerator, press Escape, and see whether the
 * panel is gone.
 *
 * **The control is in the same run.** Bare Escape must close it too. Without that, a panel that never
 * opened, or a renderer whose panel closes on its own, passes by having nothing to refuse.
 *
 * Claims under attack: UI-002, A11Y-002.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
interface Binding { key: string; when?: string; intent?: string; on?: string; modifier?: string }

const OPENERS = MDY_POPUP_OPENERS as unknown as Record<string, { opener?: string } | undefined>;
const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>;
const KEYBOARD = MDY_WIDGET_KEYBOARD as unknown as Record<string, Binding[]>;
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const PRIMARY = process.platform === "darwin" ? "Meta" : "Control";

/** The kinds whose open panel declares that Escape answers whatever is held with it. */
const KINDS = Object.keys(KEYBOARD).filter((kind) => (KEYBOARD[kind] ?? []).some(
  (binding) => binding.key === "Escape" && binding.when === "open" && binding.modifier === "any"));

const openerSelector = (kind: string): string | undefined => {
  const opener = OPENERS[kind]?.opener;
  const classes = opener === undefined ? [] : CONTRACTS[kind].parts[opener]?.classes ?? [];
  return classes.length === 0 ? undefined : classes.map((one) => `.${one}`).join("");
};

/** The keys a kind declares for opening, so the panel is reached the way the table says. */
const openingKeys = (kind: string): string[] => [
  ...new Set((KEYBOARD[kind] ?? [])
    .filter((binding) => binding.when === "closed" && binding.intent === "open" && binding.modifier === undefined)
    .map((binding) => binding.key)),
];

for (const host of HOSTS) {
  test(`escape leaves a panel whatever is held with it, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(KINDS.length, "no kind declares an Escape that answers whatever is held").toBeGreaterThan(0);

    const mount = async (id: string, kind: string) => {
      await page.evaluate(({ api, mountId, k, options }) => {
        (window as never as Api)[api].mountFields(mountId, [{ name: "f", kind: k, label: "L", options }] as never);
      }, { api: host.api, mountId: id, k: kind, options: OPTIONS });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(120);
    };

    /**
     * Whether *this* field's panel is open, asked of the field rather than of the page.
     *
     * A page-wide search for an overlay answers about whichever panel any earlier mount left behind,
     * and reports it as this one. The opener says whether it is expanded, and where it does not, the
     * link it declares to its panel is followed — which is the contract's own way of naming a panel
     * wherever a renderer chooses to draw it.
     */
    const isOpen = (id: string, selector: string) => page.evaluate(({ mountId, sel }) => {
      const root = document.querySelector(`[data-form="${mountId}"]`);
      const opener = root?.querySelector(sel) ?? root?.querySelector("[aria-expanded]") ?? null;
      if (opener?.getAttribute("aria-expanded") === "true") return true;
      if (opener?.getAttribute("aria-expanded") === "false") return false;
      const controls = opener?.getAttribute("aria-controls");
      if (controls === null || controls === undefined) return false;
      const panel = document.getElementById(controls);
      return panel !== null && panel.getBoundingClientRect().height > 0;
    }, { mountId: id, sel: selector });

    /** Opens the panel with whichever declared key this renderer answers, and says so. */
    const openIt = async (id: string, kind: string, selector: string) => {
      for (const key of openingKeys(kind)) {
        await page.evaluate(({ mountId, sel }) => {
          document.querySelector(`[data-form="${mountId}"]`)?.querySelector<HTMLElement>(sel)?.focus();
        }, { mountId: id, sel: selector });
        await page.keyboard.press(key === " " ? "Space" : key);
        await page.waitForTimeout(220);
        if (await isOpen(id, selector)) return true;
      }
      return false;
    };

    const trapped: string[] = [];
    const closedBare: string[] = [];
    const neverOpened: string[] = [];

    for (const kind of KINDS) {
      const selector = openerSelector(kind);
      if (selector === undefined) { neverOpened.push(`${kind}: no opener declared`); continue; }

      const bare = `bare_${kind}`;
      await mount(bare, kind);
      if (!(await openIt(bare, kind, selector))) { neverOpened.push(`${kind}: no declared key opened it`); continue; }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
      if (!(await isOpen(bare, selector))) closedBare.push(kind);

      const held = `held_${kind}`;
      await mount(held, kind);
      if (!(await openIt(held, kind, selector))) continue;
      await page.keyboard.press(`${PRIMARY}+Escape`);
      await page.waitForTimeout(250);
      if (await isOpen(held, selector)) trapped.push(`${kind}/${PRIMARY}+Escape`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);
    }

    expect(
      closedBare.length,
      `${host.name} closed no panel on a bare Escape`
      + `${neverOpened.length > 0 ? ` (${JSON.stringify(neverOpened)})` : ""}, so a panel that never `
      + "opened would satisfy the claim below by having nothing to refuse",
    ).toBeGreaterThan(2);

    expect(
      trapped,
      `${host.name} keeps ${JSON.stringify(trapped)} open when Escape arrives with the accelerator `
      + "held. Escape is the way out and a way out with conditions is not one: a panel that closes "
      + "when it should not costs a reopen, and one that refuses to close leaves a person inside it "
      + `with no way back to the page. All ${KINDS.length} of these kinds declare that Escape answers `
      + "whatever is held with it.",
    ).toEqual([]);
  });
}
