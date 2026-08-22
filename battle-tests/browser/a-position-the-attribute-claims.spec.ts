/**
 * A chip's position is a property the accessibility layer computed, not an attribute we wrote.
 *
 * `aria-posinset` and `aria-setsize` are legal on `option`, `listitem`, `row`, `tab`, `treeitem`,
 * `radio`, the `menuitem` family, `article` and `comment`. On any other role they are written to the
 * DOM and discarded: nothing is exposed, no browser warns, and no screen reader says "3 of 12". An
 * `option` also only computes a set inside a `listbox`, so the container's role decides as much as
 * the chip's.
 *
 * [ADR 0137](../../docs/architecture/0137-a-row-that-wraps-where-it-must.md) exists because that
 * happened here and was invisible for weeks. Its predecessor made a 1.4.10 departure conditional on
 * the position being announced; the position was never announced; and the check that should have
 * caught it asserted the attribute was **present**, which it always was.
 *
 * So this spec never reads an attribute. It asks the browser what it computed. That is the whole
 * difference between the two, and it is why the sibling spec
 * `a-chip-that-does-not-say-where-it-is` cannot replace it: markup we authored can only ever confirm
 * that we authored it.
 *
 * Claims under attack: A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { HOSTS, bench } from "./bench";

/**
 * The accessibility tree as the browser computed it, keyed by the DOM id of the node it belongs to.
 * A property absent from the tree is a property no assistive technology can read, whatever the
 * markup says.
 */
async function computed(page: import("@playwright/test").Page, selector: string) {
  const session = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await session.send("Accessibility.getFullAXTree")) as {
      nodes: Array<{
        nodeId: string;
        backendDOMNodeId?: number;
        ignored?: boolean;
        role?: { value?: string };
        properties?: Array<{ name: string; value?: { value?: unknown } }>;
      }>;
    };

    const wanted = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const strip = root?.querySelector(".mdy-multiselect__chips") ?? null;
      const chips = strip === null ? [] : Array.from(strip.querySelectorAll(".mdy-chip"));
      chips.forEach((chip, index) => chip.setAttribute("data-battle-chip", String(index)));
      strip?.setAttribute("data-battle-strip", "1");
      return { chips: chips.length, hasStrip: strip !== null };
    }, selector);

    // Resolve by backend node id: the marker attributes above give a stable handle from the DOM side.
    const byBackend = new Map<number, (typeof nodes)[number]>();
    for (const node of nodes) if (typeof node.backendDOMNodeId === "number") byBackend.set(node.backendDOMNodeId, node);

    const describe = async (sel: string) => {
      const handle = await page.$(sel);
      if (handle === null) return null;
      const { node } = (await session.send("DOM.describeNode", {
        objectId: (handle as unknown as { _objectId?: string })._objectId,
      }).catch(() => ({ node: null }))) as { node: { backendNodeId?: number } | null };
      const found = node?.backendNodeId === undefined ? undefined : byBackend.get(node.backendNodeId);
      if (found === undefined || found.ignored === true) return null;
      const props: Record<string, unknown> = {};
      for (const p of found.properties ?? []) props[p.name] = p.value?.value;
      return { role: found.role?.value ?? null, props };
    };

    const strip = wanted.hasStrip ? await describe(`${selector} [data-battle-strip]`) : null;
    const chips = [];
    for (let index = 0; index < wanted.chips; index += 1) {
      chips.push(await describe(`${selector} [data-battle-chip="${index}"]`));
    }
    return { strip, chips, count: wanted.chips };
  } finally {
    await session.detach().catch(() => undefined);
  }
}

for (const host of HOSTS) {
  test(`a chip's position is computed, not merely written, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const { root } = await bench(page, host, "full");
    const tree = await computed(page, root);

    expect(tree.count, "no chips were drawn, so there is no position to compute").toBeGreaterThan(0);

    const silent = tree.chips
      .map((chip, index) => ({ index, chip }))
      .filter(({ chip }) => chip === null || chip.props.posinset === undefined || chip.props.setsize === undefined);

    // The message carries the role, because the role is always the reason: the attribute is on the
    // element and the layer dropped it for not being legal there.
    const roles = tree.chips.map((chip) => chip?.role ?? "ignored").join(", ");
    expect(
      silent.length,
      `${silent.length} of ${tree.count} chips expose no position to assistive technology. ` +
        `Computed roles: [${roles}]. Strip role: ${tree.strip?.role ?? "ignored"}. ` +
        `aria-posinset and aria-setsize are legal on option, listitem, row, tab, treeitem, radio, ` +
        `menuitem*, article and comment — and an option only computes a set inside a listbox.`,
    ).toBe(0);

    // A set that is announced must also be the set that exists: a size the browser computed from a
    // container holding something else is worse than no size at all.
    for (const [index, chip] of tree.chips.entries()) {
      expect(chip?.props.setsize, `chip ${index} reports a set size that is not the number of chips`).toBe(tree.count);
      expect(chip?.props.posinset, `chip ${index} reports the wrong position`).toBe(index + 1);
    }
  });
}
