/**
 * Whether a form calls a field wrong before anybody has done anything to it.
 *
 * A person opens a form. Nothing has been typed, nothing chosen, nothing skipped. A reader moving
 * through it announces each field in turn — and on some of them it says **invalid**.
 *
 * **Nothing is wrong yet.** A required field that is empty is not a mistake; it is a field somebody
 * has not reached. The distinction is the whole of it: *is this field's value acceptable* and *is
 * there a refusal to show this person now* are two questions, and only the second one has an answer
 * at the moment a form is drawn. A control that answers the first when it was asked the second is
 * wrong from birth — before it can possibly know.
 *
 * **It falls entirely on people who cannot see the form.** Nothing is painted, because nothing is
 * meant to be painted yet; the claim exists only in what is announced. Someone reading the page hears
 * a form that is already failing and cannot tell which of those complaints is about something they
 * did. Someone looking at it sees a clean form. The two are given different documents.
 *
 * **And it makes the real refusal worth less.** A reader who is told *invalid* on arrival learns that
 * the word means nothing here, which is exactly the cost of announcing it early: the announcement
 * that matters arrives later and sounds the same.
 *
 * **The control is what makes the silence mean something.** A renderer that announces no refusal ever
 * would pass this by having nothing to say, so the same fields are given a turn and the refusal must
 * then arrive. Absence before, presence after: one without the other is satisfied by a control that
 * is broken in the opposite direction.
 *
 * Claims under attack: A11Y-004, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { became, HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`a field nobody has touched is not announced as wrong, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const claimsWrong = (id: string) => page.evaluate(
      (selector) => document.querySelector(`${selector} [aria-invalid="true"]`) !== null, `[data-form="${id}"]`);

    const mount = async (id: string, kind: string) => {
      await page.evaluate(({ api, mountId, k, options }) => {
        const field: Record<string, unknown> = {
          name: "f", kind: k, label: "L", validators: { required: true },
        };
        if (/select|radio|segmented/.test(k)) field.options = options;
        (window as never as Api)[api].mountFields(mountId as never, [field] as never);
      }, { api: host.api, mountId: id, k: kind, options: OPTIONS });
      await became(() => page.evaluate(
        (selector) => (document.querySelector(selector)?.children.length ?? 0) > 0, `[data-form="${id}"]`))
        .catch(() => undefined);
      await page.waitForTimeout(120);
    };

    const fromBirth: string[] = [];
    const afterATurn: string[] = [];

    for (const kind of MDY_WIDGET_KINDS) {
      const untouched = `birth-${kind}`;
      await mount(untouched, kind);
      if (await claimsWrong(untouched)) fromBirth.push(kind);

      // The same field, given the turn a person gives one: reached, and then left.
      const turned = `turn-${kind}`;
      await mount(turned, kind);
      const first = page.locator(
        `[data-form="${turned}"] input, [data-form="${turned}"] select, [data-form="${turned}"] textarea, [data-form="${turned}"] button`,
      ).first();
      if (await first.count() > 0) {
        await first.focus().catch(() => undefined);
        await first.blur().catch(() => undefined);
      }
      await page.waitForTimeout(200);
      if (await claimsWrong(turned)) afterATurn.push(kind);

      await page.evaluate(({ api, a, b }) => {
        (window as never as Api)[api].dispose?.(a as never);
        (window as never as Api)[api].dispose?.(b as never);
      }, { api: host.api, a: untouched, b: turned });
    }

    // Without this, a renderer that never announces a refusal at all passes by saying nothing, and
    // the silence above would be the instrument rather than the control.
    expect(
      afterATurn.length,
      `${host.name} announces no refusal on any kind even after the field has been given a turn, so `
      + "this run cannot tell a control that waits from one that never speaks",
    ).toBeGreaterThan(3);

    expect(
      fromBirth,
      `${host.name} announces ${JSON.stringify(fromBirth)} as invalid on a form nobody has touched. `
      + "A required field that is empty is not a mistake — it is a field somebody has not reached "
      + "yet, and whether its value is acceptable is a different question from whether there is a "
      + "refusal to show this person now. Nothing is painted, so a person looking at the form sees it "
      + "clean and a person reading it hears it already failing: the two are given different "
      + "documents. And the refusal that does matter arrives later sounding exactly the same.",
    ).toEqual([]);
  });
}
