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
 * **What is asked is that the rule holds at both, and that neither is silent about it.** The two
 * doors are not obliged to refuse the same way, and the record has settled that they should not: a
 * call has a caller holding the result, who can handle a refusal and cannot notice a silence, so it
 * refuses; a value bound into a template has nowhere to catch, so it drops the structure, keeps the
 * questions, and says why where a developer looks. Those are different shapes of the same rule.
 *
 * **What cannot be defended is silence.** A door that builds past the published ceiling and mentions
 * it nowhere lets an application exceed the limit with nobody choosing to and nobody told there was
 * one — and the first sign is whatever the depth eventually costs. So this asks two things of every
 * door: that nothing beyond the ceiling gets built, and that something, somewhere, said so.
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

interface Bench {
  mountFields(id: string, fields: unknown[], options?: unknown): unknown;
  mountDocument(id: string, envelope: unknown): unknown;
  dispose?(id: string): unknown;
}
interface Node { kind: "section"; id: string; label: string; children: unknown[] }

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

    // What the page said out loud. A door may refuse, or it may keep the questions and warn; the one
    // thing it may not do is neither.
    const spoken: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") spoken.push(message.text());
    });
    page.on("pageerror", (error) => spoken.push(error.message));

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

    // Nothing beyond the ceiling is built, whichever door it came through.
    expect(
      { document: beyond.document.built, structure: beyond.structure.built },
      `${host.name}: a layout ${ceiling + 1} deep was built anyway — ${JSON.stringify(beyond)}. The `
      + "ceiling is published and a consuming application reads it; a door that builds past it is a "
      + "limit that exists only in the documentation.",
    ).toEqual({ document: 0, structure: 0 });

    // And no door is silent about having refused it. Refusing is one way to say so; keeping the
    // questions and warning is another, and the record has settled that they need not match. What
    // neither may do is drop the structure and mention it nowhere.
    const mute = ([door, result]: [string, { outcome: string }]) =>
      result.outcome !== "refused" && !spoken.some((line) => /layout|depth|nest/i.test(line))
        ? `${door} accepted it, built nothing, and said nothing`
        : null;
    const silent = [["the document door", beyond.document], ["the structure door", beyond.structure]]
      .map((pair) => mute(pair as [string, { outcome: string }])).filter((one) => one !== null);

    expect(
      silent,
      `${host.name}: ${JSON.stringify(silent)}. A door that drops what it was handed and mentions it `
      + "nowhere lets an application pass the published limit with nobody choosing to and nobody told "
      + `there was one. What was said on the console: ${JSON.stringify(spoken.slice(0, 3))}`,
    ).toEqual([]);
  });
}
