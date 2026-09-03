/**
 * What a person pays to reach a question that sits deep in a form.
 *
 * Nesting costs something by definition: a group inside a group is a group more, and somebody moving
 * through the form meets it. The question a limit exists to answer is not whether the cost grows —
 * it must — but **which cost grows, and whether it grows in the currency a person actually spends.**
 *
 * Two are measured here, and they are the two that scale differently.
 *
 * **A keyboard walk pays in stops.** A grouping element takes no focus, so nesting should add none:
 * reaching the question at the bottom of thirty-two groups should take the same number of presses as
 * reaching one at the top. If it does not, depth is charged to the one person who cannot skim past
 * it, and the charge is a keypress per level.
 *
 * **A reader pays in names.** Traversing a group is only worth anything if the group says what it is.
 * A run of groups announced as *group, group, group* tells somebody nothing about where they are and
 * costs them the whole climb anyway — and at that point the nesting has taken the cost without
 * delivering the thing it was for.
 *
 * **The depth is the contract's own**, and this file goes where the contract goes. A limit is the
 * place a check should stand: writing the number here would leave this file quietly agreeing with a
 * rule that had moved. It was six; it is not any more, and nothing here needed changing.
 *
 * **Both are read against a shallow control in the same run.** A form where nothing is focusable, or
 * where no group is named, would satisfy both halves by having nothing to charge — and the shallow
 * case is what tells a bounded cost from an absent one.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_LAYOUT_MAX_DEPTH } from "@modyra/core";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
interface Node { kind: "section"; id: string; label: string; children: unknown[] }

/** One field at the given depth, every section named. */
const nestedTo = (depth: number, field: string): Node[] => {
  let node: Node = { kind: "section", id: `s${depth}`, label: `Sezione ${depth}`, children: [field] };
  for (let level = depth - 1; level >= 1; level -= 1) {
    node = { kind: "section", id: `s${level}`, label: `Sezione ${level}`, children: [node] };
  }
  return [node];
};

for (const host of HOSTS) {
  test(`depth costs no stops and every group says what it is, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    /** How many presses to reach the question, and whether the climb to it is named. */
    const at = async (depth: number) => {
      const id = `stops${depth}`;
      await page.evaluate(({ api, mountId, layout }) => {
        (window as never as Api)[api].mountFields(
          mountId, [{ name: "q", kind: "text", label: "Domanda" }] as never, { layout } as never);
      }, { api: host.api, mountId: id, layout: nestedTo(depth, "q") });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(250);

      const shape = await page.evaluate((selector) => {
        const root = document.querySelector(selector) as HTMLElement | null;
        if (root === null) return null;
        const groups = Array.from(root.querySelectorAll("fieldset, [data-layout-id]")) as HTMLElement[];
        // A grouping element takes no focus of its own; anything inside the form that does is a stop
        // a person walks through.
        const stops = Array.from(root.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )).filter((one) => one.getAttribute("tabindex") !== "-1" && !(one as HTMLInputElement).disabled).length;
        return {
          groups: groups.length,
          // What a reader is told each group is. A legend, an accessible name, anything at all.
          unnamed: groups.filter((one) => {
            const said = one.getAttribute("aria-label")
              ?? one.querySelector("legend")?.textContent
              ?? "";
            return said.trim() === "";
          }).length,
          stops,
        };
      }, `[data-form="${id}"]`);

      await page.evaluate(({ api, mountId }) => {
        try { (window as never as Api)[api].dispose?.(mountId as never); } catch { /* nothing mounted */ }
      }, { api: host.api, mountId: id });
      return shape;
    };

    const shallow = await at(1);
    const deep = await at(MDY_LAYOUT_MAX_DEPTH);

    expect(shallow, `${host.name} drew nothing for a layout one deep`).not.toBeNull();
    expect(deep, `${host.name} drew nothing for a layout ${MDY_LAYOUT_MAX_DEPTH} deep`).not.toBeNull();

    // The premise: the deep case is actually deep, and both cases put something in the walk. A
    // harness that ignored the structure would compare two identical shallow pages and agree.
    expect(
      deep!.groups,
      `${host.name} built ${deep!.groups} group(s) for a layout ${MDY_LAYOUT_MAX_DEPTH} deep, so there `
      + "is no depth here to charge anybody for",
    ).toBeGreaterThan(shallow!.groups);
    expect(
      shallow!.stops,
      `${host.name} put nothing in the keyboard walk even at depth 1, so a walk that stays the same `
      + "length says nothing",
    ).toBeGreaterThan(0);

    expect(
      deep!.stops,
      `${host.name}: reaching a question ${MDY_LAYOUT_MAX_DEPTH} groups down costs ${deep!.stops} `
      + `keyboard stop(s) where reaching one at the top costs ${shallow!.stops}. Depth is charged to `
      + "the one person who cannot skim past it, at a keypress a level, and nobody chose that — a "
      + "grouping element takes no focus, so nesting should add none.",
    ).toBe(shallow!.stops);

    expect(
      deep!.unnamed,
      `${host.name}: ${deep!.unnamed} of ${deep!.groups} groups on the way down say nothing about what `
      + "they are. A reader climbing through them hears group, group, group and learns nothing about "
      + "where they have arrived — the nesting has taken the cost of the climb without delivering the "
      + "thing the climb was for.",
    ).toBe(0);
  });
}
