/**
 * A chip's position needs a role that can carry it, and the browser is asked which role it computed.
 *
 * `aria-posinset` and `aria-setsize` are legal on `option`, `listitem`, `row`, `tab`, `treeitem`,
 * `radio`, the `menuitem` family, `article` and `comment`, and each of those computes a set only
 * inside the container that owns it — an `option` in a `listbox`, a `listitem` in a `list`. On any
 * other role the attributes reach the DOM and are discarded. Nothing errors. Nothing is announced.
 *
 * That happened here. The chips carried both attributes on `role="group"`, and on `role="spinbutton"`
 * when they held a quantity, so nothing had ever said "3 of 12".
 * [ADR 0137](../../docs/architecture/0137-a-row-that-wraps-where-it-must.md) records it, because a
 * superseded record had made a 1.4.10 departure *conditional* on that announcement — a stated price
 * that went unpaid while a check agreed it had been paid.
 *
 * **Why this asserts the role rather than the position.** The obvious check is to read `posinset`
 * back out of the accessibility tree. It cannot be written: Chromium does not expose `posinset` or
 * `setsize` among an object's computed properties for *any* role, verified against markup that is
 * beyond reproach —
 *
 *     <ul><li aria-posinset=2 aria-setsize=7>      → role listitem, ignored false, properties [level]
 *     <div role=listbox><div role=option …>        → role option,   ignored false, properties [selected]
 *
 * — so an assertion on the computed position is true of every conforming control in this engine and
 * distinguishes nothing. What the tree does expose, and expose correctly, is the **role**, and the
 * role is the whole of the defect: it is what decides whether the attributes mean anything.
 *
 * So the property is stated as the necessary condition it really is. A chip whose computed role
 * permits the attributes may still carry a wrong number; a chip whose role forbids them cannot carry
 * a right one. This measures the second, which is the half no attribute-reading check can see.
 *
 * The sibling spec `a-chip-that-does-not-say-where-it-is` asserts the attributes are present, and it
 * was green throughout — markup we authored can only ever confirm that we authored it.
 *
 * Scope: Chromium, and the tree it computed. Engines disagree about which ARIA they discard; this
 * property is one where they agree. Gecko and WebKit are not covered by this file.
 *
 * Claims under attack: A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { HOSTS, bench } from "./bench";

/** Roles ARIA 1.2 permits `aria-posinset`/`aria-setsize` on, with the container each needs. */
const CARRIES_A_SET: Record<string, readonly string[]> = {
  option: ["listbox"],
  listitem: ["list"],
  row: ["grid", "treegrid", "table", "rowgroup"],
  tab: ["tablist"],
  treeitem: ["tree", "group"],
  radio: ["radiogroup"],
  menuitem: ["menu", "menubar", "group"],
  menuitemcheckbox: ["menu", "menubar", "group"],
  menuitemradio: ["menu", "menubar", "group"],
  article: ["feed"],
  comment: ["article", "comment"],
};

/**
 * The role the browser computed for one element, by the supported path: no handle internals, which
 * is both a private member this campaign refuses to touch and — in this version — `null`, so every
 * lookup failed and every node was reported as ignored whatever the page held.
 */
async function computedRole(page: import("@playwright/test").Page, selector: string) {
  const session = await page.context().newCDPSession(page);
  try {
    const { root } = (await session.send("DOM.getDocument", { depth: -1 })) as unknown as { root: { nodeId: number } };
    const { nodeId } = (await session.send("DOM.querySelector", { nodeId: root.nodeId, selector })) as unknown as { nodeId: number };
    if (nodeId === 0) return null;
    const { nodes } = (await session.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false })) as unknown as {
      nodes: Array<{ role?: { value?: string }; ignored?: boolean }>;
    };
    const node = nodes[0];
    if (node === undefined || node.ignored === true) return { role: null, ignored: true };
    return { role: node.role?.value ?? null, ignored: false };
  } finally {
    await session.detach().catch(() => undefined);
  }
}

for (const host of HOSTS) {
  test(`a chip's role can carry its position, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const { root } = await bench(page, host, "full");

    const marked = await page.evaluate((sel) => {
      const strip = document.querySelector(sel)?.querySelector(".mdy-multiselect__chips") ?? null;
      if (strip === null) return 0;
      strip.setAttribute("data-battle-strip", "1");
      const chips = Array.from(strip.querySelectorAll(".mdy-chip"));
      chips.forEach((chip, index) => chip.setAttribute("data-battle-chip", String(index)));
      return chips.length;
    }, root);

    expect(marked, "no chips were drawn, so there is no position to carry").toBeGreaterThan(0);

    const strip = await computedRole(page, `${root} [data-battle-strip]`);
    const chip = await computedRole(page, `${root} [data-battle-chip="0"]`);

    const chipRole = chip?.role ?? null;
    const stripRole = strip?.role ?? null;
    const containers = chipRole === null ? undefined : CARRIES_A_SET[chipRole];

    expect(
      containers,
      `the chip computes as \`${chipRole ?? "ignored"}\`, which ARIA does not permit ` +
        `aria-posinset or aria-setsize on. The attributes are written and the accessibility layer ` +
        `discards them, so nothing announces a chip's position. Roles that can carry it: ` +
        `${Object.keys(CARRIES_A_SET).join(", ")}.`,
    ).toBeDefined();

    expect(
      containers ?? [],
      `the chip computes as \`${chipRole}\`, which carries a set only inside ` +
        `${(containers ?? []).join(" or ")} — and the strip computes as \`${stripRole ?? "ignored"}\`. ` +
        `A role that permits the attributes still announces nothing when its container cannot own a set.`,
    ).toContain(stripRole);
  });
}
