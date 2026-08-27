/**
 * Whether nesting a question under another costs horizontal room.
 *
 * A questionnaire asks a question, and the answer brings out another one under it, and that one brings
 * out a third. The structure is a tree and the depth is not decided in advance — it is decided by the
 * person filling it in, one answer at a time.
 *
 * **A tree in the model does not oblige a tree in the layout, and indenting is the presentation that
 * scales worst.** Every level takes width, the depth is unbounded by design, and the width is not: a
 * page must stay usable at 320 CSS pixels without sideways scrolling, and a person at 400% zoom is
 * already at that width on an ordinary screen. Indent-per-level is the most reliable way there is of
 * failing that condition, because the cost multiplies by a number nobody agreed to limit.
 *
 * **What is asserted is a property of the function, not a reading at one depth.** Testing "does depth
 * three still fit" answers nothing about depth six, and any depth this file picked would be an
 * assumption hiding inside a check — the silent cap this suite refuses everywhere else. So two depths
 * are compared **against each other**: the deepest structure the contract admits must cost a field no
 * more room than the shallowest. A layout that indents per level fails that already between two and
 * three, so this catches the defect without having to build the deep case for it to show.
 *
 * **The ceiling is read, not written.** The contract publishes how deep a layout may go; writing the
 * number here would make this file disagree silently the day the contract moves.
 *
 * **This does not ask for zero indent.** Two levels of visible indent may be exactly right to look at.
 * It asks that the cost **saturate** — that it stop growing — because a bound that exists is a bound
 * somebody chose, and a bound that emerges from how deep the person testing happened to go is not.
 *
 * **A harness that draws no structure is named, not counted — and the gap is this bench's, not the
 * renderer's.** One of the three ways this suite mounts a form cannot build a nested layout: the
 * package it drives publishes no door that mounts a document, so the harness would have to construct
 * the grouping elements itself. That host is reported as unjudged rather than failed, because failing
 * it would accuse a renderer of a limit belonging to the thing measuring it — and passing it silently
 * would let a flat page and a nested one be compared under one name, which is the shape that has cost
 * this suite more retractions than any other. A run where fewer than two hosts could be judged is a
 * run that compared nothing, and says so.
 *
 * Claims under attack: UI-005, A11Y-002.
 */

import { expect, test } from "@playwright/test";
import { MDY_LAYOUT_MAX_DEPTH } from "@modyra/core";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Node = { kind: "section"; id: string; label: string; children: unknown[] };

/** Hosts whose harness could not build the nesting, named so their silence is visible. */
const unjudged: string[] = [];

/** A layout that puts one field at the given depth, and nothing else. */
const nestedTo = (depth: number, field: string): Node[] => {
  let node: Node = { kind: "section", id: `s${depth}`, label: `Livello ${depth}`, children: [field] };
  for (let level = depth - 1; level >= 1; level -= 1) {
    node = { kind: "section", id: `s${level}`, label: `Livello ${level}`, children: [node] };
  }
  return [node];
};

for (const host of HOSTS) {
  test(`depth costs a field no width, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    /** Where the field sits, and how much structure was built around it. */
    const at = async (depth: number) => {
      const id = `deep${depth}`;
      await page.evaluate(({ api, mountId, layout }) => {
        (window as never as Api)[api].mountFields(
          mountId, [{ name: "q", kind: "text", label: "Domanda" }] as never, { layout } as never);
      }, { api: host.api, mountId: id, layout: nestedTo(depth, "q") });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(300);

      return page.evaluate((selector) => {
        const root = document.querySelector(selector) as HTMLElement | null;
        if (root === null) return null;
        const field = root.querySelector(".mdy-renderer") as HTMLElement | null;
        if (field === null) return null;
        const box = root.getBoundingClientRect();
        const own = field.getBoundingClientRect();
        return {
          sections: root.querySelectorAll("fieldset, [data-layout-id]").length,
          left: Math.round(own.left - box.left),
          width: Math.round(own.width),
        };
      }, `[data-form="${id}"]`);
    };

    const shallow = await at(1);
    const deep = await at(MDY_LAYOUT_MAX_DEPTH);

    expect(shallow, `${host.name} drew no field inside a layout at all`).not.toBeNull();
    expect(deep, `${host.name} drew no field inside a layout at the contract's deepest`).not.toBeNull();

    // A harness that ignores the structure draws the same flat page twice, and two identical flat
    // pages agree perfectly. That is this bench's limit and not a renderer's, so it is declared here
    // and counted, rather than charged to the renderer or passed over in silence.
    if (deep!.sections <= 1) {
      unjudged.push(`${host.name} (${deep!.sections} section(s) built for a layout ${MDY_LAYOUT_MAX_DEPTH} deep)`);
      expect(
        unjudged.length,
        `this bench can mount a nested layout in none of its hosts — ${unjudged.join("; ")} — so `
        + "nothing here was compared and the silence is the harness rather than the renderers",
      ).toBeLessThan(HOSTS.length - 1);
      return;
    }

    expect(
      { left: deep!.left, width: deep!.width },
      `${host.name} charges a field for how deep it sits: at depth 1 it starts ${shallow!.left}px in `
      + `and is ${shallow!.width}px wide; at depth ${MDY_LAYOUT_MAX_DEPTH} it starts ${deep!.left}px `
      + `in and is ${deep!.width}px wide. Depth is decided by the person answering, one question at a `
      + "time, and the width is decided by the device. A cost that grows per level multiplies by a "
      + "number nobody agreed to limit, and the first person to feel it is the one already at 320 "
      + "pixels because they zoomed to read.",
    ).toEqual({ left: shallow!.left, width: shallow!.width });
  });
}
