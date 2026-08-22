/**
 * A control that exists in the page and not in the accessibility tree.
 *
 * Each chip in a multiselect carries a button that removes it. The button is in the document, it is
 * named, it is sized, and pressing it works. It appears **nowhere** in the tree a screen reader
 * reads. Two remove buttons in the page, zero in the tree, in every renderer.
 *
 * The cause is structural rather than an omission. The strip of chips is rendered inside the element
 * that opens the list, and that element is a `<button>`. HTML's content model forbids a button from
 * containing interactive content, so what the browser builds from it is not what the markup says: the
 * inner controls are flattened away. The ARIA role written on the outer element does not rescue them,
 * because the prohibition belongs to the element, not to the role.
 *
 * So a person using a screen reader can hear what they have chosen and has no way to remove any of
 * it. Not a badly-named control, not a hard-to-reach one — no control. The only route left is to
 * open the list and deselect, and nothing tells them that is the route.
 *
 * This is the half an audit built from ARIA rules will not find. Every attribute here is correct.
 * The names are right, the roles are right, the states are right. The tree is built from the DOM the
 * browser actually parsed, and that is the only place the loss is visible — which is why this asserts
 * against the computed tree and never against the markup.
 *
 * **The check is that the tree carries a control per chip**, not that it carries a particular role.
 * A renderer is free to make removal a button, a menu item, or something else; it is not free to
 * make it nothing.
 *
 * Claims under attack: A11Y-004, UI-005.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** Roles a person can operate. A chip's removal has to reach the tree as one of them. */
const OPERABLE = new Set(["button", "link", "menuitem", "checkbox", "switch", "gridcell"]);

for (const host of HOSTS) {
  test(`a chip's remove control reaches the accessibility tree, ${host.name}`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("tree", [{
        name: "s", kind: "multiselect", label: "Scelte",
        options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
        initialValue: ["a", "b"],
      }] as never);
    }, { api: host.api });

    await page.locator('[data-form="tree"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(900);

    const inPage = await page.locator('[data-form="tree"] .mdy-chip__remove').count();
    // Without a control in the page there is nothing for the tree to be missing, and the assertion
    // below would pass on an empty strip.
    expect(inPage, `${host.name} drew no remove control at all, so this spec measured nothing`).toBeGreaterThan(0);

    const session = await page.context().newCDPSession(page);
    await session.send("DOM.enable");
    await session.send("Accessibility.enable");
    const document_ = await session.send("DOM.getDocument", { depth: -1 });
    const found = await session.send("DOM.querySelector", {
      nodeId: document_.root.nodeId,
      selector: '[data-form="tree"] .mdy-multiselect__trigger',
    });
    const tree = await session.send("Accessibility.getPartialAXTree", { nodeId: found.nodeId, fetchRelatives: true });

    const operable = (tree.nodes as Array<Record<string, { value?: unknown }>>)
      .map((node) => String(node.role?.value ?? ""))
      .filter((role) => OPERABLE.has(role));

    expect(
      operable.length,
      `${host.name} draws ${inPage} remove control(s) in the page and the accessibility tree carries `
      + `${operable.length} — a person reading the tree can hear what they chose and cannot remove any of it`,
    ).toBeGreaterThanOrEqual(inPage);
  });
}
