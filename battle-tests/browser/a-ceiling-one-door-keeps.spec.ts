/**
 * Whether the depth a layout may reach is the same through both doors into the library.
 *
 * The contract publishes a ceiling: a layout may nest so deep and no deeper. It is a number a
 * consumer can read, and it is the kind of number that only means something if something enforces it
 * — a limit nobody applies is a comment.
 *
 * **There are two public ways to hand a form its structure**, and they are both doors a consuming
 * application uses: one takes a document and parses it, the other takes the pieces already in the
 * shapes the library uses. The same questionnaire can arrive through either, and which one an
 * application picked is a matter of how it stores its forms — a document from a server, or a
 * structure built in code.
 *
 * **What is asked is that the two agree about the rule.** Not which answer is right: refusing is
 * defensible and so is accepting with a warning, and the record may settle it either way. What cannot
 * be defended is a rule that holds on one door and not the other, because then the ceiling is not a
 * property of the library — it is a property of how you happened to reach it.
 *
 * **The failure has a direction, and it is the bad one.** The door that enforces is the one that
 * refuses the whole document; the door that does not is the one that quietly builds whatever it was
 * handed. So an application built the second way exceeds the limit **without any deliberation at
 * all** — nobody chose to take the risk, nobody was told there was one, and the first sign is
 * whatever the depth eventually costs.
 *
 * **The ceiling is read, not written**, so this file moves with the contract instead of disagreeing
 * with it silently.
 *
 * **The control is in the same run**: at exactly the ceiling both doors accept and both build the
 * structure. Without it, a door that refuses everything would look like a door that enforces, and a
 * harness that mounts nothing would look like a ceiling being kept.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_LAYOUT_MAX_DEPTH } from "@modyra/core";

import { HOSTS } from "./bench";

type Bench = {
  mountFields(id: string, fields: unknown[], options?: unknown): unknown;
  mountDocument(id: string, envelope: unknown): unknown;
  dispose?(id: string): unknown;
};
type Node = { kind: "section"; id: string; label: string; children: unknown[] };

const nestedTo = (depth: number, field: string): Node[] => {
  let node: Node = { kind: "section", id: `s${depth}`, label: `Livello ${depth}`, children: [field] };
  for (let level = depth - 1; level >= 1; level -= 1) {
    node = { kind: "section", id: `s${level}`, label: `Livello ${level}`, children: [node] };
  }
  return [node];
};

const FIELDS = [{ name: "q", kind: "text", label: "Domanda" }];

for (const host of HOSTS) {
  test(`both doors keep the same ceiling, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    /** What a door did with a layout of this depth: whether it accepted, and what it actually built. */
    const through = async (door: "document" | "structure", depth: number) => {
      const id = `${door}${depth}`;
      const outcome = await page.evaluate(async ({ api, mountId, which, layout, fields }) => {
        // Called on the bench object, never detached: these doors read `this`, and a method pulled
        // off its object answers about nothing.
        const bench = (window as never as Record<string, Bench>)[api];
        try {
          const result = which === "document"
            ? await Promise.resolve(bench.mountDocument(mountId, { version: 3, fields, layout }))
            : await Promise.resolve(bench.mountFields(mountId, fields, { layout }));
          const said = result as { mounted?: boolean } | undefined;
          return said?.mounted === false ? "refused" : "accepted";
        } catch { return "refused"; }
      }, { api: host.api, mountId: id, which: door, layout: nestedTo(depth, "q"), fields: FIELDS });

      await page.waitForTimeout(350);
      const built = await page.evaluate(
        (selector) => document.querySelectorAll(`${selector} fieldset, ${selector} [data-layout-id]`).length,
        `[data-form="${id}"]`);
      // Tearing down is not the measurement. A door that refused registered nothing, so asking it to
      // dispose throws — and a spec that lets that through reports its own cleanup as a defect of the
      // thing under test.
      await page.evaluate(({ api, mountId }) => {
        try { (window as never as Record<string, Bench>)[api].dispose?.(mountId); } catch { /* nothing was mounted */ }
      }, { api: host.api, mountId: id });
      return { outcome, built };
    };

    const ceiling = MDY_LAYOUT_MAX_DEPTH;
    const atCeiling = { document: await through("document", ceiling), structure: await through("structure", ceiling) };
    const beyond = { document: await through("document", ceiling + 1), structure: await through("structure", ceiling + 1) };

    // The control, in the same run: at the ceiling both doors take it and both build what was asked.
    // A door that refuses everything looks exactly like one that enforces, and a harness that mounts
    // nothing looks exactly like a ceiling being kept.
    expect(
      { document: atCeiling.document.outcome, structure: atCeiling.structure.outcome },
      `${host.name}: a layout at exactly the ceiling of ${ceiling} was not taken by both doors — `
      + `${JSON.stringify(atCeiling)}. Nothing below distinguishes a rule being kept from a door that `
      + "refuses everything, or from a harness that builds nothing",
    ).toEqual({ document: "accepted", structure: "accepted" });

    expect(
      Math.min(atCeiling.document.built, atCeiling.structure.built),
      `${host.name}: at the ceiling the two doors built ${JSON.stringify(atCeiling)} — one of them `
      + "drew no structure, so what it does one level deeper says nothing about a ceiling",
    ).toBeGreaterThan(1);

    expect(
      { document: beyond.document.outcome, structure: beyond.structure.outcome },
      `${host.name}: one door keeps the published ceiling of ${ceiling} and the other does not. `
      + `A layout ${ceiling + 1} deep — ${JSON.stringify(beyond)}. Which answer is right is a real `
      + "question the record may settle either way; that they differ is not an answer to it. And the "
      + "direction is the bad one: the door that enforces refuses the whole document, and the door "
      + "that does not quietly builds whatever it was handed — so an application built that way "
      + "passes the limit with nobody choosing to, nobody told there was one, and the first sign is "
      + "whatever the depth eventually costs.",
    ).toEqual({ document: beyond.document.outcome, structure: beyond.document.outcome });
  });
}
