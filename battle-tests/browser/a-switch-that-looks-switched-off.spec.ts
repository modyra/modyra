/**
 * Whether a control that is on can be told from one that cannot be used.
 *
 * A switch says three things with paint alone: whether it is on, whether it is off, and whether it
 * can be touched at all. Nothing else distinguishes them — there is no word beside it saying "on",
 * and a person reading the page with their eyes has the colour and nothing more.
 *
 * So two of those three must never look the same. A switch that is on and a switch that is on but
 * cannot be changed are different situations with different consequences: in one the setting is
 * yours to alter, in the other it is not, and a person who cannot tell them apart either tries
 * something that does nothing or leaves a setting alone that they could have changed.
 *
 * **This is a property, not a palette.** It says the two must differ, not what either should be, so
 * a theme is free to paint them however it likes and a theme that paints them alike fails wherever
 * it is used.
 *
 * The control is the third state: on and off must differ too. Without it, a reading that cannot see
 * any difference at all would report the two cases above as identical and be believed.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";

import { became, HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
interface Paint { track: string | null; thumb: string | null; opacity: string | null }

for (const host of HOSTS) {
  test(`a switch that is on is not painted like one nobody can change, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const paintOf = async (id: string, on: boolean, off: boolean): Promise<Paint> => {
      await page.evaluate(({ api, id, on }) => {
        (window as never as Api)[api].mountFields(id, [{
          name: "s", kind: "toggle", label: "Notifiche", initialValue: on,
        }] as never);
      }, { api: host.api, id, on });
      await became(() => page.locator(`[data-form="${id}"] .mdy-toggle__track`).count().then((found) => found > 0));

      if (off) {
        await page.evaluate(({ api, id }) =>
          (window as never as Api)[api].disable(id as never, "s" as never), { api: host.api, id });
        await became(() => page.evaluate(
          (sel) => document.querySelector(`${sel} input:not([type="hidden"])`)?.matches(":disabled") === true,
          `[data-form="${id}"]`));
      }

      return page.evaluate((sel) => {
        const track = document.querySelector(`${sel} .mdy-toggle__track`) as HTMLElement | null;
        const thumb = document.querySelector(`${sel} .mdy-toggle__thumb`) as HTMLElement | null;
        if (track === null) return { track: null, thumb: null, opacity: null };
        const style = getComputedStyle(track);
        return {
          track: style.backgroundColor,
          thumb: thumb === null ? null : getComputedStyle(thumb).backgroundColor,
          opacity: style.opacity,
        };
      }, `[data-form="${id}"]`);
    };

    const on = await paintOf("sw-on", true, false);
    const offValue = await paintOf("sw-off", false, false);
    const onButFrozen = await paintOf("sw-frozen", true, true);

    // The premise: a renderer that draws no switch, or draws one this file cannot read, would report
    // three identical readings of nothing and be taken for three identical paints.
    expect(
      on.track,
      `${host.name} drew no switch this file could read, so nothing below compared anything`,
    ).not.toBeNull();

    // The control: on and off do differ, so the instrument can see a difference when there is one.
    expect(
      JSON.stringify(on) !== JSON.stringify(offValue),
      `${host.name}: a switch that is on and one that is off are painted identically — `
      + `${JSON.stringify({ on, off: offValue })}. Nothing else says which it is.`,
    ).toBe(true);

    expect(
      JSON.stringify(on) !== JSON.stringify(onButFrozen),
      `${host.name}: a switch that is on and one that is on but cannot be changed are painted `
      + `identically — ${JSON.stringify({ on, onButFrozen })}. One of them is a setting a person can `
      + "alter and the other is not, and the paint is the only thing that was going to say so.",
    ).toBe(true);
  });
}
