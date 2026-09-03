/**
 * An optional part is one the structure permits to be absent. A part permitted to be absent and never
 * told when is a question with no answer: a renderer that draws it and a renderer that does not both
 * conform, and the difference between them is invisible to every check in the suite.
 *
 * So the contract owes a condition for every one of them, and this holds that line in two places.
 *
 *   the declaration   every optional part outside a panel says when it is owed, either by naming a
 *                     condition or by being one of the parts that exist only while a panel is open.
 *                     A part added without one is the defect, and it is a contract defect.
 *   the drawing       for any part that has no condition anyway, what the renderers do with it. Some
 *                     drawing it and some not is three answers to a question nobody asked; neither
 *                     answer is wrong, which is the finding.
 *
 * A part *with* a condition is not asked about here. It is owed when the condition holds and gone
 * when it does not, both directions driven from a document, and that is a different check.
 *
 * Presence in the document is what this asks, not a box: a part that is emitted and hidden is still an
 * emitted part, and the structural question is whether the element exists at all.
 *
 * Claims under attack: UI-009.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, overlayOnlyParts } from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
interface Contract {
  parts: Record<string, { classes: string[] }>;
  structure: { nodes: { part: string; optional?: boolean; presentWhen?: string }[] };
}
const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, Contract>;

/** The parts this asks about: optional, and with nothing anywhere saying when they are owed. */
const unconditionedParts = (kind: string): string[] => {
  const conditioned = new Set(overlayOnlyParts(kind as never));
  return CONTRACTS[kind].structure.nodes
    .filter((node) => node.part !== "root" && node.optional !== false
      && !conditioned.has(node.part) && node.presentWhen === undefined)
    .map((node) => node.part)
    .filter((part) => (CONTRACTS[kind].parts[part]?.classes ?? []).length > 0);
};

/** A field of the kind, in the state a form opens in. Options only where a choice needs them. */
const atRest = (kind: string): Record<string, unknown> => {
  const field: Record<string, unknown> = { name: "campo", kind, label: "Etichetta" };
  if (/select|radio|segmented/.test(kind)) field.options = [{ value: "a", label: "A" }];
  return field;
};

const censusOf = async (page: import("@playwright/test").Page, api: string): Promise<Set<string>> => {
  const drawn = new Set<string>();
  for (const kind of MDY_WIDGET_KINDS as unknown as string[]) {
    const parts = unconditionedParts(kind);
    if (parts.length === 0) continue;
    const mountId = `census_${kind}`;
    await page.evaluate(
      ({ door, id, field }) => (window as never as Api)[door].mountFields(id, [field] as never),
      { door: api, id: mountId, field: atRest(kind) },
    );
    await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
    const present = await page.evaluate(
      ({ selector, wanted }) => {
        const root = document.querySelector(selector);
        if (root === null) return [] as string[];
        return Object.entries(wanted as Record<string, string[]>)
          .filter(([, classes]) => root.querySelector(classes.map((one) => `.${one}`).join("")) !== null)
          .map(([part]) => part);
      },
      {
        selector: `[data-form="${mountId}"]`,
        wanted: Object.fromEntries(parts.map((part) => [part, CONTRACTS[kind].parts[part].classes])),
      },
    );
    for (const part of present) drawn.add(`${kind}.${part}`);
    await page.evaluate(
      ({ door, id }) => {
        try {
          (window as never as Api)[door].dispose?.(id as never);
        } catch {
          /* a host without a door to close leaves the form standing; the next mount has its own id */
        }
      },
      { door: api, id: mountId },
    );
  }
  return drawn;
};

test("a part drawn that nothing asks for", async ({ page }) => {
  test.setTimeout(900_000);

  // The declaration, asked of the contract before any page is opened: a part permitted to be absent
  // and never told when is unfalsifiable by construction, so the absence of one is the whole finding.
  const owedACondition = (MDY_WIDGET_KINDS as unknown as string[])
    .flatMap((kind) => unconditionedParts(kind).map((part) => `${kind}.${part}`))
    .sort();

  const census = new Map<string, Set<string>>();
  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    census.set(host.name, await censusOf(page, host.api));
  }

  const everywhere = [...census.values()].reduce((all, one) => new Set([...all, ...one]), new Set<string>());
  const divergent = [...everywhere]
    .filter((part) => ![...census.values()].every((drawn) => drawn.has(part)))
    .map((part) => `${part}: ${[...census].filter(([, drawn]) => drawn.has(part)).map(([name]) => name).join("+")}`)
    .sort();

  // A page that mounted nothing draws nothing, and "nothing diverges" is what that looks like from
  // here. Where there is something to count, the census has to be shown alive before its emptiness
  // means anything; where there is nothing, the line above is what this spec is asserting.
  if (owedACondition.length > 0) {
    for (const [name, drawn] of census) {
      expect(drawn.size, `${name} drew no optional part at all - the census is measuring a dead page`).toBeGreaterThan(0);
    }
  }

  expect(
    divergent,
    "optional parts with no declared condition, drawn by some renderers and not others",
  ).toEqual([]);

  expect(
    owedACondition,
    `${owedACondition.length} optional part(s) are permitted to be absent with nothing saying when:\n`
    + `${owedACondition.join("\n")}\n\nA renderer that draws one and a renderer that does not both `
    + "conform, so no check in this suite can tell them apart. The condition is owed by the contract, "
    + "not the drawing by a renderer.",
  ).toEqual([]);
});
