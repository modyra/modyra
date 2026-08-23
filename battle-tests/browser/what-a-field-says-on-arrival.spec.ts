/**
 * What a person is told when they reach a field that already holds something.
 *
 * A multiselect showing two chips shows them to whoever can see them. Someone who cannot has the
 * control's accessible name — which says what the field is for — and nothing about what it currently
 * holds, unless the field says so.
 *
 * That has to arrive **on arrival**, not as an announcement. A live region speaks when something
 * changes; a person tabbing onto a field has changed nothing, so a live region is silent and correct
 * to be. The count belongs to the control's own description, which is read out with it.
 *
 * Without it the field is a door with a label and no indication whether anything is behind it, and
 * the only way to find out is to open it — which is the journey the chips exist to save.
 *
 * **Read from the computed accessibility tree, not from the attribute.** How a renderer supplies a
 * description is its own business: `aria-describedby` pointing at a count, a `title`, text the
 * platform folds in. Reading the attribute would report a renderer that gets there another way as
 * missing — and reading it is how this file's author first recorded a correctly named control as
 * having no name at all.
 *
 * The renderers that say it are the control: this is a divergence, not a policy, and the count is
 * already computed in all three.
 *
 * Claims under attack: A11Y-004, UI-005.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

for (const host of HOSTS) {
  test(`a field with a value says so before it is opened, ${host.name}`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("arrival", [{
        name: "m", kind: "multiselect", label: "Scelte",
        options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
        initialValue: ["a"],
      }] as never);
    }, { api: host.api });

    await page.locator('[data-form="arrival"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(500);

    const session = await page.context().newCDPSession(page);
    await session.send("Accessibility.enable");
    const tree = await session.send("Accessibility.getFullAXTree");
    const combobox = (tree.nodes as Array<Record<string, { value?: unknown }>>)
      .find((node) => String(node.role?.value) === "combobox");

    // Without a combobox in the tree there is nothing to have been described, and an empty
    // description would read as a defect rather than as an absent control.
    expect(combobox, `${host.name} published no combobox in the accessibility tree`).toBeDefined();

    const name = String(combobox?.name?.value ?? "");
    const description = String((combobox as Record<string, { value?: unknown }> | undefined)?.description?.value ?? "");

    expect(name, `${host.name}'s field has no accessible name`).not.toBe("");
    expect(
      description,
      `${host.name}: the field is named "${name}" and says nothing about what it holds. A person who `
      + "cannot see the chips has to open the list to find out whether anything is chosen.",
    ).not.toBe("");
  });
}
