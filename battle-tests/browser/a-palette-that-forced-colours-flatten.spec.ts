/**
 * Whether a control for choosing a colour still offers a choice when the colours are taken away.
 *
 * Some people replace every colour a page asks for with a small palette of their own — a handful of
 * pairs chosen for their own eyes, applied over whatever a site intended. Text, buttons, borders: all
 * of it comes out in those pairs, and that is the point of the setting. It costs a page nothing,
 * because in almost every control the colour was decoration and the meaning was in the words.
 *
 * **Here the colour is the content.** A swatch has nothing else: no label, no shape that differs from
 * its neighbour, no text. When the palette is replaced, six swatches come out in two paints — and the
 * control has stopped being a choice while looking exactly like one. A person is offered a row of
 * identical squares and asked which colour they want.
 *
 * **And every instrument reports health.** Contrast is measured between a thing and its background,
 * and the paints a forced palette supplies are chosen to contrast well: a checker sweeps the row and
 * finds every swatch comfortably legible against what is behind it. Nothing measures whether the
 * swatches differ from *each other*, because in every other control that question is meaningless. The
 * defect passes the whole toolbox.
 *
 * The remedy is not this file's to choose, but it exists and is narrow: a page may tell the browser
 * that a particular element's colour is its content rather than its decoration. Which elements deserve
 * that is a design decision; that these ones do is what the failure below says.
 *
 * **Two premises, and the second cost this file a false green.** The swatches must differ before the
 * palette is forced, or there was no choice to lose. And **the forcing must have taken** — the query
 * must match *and* something must actually have been repainted. The way a test runner is asked for
 * this matters: setting it when the browser context is made left the page reporting `forced-colors:
 * none` while the run believed otherwise, and every swatch kept its colour. Measured that way, this
 * file would have reported a control in perfect health.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The contract's own class for a part, so a rename moves this file with it. */
const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .colors.parts;
  return (parts[part]?.classes ?? [])[0] ?? "";
};

/** Six colours a person could tell apart at a glance, and no two of them close. */
const PRESETS = ["#e63946", "#f1faee", "#a8dadc", "#457b9d", "#1d3557", "#4361ee"];

for (const host of HOSTS) {
  test(`a row of colours is still a choice under a forced palette, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api, presets }) => {
      (window as never as Api)[api].mountFields("forced", [{
        name: "c", kind: "colors", label: "Colore", presets,
      }] as never);
    }, { api: host.api, presets: PRESETS });
    await page.locator('[data-form="forced"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(300);

    const opener = page.locator(`[data-form="forced"] .${classOf("toggle")}`).first();
    if (await opener.count() > 0) {
      await opener.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(450);
    }

    /** Every swatch's paint, wherever the panel is drawn. */
    const paints = () => page.evaluate((swatch) =>
      (Array.from(document.querySelectorAll(`.${swatch}`)) as HTMLElement[]).map((one) => {
        const style = getComputedStyle(one);
        return `${style.backgroundColor}|${style.borderColor}|${style.outlineColor}`;
      }), classOf("swatch"));

    const before = await paints();
    expect(
      before.length,
      `${host.name} drew no swatches, so there is no row of colours here to lose`,
    ).toBeGreaterThan(1);
    expect(
      new Set(before).size,
      `${host.name} draws ${before.length} swatches in ${new Set(before).size} paint(s) before any `
      + "palette is forced, so they were not telling each other apart to begin with and this file is "
      + "measuring something else",
    ).toBe(before.length);

    // The forcing, through the door that works. Asked for when the context is built, the page goes on
    // reporting `forced-colors: none` and nothing is repainted — a reading taken that way is of a
    // page nobody forced anything on.
    await page.emulateMedia({ forcedColors: "active" });
    await page.waitForTimeout(400);

    const took = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = "rgb(230, 57, 70)";
      document.body.appendChild(probe);
      const painted = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { matches: matchMedia("(forced-colors: active)").matches, repainted: painted !== "rgb(230, 57, 70)" };
    });
    expect(
      took,
      `${host.name}: the page reports forced-colors ${took.matches ? "active" : "none"} and a red box `
      + `${took.repainted ? "was" : "was not"} repainted, so the palette was not replaced and what `
      + "follows would be a reading of an ordinary page",
    ).toEqual({ matches: true, repainted: true });

    const after = await paints();
    expect(
      new Set(after).size,
      `${host.name}: ${after.length} swatches come out in ${new Set(after).size} paint(s) once the `
      + "palette is replaced. The control is a row of identical squares asking which colour a person "
      + "wants — and every contrast check still passes, because the paints a forced palette supplies "
      + "contrast well against what is behind them. Nothing else measures whether they differ from "
      + "each other, because in every other control that question does not arise.",
    ).toBe(after.length);
  });
}
