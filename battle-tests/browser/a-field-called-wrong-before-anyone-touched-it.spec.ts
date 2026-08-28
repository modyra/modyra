/**
 * Whether a form calls a field wrong before anybody has done anything to it.
 *
 * A person opens a form. Nothing typed, nothing chosen, nothing skipped. A required field that is
 * empty is not a mistake; it is a field somebody has not reached. *Is this value acceptable* and *is
 * there a refusal to show this person now* are two questions, and only the second has an answer at
 * the moment a form is drawn.
 *
 * **Two channels, read apart.** `aria-invalid` is heard and nothing else; the drawn error item is
 * seen and nothing else. Either one alone is the whole defect for the person who has only that
 * channel, and a field that paints a refusal while announcing itself valid hands two people two
 * different documents — so a check that reads one channel calls the other correct by not looking.
 *
 * **The control is an act on the value, not a visit.** The same field is typed into and emptied
 * again, which must speak; focus arriving and leaving must not, so it cannot serve as the control
 * without demanding the behaviour this suite calls a defect elsewhere. The typing is verified to have
 * moved the control's value, so a `fill` a kind ignores cannot pass for an act.
 *
 * Claims under attack: A11Y-004, UI-009.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const TYPED = "12/03/2026";

for (const host of HOSTS) {
  test(`a field nobody has touched is not announced as wrong, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = async (id: string, kind: string) => {
      await page.evaluate(({ api, mountId, k, options }) => {
        (window as never as Api)[api].mountFields(mountId, [{
          name: "f", kind: k, label: "L", validators: { required: true }, options,
        }] as never);
      }, { api: host.api, mountId: id, k: kind, options: OPTIONS });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(120);
    };

    const verdict = (id: string) => page.evaluate((mountId) => {
      const root = document.querySelector(`[data-form="${mountId}"]`);
      const item = root?.querySelector(".mdy-control__error") ?? null;
      return {
        announced: root !== null && root.querySelector('[aria-invalid="true"]') !== null,
        painted: item !== null && item.getBoundingClientRect().height > 0,
      };
    }, id);

    const fromBirth: string[] = [];
    const spokeAfterAnAct: string[] = [];
    const silentAfterAnAct: string[] = [];

    for (const kind of MDY_WIDGET_KINDS) {
      const untouched = `birth_${kind}`;
      await mount(untouched, kind);
      const born = await verdict(untouched);
      if (born.announced || born.painted) {
        fromBirth.push(`${kind}${born.announced ? " announced" : ""}${born.painted ? " painted" : ""}`);
      }

      const acted = `acted_${kind}`;
      await mount(acted, kind);
      const box = page.locator(`[data-form="${acted}"] input, [data-form="${acted}"] textarea`).first();
      if (await box.count() > 0) {
        const before = await box.inputValue().catch(() => null);
        await box.fill(TYPED).catch(() => undefined);
        const during = await box.inputValue().catch(() => null);
        const moved = before !== null && during !== null && during !== before;
        await box.fill("").catch(() => undefined);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        if (moved) {
          await page.waitForTimeout(150);
          const after = await verdict(acted);
          (after.announced || after.painted ? spokeAfterAnAct : silentAfterAnAct).push(kind);
        }
      }
    }

    expect(
      spokeAfterAnAct.length,
      `${host.name} shows no refusal on any kind even after a value was typed and taken away again `
      + `(${silentAfterAnAct.length} kinds took a value and stayed silent), so the silence measured `
      + "above is this run's own, not the renderer's answer",
    ).toBeGreaterThan(2);

    expect(
      fromBirth,
      `${host.name} calls ${fromBirth.length} of ${MDY_WIDGET_KINDS.length} kinds wrong on a form `
      + `nobody has touched: ${JSON.stringify(fromBirth)}. A required field that is empty is not a `
      + "mistake — it is a field somebody has not reached yet. Where the two channels disagree the "
      + "form is worse than wrong: one person sees a refusal the other is told is not there, and the "
      + "refusal that does matter arrives later looking and sounding exactly the same.",
    ).toEqual([]);
  });
}
