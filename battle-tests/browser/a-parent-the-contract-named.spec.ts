/**
 * Whether the page is built in the shape the contract declares.
 *
 * Each kind's contract carries a tree, not only a list: every part names the part that contains it,
 * the order it takes among its siblings, and whether it is optional or repeated. The grammar for
 * saying *this part sits inside that one* has existed all along.
 *
 * **Nothing checked a rendered page against it.** The declared parent was read to walk the contract —
 * to decide whether a part is always present, given that an ancestor may be optional — and never to
 * ask whether the element a renderer drew is where the contract said it goes. So a renderer could
 * satisfy every clause about every part and assemble them into a different tree, and every check
 * agreed, because every check was written from the clauses rather than from the shape.
 *
 * That is how a remove control came to sit inside the control that opens the list. The contract did
 * not permit it — the two are declared as siblings — and nothing was comparing.
 *
 * **The check is per element, not per part.** A part with three elements on the page has three
 * chances to be misplaced, and reporting the part as present would hide two of them.
 *
 * **And the ancestor asked for is the nearest one that is itself a declared part**, not any ancestor
 * carrying the parent's classes. The looser question — *is this somewhere below its declared parent* —
 * is satisfied by almost every arrangement, because almost everything is somewhere below the field.
 * A first version asked it that way, and putting a control back inside the opener that the contract
 * declares as its sibling did not disturb it: the opener is itself below the field, so the answer
 * stayed yes. A check that a deliberate violation cannot fail is not a check.
 *
 * A popup is exempt from its declared parent by the contract's own capability flag, because a popup is
 * rendered at the end of the document so that no ancestor's `overflow` can clip it. That exemption is
 * read from the catalogue rather than written here: a kind that stops portalling its overlay is
 * checked strictly again without this file changing.
 *
 * Claims under attack: UI-005, A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, partClasses } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Node = { part: string; parent?: string };

const OPTIONS = [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }];

const selectorFor = (kind: string, part: string) =>
  (partClasses(kind, part) as string[]).map((one) => `.${one}`).join("");

for (const host of HOSTS) {
  test(`every part sits inside the part the contract names, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const misplaced: string[] = [];
    let checked = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const contract = MDY_WIDGET_CONTRACTS[kind];
      if (contract === undefined) continue;

      // A popup leaves its declared parent on purpose, and everything it contains leaves with it.
      const portals = contract.capabilities?.overlay === true;
      const nodes = contract.structure.nodes as Node[];
      const under = (part: string): boolean => {
        const node = nodes.find((each) => each.part === part);
        if (node === undefined || node.parent === undefined) return false;
        return node.parent === "popup" || under(node.parent);
      };

      const pairs = nodes
        .filter((node) => node.parent !== undefined)
        .filter((node) => !(portals && (node.part === "popup" || under(node.part))))
        .map((node) => ({
          part: node.part,
          parent: node.parent as string,
          child: selectorFor(kind, node.part),
          holder: selectorFor(kind, node.parent as string),
        }))
        .filter((pair) => pair.child !== "" && pair.holder !== "");

      // Every part's selector, so "the nearest ancestor that is a part" can be found without
      // assuming which part it will turn out to be.
      const anyPart = nodes
        .map((node) => selectorFor(kind, node.part))
        .filter((one) => one !== "");

      const id = `shape_${kind}`;
      await page.evaluate(({ api, id, kind, options }) => {
        (window as never as Api)[api].mountFields(id, [{
          name: "f", kind, label: "Scelte", clearable: true, options,
        }] as never);
      }, { api: host.api, id, kind, options: OPTIONS });

      const root = `[data-form="${id}"]`;
      await page.locator(root).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(120);

      const wrong = await page.evaluate(({ selector, pairs, anyPart }) => {
        const partSelector = anyPart.join(", ");
        const out: string[] = [];
        let seen = 0;
        for (const pair of pairs) {
          for (const child of Array.from(document.querySelectorAll(`${selector} ${pair.child}`))) {
            seen += 1;
            // The nearest ancestor that is itself a declared part. Undeclared wrappers a renderer
            // adds for layout are transparent to this — they carry no part and are stepped over.
            const nearest = child.parentElement?.closest(partSelector) ?? null;
            if (nearest === null) continue;
            if (nearest.matches(pair.holder)) continue;
            // A part repeated inside itself resolves to itself; that is the declaration working.
            if (nearest.matches(pair.child)) continue;
            const actual = Array.from(nearest.classList).find((one) => one.startsWith("mdy-")) ?? "something unnamed";
            out.push(`${pair.part} sits inside ${actual}, where the contract names ${pair.parent}`);
          }
        }
        return { out: [...new Set(out)], seen };
      }, { selector: root, pairs, anyPart });

      await page.evaluate(({ api, id }) => { (window as never as Api)[api].dispose?.(id as never); }, { api: host.api, id });

      checked += wrong.seen;
      for (const one of wrong.out) misplaced.push(`${kind}: ${one}`);
    }

    // A run that matched no element would report no misplacement for the wrong reason.
    expect(checked, `${host.name} found no declared part on any page`).toBeGreaterThan(20);
    expect(misplaced, `${host.name} builds ${misplaced.length} part(s) somewhere the contract does not name: ${misplaced.join("; ")}`)
      .toEqual([]);
  });
}
