/**
 * An optional part is one the structure permits to be absent. For fifty-six of them the contract also
 * says *when* absence is permitted — `overlayOnlyParts` names the parts that exist only while a panel
 * is open, and that single declaration is what makes them checkable: a check can open the panel and
 * demand them.
 *
 * For the rest there is no such declaration. The structure says the part may exist; nothing says in
 * which state it is owed. So a renderer that draws it and a renderer that does not are both conforming,
 * and the difference between them is invisible to every check in the suite.
 *
 * This measures that difference on a field at rest — a label, no supporting text, no errors, one option
 * where a choice is needed — and splits it in two:
 *
 *   drawn by all three   an optional part that is universal in practice. Nothing demands it, so a
 *                        renderer may drop it tomorrow and the suite stays green. Held here.
 *   drawn by some        three answers to a question nobody asked. Neither answer is wrong, which is
 *                        the finding: the contract owes a condition, not the renderers a repair.
 *
 * Presence in the document is what this asks, not a box: a part that is emitted and hidden is still an
 * emitted part, and the structural question is whether the element exists at all.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, overlayOnlyParts } from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Contract = {
  parts: Record<string, { classes: string[] }>;
  structure: { nodes: { part: string; optional?: boolean }[] };
};
const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, Contract>;

/** The parts this asks about: optional, and without the one condition the contract does declare. */
const unconditionedParts = (kind: string): string[] => {
  const conditioned = new Set(overlayOnlyParts(kind as never));
  return CONTRACTS[kind].structure.nodes
    .filter((node) => node.part !== "root" && node.optional !== false && !conditioned.has(node.part))
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
  const census = new Map<string, Set<string>>();
  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    census.set(host.name, await censusOf(page, host.api));
  }

  const everywhere = [...census.values()].reduce((all, one) => new Set([...all, ...one]));
  const divergent = [...everywhere]
    .filter((part) => ![...census.values()].every((drawn) => drawn.has(part)))
    .map((part) => `${part}: ${[...census].filter(([, drawn]) => drawn.has(part)).map(([name]) => name).join("+")}`)
    .sort();

  // A page that mounted nothing draws nothing, and "nothing diverges" is what that looks like from
  // here. The census has to be shown alive before its emptiness means anything.
  for (const [name, drawn] of census) {
    expect(drawn.size, `${name} drew no optional part at all - the census is measuring a dead page`).toBeGreaterThan(0);
  }

  // The finding: a part some renderers draw and others do not, with nothing in the contract to settle
  // it. Both answers conform, so this is owed a condition rather than a repair.
  expect(divergent, "optional parts with no declared condition, drawn by some renderers and not others").toEqual([]);
});
