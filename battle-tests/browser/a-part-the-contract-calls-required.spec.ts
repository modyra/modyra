/**
 * A part the contract calls required is one every renderer draws.
 *
 * `MDY_WIDGET_CONTRACTS` marks each part of each kind optional or not. A part that is **not**
 * optional is the contract saying: this exists, a consumer may style it, a check may look for it, a
 * theme may target its class. That promise is only worth something if it holds in every renderer.
 *
 * Nothing asserted it. The per-kind battles all begin by locating the control and then examine what
 * they find, so a part that is simply absent produces no finding — the check looks for it, does not
 * find it, and measures whatever else is there. A required part can go missing in one renderer for
 * as long as nobody writes the question down.
 *
 * It had. `select` declares `options` required, and it is missing in Lit in both of its shapes and
 * in Angular's native one — three of six renderer-and-mode combinations, with every gate green.
 * [ADR 0139](../../docs/architecture/0139-a-select-has-two-shapes.md) records why that is possible:
 * a native `<select>`'s list belongs to the platform and no markup of ours can exist for it, so the
 * part cannot be drawn and the contract asks for it anyway.
 *
 * **This spec does not decide which side is wrong.** A part that cannot exist in one shape is either
 * a part the contract should call optional or a renderer that should draw it; both close this, and
 * choosing is a contract decision rather than a battle's. What it refuses is the third state, where
 * the contract promises something two renderers do not have and nothing says so.
 *
 * A part is looked for **on the page**, not only inside the form: an overlay is portalled out of the
 * root in some renderers, and a part reported missing because it was drawn elsewhere would be this
 * spec's defect rather than a finding.
 *
 * **Required means required unconditionally, which means every ancestor is too.** A part inside a
 * popup exists when the popup does; marking it non-optional says it is always there *given its
 * parent*. Read the other way, this reported six kinds missing an option list because nothing was
 * open — and `select`'s `options` as a promise nothing keeps, when the promise is conditional and
 * kept. Sixty-four parts across seventeen kinds survive the correct reading, which the premise below
 * holds it to.
 *
 * Claims under attack: UI-009, ADP-001.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "@modyra/widgets";
import { HOSTS } from "./bench";

type Contract = {
  readonly parts: Record<string, { readonly classes?: readonly string[] }>;
  readonly structure: {
    readonly nodes: ReadonlyArray<{ readonly part: string; readonly parent?: string; readonly optional: boolean }>;
  };
};

const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, Contract>;

for (const host of HOSTS) {
  test(`every required part is drawn, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const absent: Array<Record<string, unknown>> = [];
    let checked = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const contract = CONTRACTS[kind];
      if (contract === undefined) continue;

      // **Required means required *unconditionally*, which means every ancestor is too.**
      // A part inside a popup exists when the popup does. Marking it non-optional says it is always
      // there *given its parent*, not that its parent is always there — and a check that reads it
      // the other way reports six kinds missing an option list because nothing was open. That is
      // the check misreading the structure, not six renderers agreeing to be wrong.
      const byPart = new Map(contract.structure.nodes.map((node) => [node.part, node]));
      const alwaysThere = (part: string, seen = new Set<string>()): boolean => {
        const node = byPart.get(part);
        if (node === undefined || node.optional) return false;
        if (node.parent === undefined || node.parent === part || seen.has(node.parent)) return true;
        seen.add(part);
        return alwaysThere(node.parent, seen);
      };

      const required = contract.structure.nodes
        .filter((node) => alwaysThere(node.part))
        .map((node) => ({ part: node.part, classes: contract.parts[node.part]?.classes ?? [] }))
        // A part the catalogue names without classes is one nothing can look for, which is a
        // different question and not this one's.
        .filter((each) => each.classes.length > 0);
      if (required.length === 0) continue;
      checked += required.length;

      const id = `req-${kind}`;
      await page.evaluate(({ api, mountId, k }) => {
        (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
          .mountFields(mountId, [{
            name: "f", kind: k, label: "F",
            options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          }] as never);
      }, { api: host.api, mountId: id, k: kind });
      await page.waitForTimeout(300);

      const missing = await page.evaluate(({ mountId, wanted }) => {
        const root = document.querySelector(`[data-form="${mountId}"]`);
        if (root === null) return { mounted: false, missing: [] as string[] };
        return {
          mounted: true,
          missing: wanted
            // Both scopes, in this order: inside the control, then anywhere on the page for the
            // parts a renderer portals out.
            .filter(({ classes }) => {
              const selector = `.${classes.join(".")}`;
              return root.querySelectorAll(selector).length === 0
                && document.querySelectorAll(selector).length === 0;
            })
            .map(({ part }) => part),
        };
      }, { mountId: id, wanted: required });

      if (!missing.mounted) continue;
      if (missing.missing.length > 0) absent.push({ kind, missing: missing.missing });
    }

    // The premise: the reading of "required" above leaves something to compare. Counting ancestors
    // is what makes this check honest, and it is also what could quietly reduce it to nothing —
    // one part marked optional near the root and every descendant stops being asked about.
    expect(
      checked,
      "no part survived the required-and-every-ancestor-required reading, so this battle is "
        + "comparing nothing and would pass whatever the renderers drew",
    ).toBeGreaterThan(20);

    expect(
      absent,
      `${absent.length} kind(s) do not draw a part the contract declares required:\n` +
        `${JSON.stringify(absent, null, 1)}\n\n` +
        "Either the part is optional and the contract should say so, or the renderer owes it. Both " +
        "close this; what it refuses is a promise nothing keeps.",
    ).toEqual([]);
  });
}
