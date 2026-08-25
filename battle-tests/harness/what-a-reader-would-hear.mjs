/**
 * The tree a screen reader is handed, rather than the markup a renderer wrote.
 *
 * Every accessibility check in this suite so far has read the **DOM**: the attribute the renderer set,
 * asserted against a published rule. That is one step short of the thing. A browser computes an
 * accessibility tree from that DOM and **silently discards what the role does not allow** — an
 * `aria-valuenow` on a `listitem`, an `aria-label` on a `generic`. The attribute stays in the DOM, the
 * assertion passes, and the tree never carried it.
 *
 * So the question this answers is not *is the tree right* but **do the two agree**. Where they
 * diverge, one of them is lying, and neither the DOM nor the specification can say which on its own.
 *
 * ## Two conditions, enforced here rather than described
 *
 * **`getFullAXTree`, never `getPartialAXTree` with `fetchRelatives`.** That call answers with the
 * node's **ancestors**, not its subtree, and it answers confidently — it is how this suite published
 * "the remove button is absent from the accessibility tree" about a tree that contained two of them.
 * A wrong instrument that returns a plausible shape is worse than one that fails.
 *
 * **A root that matched nothing is refused, not returned empty.** Every assertion of the form *the
 * tree contains no X* is satisfied by a tree with nothing in it, so an empty answer is the one shape
 * that must never be silent.
 *
 * ## How the subtree is taken
 *
 * By the set of DOM nodes under the root, not by walking the tree from the root's own node. A wrapper
 * like `<section data-form="…">` is usually **ignored** — it has no node in the tree at all — and a
 * walk from it would find nothing and report an empty page. The elements inside it are there
 * regardless, so the set is what scopes the reading.
 *
 * Structure is then rebuilt from the tree's own `childIds`, restricted to that set: what survives is
 * the nesting the *tree* has, which is the only nesting a reader follows.
 *
 * ## What this is not
 *
 * **CDP is Chromium.** One engine of three. That Chromium's tree says X is measured; that Firefox and
 * WebKit agree is inference, and a spec resting on this should say so in its own header.
 *
 * **It cannot see where something sits in a set.** Measured, not assumed: `getFullAXTree` reports no
 * `posinset` and no `setsize`, for any role —
 *
 *     <ol><li>            listitem   level=1                     the browser computes the position itself
 *     role=listitem       listitem   level=1                     with aria-posinset="2" aria-setsize="7"
 *     role=option         option     selected=false
 *     role=gridcell       gridcell   readonly=false, required=false
 *
 * — so an element carrying those attributes and one carrying none read identically here. Any question
 * of the form *does this say which of how many it is* has to be asked of the DOM attribute together
 * with the computed role, which is what `a-position-the-attribute-claims` does and why that file
 * caught a conflict this one is blind to.
 *
 * The native `<ol>` is the control that establishes it: the browser computes a position there without
 * anyone asking, and this API still does not carry it. Without that row the same silence would read as
 * *the page did not set them*.
 *
 * **And a tree is not a voice.** Reading order, browse mode, what a person actually hears — none of it
 * is here. This closes the gap between the markup and the tree, which is the one that can be closed
 * without an assistive technology in the room.
 *
 * ## Three existing readings that are deliberately not routed through this
 *
 * They open their own CDP session and that is not duplication to tidy away — each asks a **different
 * question**, and forcing them through a scoped subtree reader would change what they measure:
 *
 * - `a-position-the-attribute-claims` asks for the computed role of **one named element**, and uses
 *   `getPartialAXTree` with `fetchRelatives: false`, which returns that node alone. That is the safe
 *   form of the call this file warns about, not the trap.
 * - `what-a-field-says-on-arrival` and `e2e/shared/state-is-visible` search the **whole document**.
 *   Scoping them to a subtree would narrow the question they were written to ask.
 *
 * A shared helper that changes an existing reading has changed the question rather than the answer.
 */

/**
 * The accessibility tree under `rootSelector`, normalised.
 *
 * Returns `{ nodes, byId, root }` where each node is
 * `{ id, role, name, description, value, states, ignored, childIds, children, backendDOMNodeId }`.
 */
export async function whatAReaderWouldHear(page, rootSelector) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("Accessibility.enable");

    const { root } = await session.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: rootSelector });
    if (!nodeId) {
      throw new Error(
        `[battle] whatAReaderWouldHear: no element matched ${JSON.stringify(rootSelector)}. `
        + "Returning an empty tree would satisfy every assertion about what the tree does not contain, "
        + "which is why this refuses instead.",
      );
    }

    // Every element inside the root, by backend id. `querySelectorAll` with `*` gives the elements;
    // the root itself is added because a check may be about the root's own role.
    const { nodeIds } = await session.send("DOM.querySelectorAll", { nodeId, selector: "*" });
    const backends = new Set();
    for (const id of [nodeId, ...nodeIds]) {
      const { node } = await session.send("DOM.describeNode", { nodeId: id });
      if (node?.backendNodeId !== undefined) backends.add(node.backendNodeId);
    }

    const { nodes: axNodes } = await session.send("Accessibility.getFullAXTree");
    const mine = axNodes.filter((node) => backends.has(node.backendDOMNodeId));

    // A root that exists in the DOM and nowhere in the tree is a real state — an entirely hidden
    // subtree — and it is not the same as a selector that matched nothing. Said differently.
    if (mine.length === 0) {
      throw new Error(
        `[battle] whatAReaderWouldHear: ${JSON.stringify(rootSelector)} is on the page and nothing `
        + "under it reached the accessibility tree. That is a finding, not an empty reading, and it "
        + "needs asserting on purpose rather than inferring from silence.",
      );
    }

    const read = (node) => {
      const states = {};
      for (const property of node.properties ?? []) {
        states[property.name] = property.value?.value;
      }
      return {
        id: node.nodeId,
        role: String(node.role?.value ?? ""),
        name: String(node.name?.value ?? ""),
        description: String(node.description?.value ?? ""),
        value: node.value?.value,
        states,
        ignored: node.ignored === true,
        childIds: node.childIds ?? [],
        backendDOMNodeId: node.backendDOMNodeId,
      };
    };

    const nodes = mine.map(read);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    // Structure as the tree has it, not as the DOM has it: a child the tree did not keep is not a
    // child a reader meets.
    for (const node of nodes) node.children = node.childIds.map((id) => byId.get(id)).filter(Boolean);

    const held = new Set(nodes.flatMap((node) => node.children.map((child) => child.id)));
    return { nodes, byId, roots: nodes.filter((node) => !held.has(node.id)) };
  } finally {
    await session.detach().catch(() => undefined);
  }
}

/** Every node under `node`, itself included, in tree order. */
export function everythingUnder(node) {
  const out = [node];
  for (const child of node.children ?? []) out.push(...everythingUnder(child));
  return out;
}

/** A one-line rendering of a subtree, for a failure message somebody has to read. */
export function asLines(nodes, depth = 0) {
  return nodes.flatMap((node) => [
    `${"  ".repeat(depth)}${node.ignored ? "(ignored) " : ""}${node.role || "—"}`
    + `${node.name ? ` "${node.name}"` : ""}`
    + `${node.value === undefined ? "" : ` = ${JSON.stringify(node.value)}`}`,
    ...asLines(node.children ?? [], depth + 1),
  ]);
}
