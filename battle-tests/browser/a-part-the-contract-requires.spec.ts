import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, overlayOnlyParts, staticParts } from "@modyra/widgets";

/**
 * A part the contract declares mandatory, and the renderer that builds something else.
 *
 * `MDY_WIDGET_CONTRACTS` is not a list of kinds. A kind carries seven things — `kind`, `rootClasses`,
 * `parts`, `structure`, `presentationClasses`, `variants`, `capabilities` — and the anatomy is split
 * across two of them. `parts` says what a part is made of: its classes, its states, its attributes
 * and, for 31 of the 249, the ARIA role it answers to. `structure` says where it sits and whether it
 * has to be there: every one of the 249 nodes declares `optional`.
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

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
] as const;

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
  expect(nodes.length, "the contract shrank; the counts in this spec describe a surface that is gone").toBe(249);

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

for (const host of HOSTS) {
  test(`the part the contract gives a role to is built, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mounted = await page.evaluate(({ api }) =>
      (window as never as Record<string, { mountFields(id: string, fields: unknown[]): { mounted: boolean; message?: string } }>)[api]
        .mountFields("anatomy", [{
          name: "pick",
          kind: "select",
          label: "Pick",
          options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
        }] as never), { api: host.api });
    expect(mounted.mounted, `the select did not mount: ${mounted.message ?? ""}`).toBe(true);
    await settled(page);

    const built = await partsPresent(page, "anatomy", {
      root: CONTRACTS.select.parts.root.classes,
      label: CONTRACTS.select.parts.label.classes,
      trigger: CONTRACTS.select.parts.trigger.classes,
    });

    // The control: the parts of the anatomy that both renderers do build. Without these, a failure
    // below would say nothing about `trigger` — it would say the mount never happened.
    expect(built.root, `${host.name} built no element wearing the contract's root classes`).toBe(true);
    expect(built.label, `${host.name} built no element wearing the contract's label class`).toBe(true);

    // And the part the contract gives a role to. Nothing in the published surface says a renderer
    // may answer this with something else.
    expect(
      built.trigger,
      `${host.name} built no ${CONTRACTS.select.parts.trigger.classes.join(".")}, which the contract declares with role ${CONTRACTS.select.parts.trigger.role} and marks optional: false`,
    ).toBe(true);
  });
}
