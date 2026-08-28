/**
 * Whether a key declared without a modifier still acts when a modifier is held down.
 *
 * A binding in the published keyboard table either names a modifier or does not, and the two are
 * different gestures. `Cmd+Z` is not `Z`: a person reaching for undo, for the browser's own find, or
 * for a screen reader's command holds a modifier and expects the plain key's meaning to stay out of
 * the way. A control that answers the bare key to a modified press does two things at once, and the
 * one nobody asked for is the one that changes the value.
 *
 * The check is the opening gesture, because its outcome is unambiguous: the panel is open or it is
 * not. Each kind's opener is asked of `MDY_POPUP_OPENERS` and its key of the keyboard table rather
 * than guessed, and the key is pressed at the part the table names.
 *
 * **Space on a button is the platform's, not ours.** A browser activates a focused button on a held
 * Space exactly as on a bare one — it fires a click, and a click carries no record of the keys that
 * were down. Refusing it would mean suppressing the activation of an ordinary button, making this the
 * one button on the page that does not answer where every other one does. The exemption is measured
 * here rather than written down: a bare button is put in the page and pressed, and Space is exempt
 * only for as long as that button activates. A browser that stops doing it takes the exemption with
 * it.
 *
 * **Both directions, in the same run.** The plain press must open — otherwise a control that answers
 * no key at all satisfies the claim by being dead. And a binding that *does* declare a modifier must
 * not fire without it, which is the same rule read from the other end.
 *
 * Claims under attack: UI-002, A11Y-002.
 */

import { expect, test } from "@playwright/test";
import {
  MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD, MDY_WIDGET_KINDS,
} from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Binding = { key: string; when?: string; intent?: string; on?: string; modifier?: string };

const OPENERS = MDY_POPUP_OPENERS as unknown as Record<string, { opener?: string } | undefined>;
const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>;
const KEYBOARD = MDY_WIDGET_KEYBOARD as unknown as Record<string, Binding[]>;
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
/** What the table calls `primary`, spelled the way a keyboard press is written. */
const PRIMARY = process.platform === "darwin" ? "Meta" : "Control";

/** The keys a kind declares for opening its panel while it is closed. */
const openingKeys = (kind: string): string[] => [
  ...new Set((KEYBOARD[kind] ?? [])
    .filter((binding) => binding.when === "closed" && binding.intent === "open" && binding.modifier === undefined)
    .map((binding) => binding.key)),
];

const openerSelector = (kind: string): string | undefined => {
  const opener = OPENERS[kind]?.opener;
  const classes = opener === undefined ? [] : CONTRACTS[kind].parts[opener]?.classes ?? [];
  return classes.length === 0 ? undefined : classes.map((one) => `.${one}`).join("");
};

for (const host of HOSTS) {
  test(`a key declared bare does not act with a modifier held, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = async (id: string, kind: string) => {
      await page.evaluate(({ api, mountId, k, options }) => {
        (window as never as Api)[api].mountFields(mountId, [{ name: "f", kind: k, label: "L", options }] as never);
      }, { api: host.api, mountId: id, k: kind, options: OPTIONS });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(120);
    };

    /** Puts focus on the part the table names for this kind, and says whether it landed. */
    const focusOpener = (id: string, selector: string) => page.evaluate(({ mountId, sel }) => {
      const root = document.querySelector(`[data-form="${mountId}"]`);
      const element = root?.querySelector<HTMLElement>(sel) ?? null;
      element?.focus();
      return element !== null && root?.contains(document.activeElement) === true;
    }, { mountId: id, sel: selector });

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

    // What the platform does to a button of its own, with nothing of this library attached.
    const platformActivatesOnHeldSpace = await (async () => {
      await page.evaluate(() => {
        const button = document.createElement("button");
        button.id = "mdy-platform-probe";
        (window as never as Record<string, boolean>).mdyProbeClicked = false;
        button.addEventListener("click", () => { (window as never as Record<string, boolean>).mdyProbeClicked = true; });
        document.body.append(button);
      });
      await page.locator("#mdy-platform-probe").focus();
      await page.keyboard.press(`${PRIMARY}+Space`);
      await page.waitForTimeout(120);
      const clicked = await page.evaluate(() => (window as never as Record<string, boolean>).mdyProbeClicked === true);
      await page.evaluate(() => document.querySelector("#mdy-platform-probe")?.remove());
      return clicked;
    })();

    const opened: string[] = [];
    const platformsOwn: string[] = [];
    const openedWithModifier: string[] = [];
    const unreachable: string[] = [];

    for (const kind of MDY_WIDGET_KINDS) {
      const selector = openerSelector(kind);
      const keys = openingKeys(kind);
      if (selector === undefined || keys.length === 0) continue;

      for (const key of keys) {
        const press = key === " " ? "Space" : key;

        const bare = `bare_${kind}_${press}`;
        await mount(bare, kind);
        if (!(await focusOpener(bare, selector))) { unreachable.push(`${kind}/${press}`); continue; }
        await page.keyboard.press(press);
        await page.waitForTimeout(250);
        if (await isOpen(bare, selector)) opened.push(`${kind}/${press}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(150);

        const held = `held_${kind}_${press}`;
        await mount(held, kind);
        if (!(await focusOpener(held, selector))) continue;
        const onAButton = await page.evaluate(() => document.activeElement?.tagName.toLowerCase() === "button");
        if (press === "Space" && onAButton && platformActivatesOnHeldSpace) {
          platformsOwn.push(`${kind}/${PRIMARY}+Space`);
          continue;
        }
        await page.keyboard.press(`${PRIMARY}+${press}`);
        await page.waitForTimeout(250);
        if (await isOpen(held, selector)) openedWithModifier.push(`${kind}/${PRIMARY}+${press}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(150);
      }
    }

    expect(
      opened.length,
      `${host.name} opened nothing on any declared opening key`
      + `${unreachable.length > 0 ? ` (no place to stand for ${JSON.stringify(unreachable)})` : ""}, so a `
      + "control that answers no key at all would satisfy the claim below by being dead",
    ).toBeGreaterThan(2);

    expect(
      openedWithModifier,
      `${host.name} opens on ${JSON.stringify(openedWithModifier)} — a gesture the keyboard table does `
      + "not declare. A binding that names no modifier is the bare key, and a person holding one is "
      + "reaching for something else: their own undo, the browser's find, a screen reader's command. "
      + "Answering both means the press does two things and the second one was not asked for. "
      + (platformsOwn.length > 0
        ? `Left to the platform, which activates a bare button the same way: ${JSON.stringify(platformsOwn)}.`
        : "The platform activates no button of its own on a held Space here, so nothing was exempt."),
    ).toEqual([]);
  });
}
