/**
 * Whether a person who cannot see the chips can learn what the field holds without opening it.
 *
 * A multiselect showing two chips shows them to whoever can see them. Someone who cannot has to be
 * able to find out some other way, and the way must not be *open the list and read it*: that is the
 * journey the chips exist to save, and a control that makes one person take it and not another has
 * put the cost on the person who could least afford it.
 *
 * **The property, not the means.** An earlier form of this file asked for a sentence — a count folded
 * into the field's own description, "3 selected" — and that is one way to satisfy the property and not
 * the property itself. A count under the field says *there is something here* while giving no way to
 * reach it, and it duplicates for one person what the chips already say to another. What matters is
 * that the values themselves are reachable, and this file asks for exactly that and leaves every
 * renderer free about how.
 *
 * **Read from the computed accessibility tree, not from the markup.** How a renderer publishes a
 * chosen value is its own business — a cell in a grid, an option in a list, a labelled button. Reading
 * the attributes would report a renderer that gets there another way as missing, and reading them is
 * how this file's author once recorded a correctly named control as having no name at all.
 *
 * **Two premises, because this file can pass by measuring the wrong thing.**
 *
 *   1. **The list must be closed.** A field whose whole option list is published is one where every
 *      label is in the tree whether or not it was chosen, and finding "Alfa" there would say nothing
 *      about the chips.
 *   2. **The values that were not chosen must be absent.** This is the same guard from the other side
 *      and it is the one that can be checked rather than assumed: if a label nobody chose is readable,
 *      the tree is not reporting the field's contents and no conclusion drawn from it is about them.
 *
 * Claims under attack: A11Y-004, UI-005.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
  { value: "d", label: "Delta" },
];
const CHOSEN = ["Alfa", "Gamma"];
const NOT_CHOSEN = ["Beta", "Delta"];

for (const host of HOSTS) {
  test(`a field with a value says so before it is opened, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api, options }) => {
      (window as never as Api)[api].mountFields("arrival", [{
        name: "m", kind: "multiselect", label: "Scelte", options, initialValue: ["a", "c"],
      }] as never);
    }, { api: host.api, options: OPTIONS });

    await page.locator('[data-form="arrival"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(500);

    const session = await page.context().newCDPSession(page);
    await session.send("Accessibility.enable");
    const tree = await session.send("Accessibility.getFullAXTree");

    type Node = Record<string, { value?: unknown } | boolean | undefined>;
    const published = (tree.nodes as Node[])
      .filter((node) => node.ignored !== true)
      .map((node) => ({
        role: String((node.role as { value?: unknown } | undefined)?.value ?? ""),
        name: String((node.name as { value?: unknown } | undefined)?.value ?? "").trim(),
      }))
      .filter((node) => node.role !== "" && node.role !== "none");

    const combobox = published.find((node) => node.role === "combobox");
    expect(combobox, `${host.name} published no combobox, so there is no field here to have read`).toBeDefined();

    // Premise one: nothing has been opened, so what follows is what arrival looks like.
    const opened = published.filter((node) => node.role === "listbox" || node.role === "dialog");
    expect(
      opened.map((node) => `${node.role} "${node.name}"`),
      `${host.name} published an open list before anything was pressed, so every option's label is in `
      + "the tree and finding a chosen one there would say nothing about what the field holds",
    ).toEqual([]);

    // Premise two: the same guard from the side that can be measured.
    const strays = NOT_CHOSEN.filter((label) => published.some((node) => node.name === label));
    expect(
      strays,
      `${host.name} publishes ${strays.join(", ")} — a value nobody chose — so the tree is not `
      + "reporting the field's contents and nothing found in it is evidence about them",
    ).toEqual([]);

    const missing = CHOSEN.filter((label) => !published.some((node) => node.name === label));
    expect(
      missing,
      `${host.name} holds ${CHOSEN.join(" and ")} and publishes nothing a reader can find ${missing.join(" or ")} `
      + "by. Someone who cannot see the chips has to open the list to learn what is already chosen, "
      + "which is the journey the chips exist to save.",
    ).toEqual([]);
  });
}
