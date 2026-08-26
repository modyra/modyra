/**
 * Which of the two shapes each renderer draws for the same declared field.
 *
 * A `select` has two: the platform's own chooser, and a control built out of markup. Which one a
 * document gets is meant to follow from what the document asked for — and today it also follows from
 * which renderer is drawing. One document, asking for the same thing, gets the platform's keyboard
 * model and its mobile picker in two renderers and does not in the third.
 *
 * **That difference is already recorded and deliberately unresolved.** ADR 0139 names it, explains why
 * settling it means choosing which renderer changes, and leaves it open because there is a migration
 * behind either choice. This file does not reopen it and does not say which shape is right.
 *
 * **What it does is stop the difference moving without anyone noticing.** A record describing a state
 * nobody measures goes on describing it after it has changed: the sentence stays readable and keeps
 * naming things that exist, and only the relation between them is different. This suite has met that
 * four times — a wrapping rule addressing a tree a later decision moved a row into, a count reading
 * the row instead of what it holds, an audit blind to a helper that replaced a literal, an attribute
 * on a control nothing repaints. None of them looked broken. All of them had stopped being true.
 *
 * So this is a photograph, and it is green because it is accurate rather than because the state is
 * wanted. If it goes red, one of two things happened: a renderer changed shape, or the difference was
 * settled — and in the second case the record is where the answer belongs and this file follows it.
 *
 * **The shape is read by what is on the page, not by a name.** A control the platform draws is a
 * `select` element whose list has no markup here; a control built out of markup publishes options this
 * document can see. Asking which element is present is the whole test, and it stays true through any
 * renaming of ours.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

/**
 * What each renderer draws today, per shape the document asks for.
 *
 * Not a statement about what any of them should draw. The disagreement in the second row is the one
 * ADR 0139 records as open; the agreement in the first is what the contract describes.
 */
const TODAY: Record<string, { asked: boolean; shape: "the platform's" | "one built of markup" }[]> = {
  plain: [
    { asked: true, shape: "one built of markup" },
    { asked: false, shape: "one built of markup" },
  ],
  lit: [
    { asked: true, shape: "one built of markup" },
    { asked: false, shape: "the platform's" },
  ],
  angular: [
    { asked: true, shape: "one built of markup" },
    { asked: false, shape: "the platform's" },
  ],
};

for (const host of HOSTS) {
  test(`each renderer draws the shape it drew before, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const expected = TODAY[host.name];
    expect(expected, `${host.name} has no photograph here, so nothing about it is being watched`)
      .toBeDefined();

    const moved: string[] = [];

    for (const { asked, shape } of expected!) {
      const id = `shape_${asked ? "searchable" : "plain"}`;
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      await page.evaluate(({ api, mountId, options, asked }) => {
        const field: Record<string, unknown> = { name: "f", kind: "select", label: "Scelte", options };
        if (asked) field.searchable = true;
        (window as never as Api)[api].mountFields(mountId, [field] as never);
      }, { api: host.api, mountId: id, options: OPTIONS, asked });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(300);

      const drawn = await page.evaluate((mountId) => {
        const root = document.querySelector(`[data-form="${mountId}"]`);
        return {
          native: root?.querySelector("select") !== null && root?.querySelector("select") !== undefined,
          combobox: root?.querySelector('[role="combobox"]') !== null
            && root?.querySelector('[role="combobox"]') !== undefined,
        };
      }, id);

      // The premise: exactly one of the two shapes is on the page. Neither would mean the field drew
      // nothing and this read about an empty form; both would mean the shapes are not exclusive and
      // the photograph is of something else.
      expect(
        [drawn.native, drawn.combobox].filter(Boolean).length,
        `${host.name} drew ${drawn.native ? "a platform control" : ""}${drawn.native && drawn.combobox ? " and " : ""}`
        + `${drawn.combobox ? "a control of markup" : ""} for a field asking `
        + `${asked ? "to be searchable" : "for nothing in particular"} — the two shapes are meant to be `
        + "one or the other, and this file cannot photograph a field that is neither or both",
      ).toBe(1);

      const is = drawn.native ? "the platform's" : "one built of markup";
      if (is !== shape) {
        moved.push(
          `asking ${asked ? "to be searchable" : "for nothing in particular"} it now draws ${is}, `
          + `where it drew ${shape}`);
      }
    }

    expect(
      moved,
      `${host.name}: ${moved.join("; ")}. Which shape a renderer draws is an open difference between `
      + "them, recorded rather than settled, and this file exists so that it cannot move quietly. If "
      + "the move was meant, the record that holds the difference is where it is described and this "
      + "photograph follows it; if it was not, a document now gets a different control than it did.",
    ).toEqual([]);
  });
}
