/**
 * A part name that refers to more than one element at once.
 *
 * ADR 0143 states the rule and the reason: **one part name means one element.** A name shared by two
 * elements makes every measurement taken through it ambiguous — the record exists because folding a
 * widget's own layout box into the shell's made a height comparison wrong by exactly the border a
 * theme draws on one of them, and nobody could see which box the number had come from.
 *
 * The rule is stated in a decision record and enforced nowhere, which is the same gap the containment
 * check closed one layer up: the grammar exists and nothing compares it to a page.
 *
 * **Nesting is the case that matters**, not repetition. A part the contract marks `repeated` may
 * legitimately appear many times — chips, options, error items — and two elements carrying one name
 * as siblings are at least distinguishable by position. Two nested elements with the same name are
 * not: a selector returns the outer, a measurement may take either, and which one a reading meant is
 * unrecoverable from the reading.
 *
 * So a part is reported only when one of its elements **contains** another of its elements, and
 * repeated parts are excluded by the contract's own flag rather than by a list here.
 *
 * The renderers that draw one element per name are the control. This is a structural claim and it
 * takes a structural instrument: containment in the document is exactly what is being asserted, and
 * pixels would say nothing about it.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, partClasses } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
interface Node { part: string; repeated?: boolean }

const OPTIONS = [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }];

for (const host of HOSTS) {
  test(`no part name refers to two nested elements, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const doubled: string[] = [];
    let checked = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const contract = MDY_WIDGET_CONTRACTS[kind];
      if (contract === undefined) continue;

      const nodes = contract.structure.nodes as Node[];
      const repeated = new Set(nodes.filter((node) => node.repeated === true).map((node) => node.part));
      const parts = Object.keys(contract.parts)
        .filter((part) => !repeated.has(part))
        .map((part) => [part, (partClasses(kind, part) as string[]).map((one) => `.${one}`).join("")] as const)
        .filter(([, selector]) => selector !== "");

      const id = `named_${kind}`;
      await page.evaluate(({ api, id, kind, options }) => {
        (window as never as Api)[api].mountFields(id, [{
          name: "f", kind, label: "Etichetta", clearable: true, options,
        }] as never);
      }, { api: host.api, id, kind, options: OPTIONS });

      const root = `[data-form="${id}"]`;
      await page.locator(root).waitFor({ timeout: 5_000 });
      await page.waitForTimeout(120);

      const found = await page.evaluate(({ selector, parts }) => {
        const out: string[] = [];
        let seen = 0;
        for (const [part, one] of parts) {
          const elements = Array.from(document.querySelectorAll(`${selector} ${one}`));
          if (elements.length === 0) continue;
          seen += 1;
          const inside = elements.filter((element) => elements.some((other) => other !== element && other.contains(element)));
          if (inside.length > 0) out.push(`${part} names ${elements.length} elements, ${inside.length} of them inside another`);
        }
        return { out, seen };
      }, { selector: root, parts: parts.map(([part, selector]) => [part, selector]) });

      await page.evaluate(({ api, id }) => { (window as never as Api)[api].dispose?.(id as never); }, { api: host.api, id });

      checked += found.seen;
      for (const one of found.out) doubled.push(`${kind}: ${one}`);
    }

    // A run matching no part at all would report no doubling for the wrong reason.
    expect(checked, `${host.name} matched no declared part on any kind`).toBeGreaterThan(20);

    expect(
      doubled,
      `${host.name}: ${doubled.length} part name(s) refer to nested elements — ${doubled.join("; ")}. `
      + "A selector returns the outer, a measurement may take either, and a reading cannot say which it meant.",
    ).toEqual([]);
  });
}
