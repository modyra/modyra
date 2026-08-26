/**
 * Walking a palette with the keyboard.
 *
 * A colours field opens onto a panel of ten swatches carrying `role="listbox"` with `role="option"`
 * children. That role is a promise about a keyboard model, and a screen reader repeats it to the
 * user as an instruction: arrows move within this, and it is one place rather than ten. The four
 * keys the contract declares for an open palette — `ArrowDown`, `ArrowUp`, `Home`, `End` — are that
 * promise being kept, and a person told to press arrows who meets silence concludes the control is
 * broken rather than falling back to Tab.
 *
 * The keys declare no part, so they hold wherever the keyboard legitimately stands once the panel is
 * open, and it opens with focus already on a swatch.
 *
 * **The palette is walked as a list, not as a grid.** `ArrowDown` is "the next swatch", not "the
 * swatch below": the ten wrap into rows for display, so the eye sees two dimensions while the
 * keyboard walks one. That is why `ArrowLeft` and `ArrowRight` are absent from the contract rather
 * than missing from it, and this file must not grow an expectation that they answer.
 *
 * Two things make this measurable, and getting either wrong reports a working palette as a dead one:
 *
 *   - **The reading position is an index within the set.** Every swatch wears the same class and
 *     none carries an id, so an observer describing the focused element reports one string for all
 *     ten and sees a walk across the whole palette as no movement.
 *   - **A key is pressed from where it has somewhere to go.** `Home` on the first swatch moves
 *     nothing, exactly as a `Home` nothing listens for moves nothing.
 *
 * The guard is placed accordingly: focus is put on the first swatch and then the last, and the two
 * readings must differ, before any key is accused. A `Tab` guard would not do — `Tab` leaves the
 * palette for a differently-classed element, so an observer blind to every move *within* the set
 * still passes it. It proves the one move that does not need proving.
 *
 * The observation is taken document-wide, because a popup is rendered outside the control it
 * belongs to.
 *
 * Claims under attack: A11Y-004, UI-011.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KEYBOARD } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The keys the contract declares as moving through an open colours popup. */
const MOVES = (MDY_WIDGET_KEYBOARD.colors ?? [])
  .filter((binding) => binding.when === "open" && binding.intent === "move")
  .map((binding) => binding.key);

/**
 * Where the reading position is, **as an index within the set it moves through**.
 *
 * Every swatch wears the same class and none carries an id, so an observer that describes the
 * focused element — tag, id, classes — reports the same string for all ten and sees a walk across
 * the whole palette as no movement at all. The position of a roving index is *which* sibling holds
 * it, and nothing about the sibling itself says which one it is.
 *
 * `-1` is the position being outside the set, which is a different place from any position in it:
 * a key that leaves the palette must not read as a key that moved within it.
 */
const position = (page: import("@playwright/test").Page) => page.evaluate(() => {
  // Only the swatches a person can reach. A palette may hold a place for a colour that has not been
  // chosen yet and keep it out of sight until it has; such an element is not in the accessibility
  // tree, takes no focus, and counting it would make every reading below one place wrong.
  const swatches = Array.from(document.querySelectorAll(".mdy-color-swatch, [role='option'], [role='gridcell']"))
    .filter((one) => (one as HTMLElement).offsetParent !== null || one.getClientRects().length > 0);
  const active = document.activeElement;
  const focused = active === null ? -1 : swatches.indexOf(active);
  // A renderer may hold the position without moving DOM focus, so the same index is read from the
  // three attributes that can carry it, and the first one that names a swatch wins.
  const described = document.querySelector("[aria-activedescendant]")?.getAttribute("aria-activedescendant") ?? null;
  const byDescription = described === null ? -1 : swatches.findIndex((s) => s.id === described);
  const byMark = swatches.findIndex((s) => s.getAttribute("aria-selected") === "true" || s.getAttribute("tabindex") === "0");
  return `focus=${focused} described=${byDescription} marked=${byMark}`;
});

for (const host of HOSTS) {
  test(`a palette is walkable with the keys it declares, ${host.name}`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const id = "palette";
    await page.evaluate(({ api, id }) => {
      (window as never as Api)[api].mountFields(id, [{ name: "c", kind: "colors", label: "Colore" }] as never);
    }, { api: host.api, id });

    const root = `[data-form="${id}"]`;
    await page.locator(root).waitFor({ timeout: 5_000 });
    await page.locator(`${root} [aria-haspopup]`).first().click({ timeout: 5_000 });

    const swatches = page.locator(
      ".mdy-color-swatch:visible, [role='option']:visible, [role='gridcell']:visible",
    );
    await expect(swatches.first()).toBeVisible({ timeout: 5_000 });
    const count = await swatches.count();
    // A palette with one swatch has no second place for a move to go, and every key would read as
    // dead for a reason that is not the one this spec is about.
    expect(count, `${host.name} opened a palette holding ${count} swatch(es), which nothing can move through`)
      .toBeGreaterThan(1);

    // **The observer is proved against a move inside the set, not against one that leaves it.**
    // `Tab` walks out of the palette onto a differently-classed element, so an observer blind to
    // every move *within* the swatches still passes a Tab guard — it proves the one move that does
    // not need proving. Focus is placed on the first and then the last swatch by hand, and the
    // reading must be seen to differ, before any key is accused of moving nothing.
    await swatches.first().focus();
    const atFirst = await position(page);
    await swatches.nth(count - 1).focus();
    expect(await position(page), `${host.name}: focus on the first and the last swatch read alike, so this drive cannot see a move within the palette at all`)
      .not.toBe(atFirst);
    await swatches.first().focus();

    // What the panel claims to be. A composite role is a promise about a keyboard model, and it is
    // the promise that turns the keys below from a cost into a defect.
    const claimed = await page.evaluate(() => {
      const first = document.querySelector(".mdy-color-swatch, [role='option'], [role='gridcell']");
      const container = first?.parentElement ?? null;
      return {
        container: container?.getAttribute("role") ?? "none",
        options: first?.getAttribute("role") ?? "none",
      };
    });
    const composite = ["listbox", "grid", "radiogroup", "menu", "tablist", "tree"].includes(claimed.container);

    /**
     * Where a key has to be pressed from for its answer to mean anything.
     *
     * `Home` pressed while already on the first swatch moves nothing, and so does a `Home` nothing
     * is listening for. The two are indistinguishable, and reading the first as the second is how a
     * working key gets reported dead — so each key is driven from the end of the palette it is not
     * aimed at.
     */
    const from = (key: string) => (key === "Home" || key === "ArrowUp" ? count - 1 : 0);

    const dead: string[] = [];
    for (const key of MOVES) {
      await swatches.nth(from(key)).focus();
      await page.waitForTimeout(80);
      const start = await position(page);
      await page.keyboard.press(key);
      await page.waitForTimeout(120);
      if (await position(page) === start) dead.push(key);
    }

    // Reported whichever way it goes: a reader of a failure needs to know which of the two branches
    // the renderer is standing on, because that decides which repair is open to it.
    expect(
      { composite: composite ? claimed.container : "none", dead },
      `${host.name}: the panel claims ${claimed.container} with ${claimed.options} children — a keyboard model it promises `
      + `and does not keep. ${dead.length} of the ${MOVES.length} keys it declares do nothing (${dead.join(", ")}), `
      + `and its ${count} swatches take ${count} tab stops. Either honour the role or stop claiming it.`,
    ).toEqual({ composite: composite ? claimed.container : "none", dead: composite ? [] : dead });
  });
}
