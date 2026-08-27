import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, overlayOnlyParts, staticParts } from "@modyra/widgets";

/**
 * A part the contract declares mandatory, and the renderer that builds something else.
 *
 * `MDY_WIDGET_CONTRACTS` is not a list of kinds. A kind carries seven things — `kind`, `rootClasses`,
 * `parts`, `structure`, `presentationClasses`, `variants`, `capabilities` — and the anatomy is split
 * across two of them. `parts` says what a part is made of: its classes, its states, its attributes
 * and, for 32 of the 252, the ARIA role it answers to. `structure` says where it sits and whether it
 * has to be there: every one of the 252 nodes declares `optional`.
 *
 * Read together they are unambiguous about `select.trigger`:
 *
 *   parts.trigger      classes ["mdy-select__trigger"], role "combobox"
 *   structure node     element "input", parent "inputWrapper", optional FALSE
 *   staticParts        listed — not among the parts that exist only while an overlay is open
 *
 * Three published statements, agreeing: a select has a trigger, always, and it is the element that
 * answers to `combobox`. One shipped renderer builds it. The other renders a native `<select>` and
 * builds none of it.
 *
 * The assertion is deliberately narrow. Not `popup`, which `overlayOnlyParts` names as conditional
 * and a closed control has every reason not to have built. `trigger`: declared mandatory by the half
 * of the contract whose job is to say so.
 *
 * That the two renderers differ here is known and was examined before. What is asserted is what that
 * examination did not measure: the contract does not permit the difference, in the vocabulary it
 * keeps for exactly this purpose.
 *
 * Claims under attack: UI-009.
 */

type PartContract = { classes: string[]; attributes: Record<string, unknown>; states: string[]; role?: string };
type StructureNode = { part: string; element: string; parent?: string; order: number; optional: boolean; repeated: boolean };
type KindContract = { rootClasses: string[]; parts: Record<string, PartContract>; structure: { nodes: StructureNode[] } };

const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, KindContract>;

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

const settled = (page: import("@playwright/test").Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));

/** Every element under a mount, shadow roots included, so a renderer's choice of boundary is not the answer. */
async function partsPresent(page: import("@playwright/test").Page, mountId: string, wanted: Record<string, string[]>) {
  return page.evaluate(({ id, parts }) => {
    const scope = document.querySelector(`[data-form="${id}"]`);
    const all: Element[] = [];
    const walk = (root: ParentNode) => {
      for (const element of Array.from(root.querySelectorAll("*"))) {
        all.push(element);
        const shadow = (element as HTMLElement).shadowRoot;
        if (shadow) walk(shadow);
      }
    };
    if (scope) walk(scope);
    const built = (classes: string[]) => all.some((element) => classes.every((one) => element.classList.contains(one)));
    return Object.fromEntries(Object.entries(parts).map(([part, classes]) => [part, built(classes as string[])]));
  }, { id: mountId, parts: wanted });
}

test("the contract declares the trigger mandatory, in the half of it that says so", () => {
  // The control: this is an anatomy rather than a list of names. A part that carries a class and a
  // role is a statement about the DOM, and a renderer that builds something else is not merely
  // styling differently.
  const trigger = CONTRACTS.select.parts.trigger;
  expect(trigger.classes, "the contract's select trigger declares no class").toContain("mdy-select__trigger");
  expect(trigger.role, "the contract's select trigger declares no role").toBe("combobox");

  const nodes = Object.values(CONTRACTS).flatMap((kind) => kind.structure.nodes);
  // Pinned in both directions on purpose: a part removed and a part added are both reasons to
  // re-read the two paragraphs above, which describe this anatomy by number. It has done that job
  // twice — the chip strip gained a row when it became a grid, and two kinds gained a part that
  // sends `false` when their box is not ticked, so that a receiver can tell "the person said no"
  // from "that field was not in this form"; and the multiselect's way back stopped being a row of its
  // own and became a command in the cluster at the field's trailing edge, which is one part fewer
  // because the row it lived in no longer exists. The three statements below were re-read against the
  // new anatomy each time and still hold.
  //
  // Every declared part has a structure node and every node a part: the two counts are the same
  // number, which is what makes this one number able to describe the whole anatomy.
  expect(nodes.length, "the contract moved; the counts in this spec describe a different surface").toBe(264);

  // Optionality is where the contract keeps it: on the structure node, not on the part record. Every
  // node has it, so a part that does not say `optional: true` is one the contract requires.
  expect(
    nodes.filter((node) => "optional" in node).length,
    "a structure node stopped declaring optionality, so `optional: false` below no longer means required",
  ).toBe(nodes.length);

  const node = CONTRACTS.select.structure.nodes.find((each) => each.part === "trigger");
  expect(node?.optional, "the contract no longer requires a select to have a trigger").toBe(false);

  // And the other published statement about the same part agrees: it is not one of the parts that
  // exist only while an overlay is open.
  expect(staticParts("select"), "the trigger is no longer a part a closed select has").toContain("trigger");
  expect(overlayOnlyParts("select"), "the trigger became an overlay-only part").not.toContain("trigger");
});

const needsOptions = (kind: string) => /select|radio|segmented/.test(kind);

/** What a renderer owes for a kind: required, and not one of the parts that live in an overlay. */
function owedParts(kind: string): string[] {
  const borrowed = new Set(overlayOnlyParts(kind));
  return CONTRACTS[kind].structure.nodes
    .filter((node) => node.optional === false && !borrowed.has(node.part))
    .map((node) => node.part);
}

for (const host of HOSTS) {
  test(`every part the contract requires is built, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const gaps: string[] = [];
    let owedTotal = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const owed = owedParts(kind);
      owedTotal += owed.length;

      const field: Record<string, unknown> = { name: "f", kind, label: `Label ${kind}`, validators: { required: true } };
      if (needsOptions(kind)) field.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
      const mountId = `requires-${kind}`;

      const mounted = await page.evaluate(({ api, id, declared }) =>
        (window as never as Record<string, { mountFields(id: string, fields: unknown[]): { mounted: boolean; message?: string } }>)[api]
          .mountFields(id, [declared] as never), { api: host.api, id: mountId, declared: field });
      expect(mounted.mounted, `${kind} did not mount: ${mounted.message ?? ""}`).toBe(true);
      await settled(page);

      const built = await partsPresent(
        page,
        mountId,
        Object.fromEntries(owed.map((part) => [part, CONTRACTS[kind].parts[part].classes])),
      );

      // The control, per kind: the root is one of the owed parts and is always built, so a kind that
      // failed to render at all is a mount failure rather than a list of missing parts.
      expect(built.root, `${host.name} built nothing at all for ${kind}`).toBe(true);

      for (const [part, present] of Object.entries(built)) {
        if (!present) gaps.push(`${kind}.${part}`);
      }
    }

    // The sweep has to be asking for something. A contract that stopped requiring anything would
    // leave this test green while measuring nothing.
    expect(owedTotal, "the contract requires almost nothing, so this sweep is not a check").toBeGreaterThan(50);

    expect(
      gaps,
      `${host.name} did not build parts the contract declares required and not overlay-only`,
    ).toEqual([]);
  });
}
