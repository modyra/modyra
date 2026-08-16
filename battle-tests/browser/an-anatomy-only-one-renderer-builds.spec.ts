import { expect, test } from "@playwright/test";
import { MDY_FORM_SHELL_STRUCTURE, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

/**
 * The anatomy the contract publishes, and the renderer that builds something else.
 *
 * `MDY_WIDGET_CONTRACTS` is not a list of kinds. It is 249 parts across 17 of them, and each part
 * carries the classes it wears, the states it can be in, the attributes it takes and — for 31 of
 * them — the ARIA role it answers to. `select.trigger` is one of those 31: class
 * `mdy-select__trigger`, role `combobox`. That is an anatomy, published, part by part.
 *
 * It is published in one voice. A part has exactly four fields — `classes`, `attributes`, `states`,
 * `role` — and none of the 249 has a way to say "only sometimes". The same package knows how:
 * `MDY_FORM_SHELL_STRUCTURE` marks both of its nodes `optional`. The widget contracts never use it.
 *
 * So `popup`, `listbox` and `option` are declared exactly as `root` and `label` are, and a reader
 * cannot tell that the first three exist only while something is open. Nor can they tell — and this
 * is what the spec measures — that one shipped renderer builds none of the eighteen.
 *
 * The assertion is deliberately narrow. Not the popup, which a closed control has every reason not
 * to have built: `trigger`, the element the contract gives a role to, the thing a person clicks. A
 * consumer writing CSS against `.mdy-select__trigger`, a test against `[role=combobox]`, or a second
 * adapter from the published surface gets what the contract describes in one renderer and a native
 * `<select>` in the other.
 *
 * That the two differ is known and was examined before. What is asserted here is the other half: the
 * contract states an anatomy unconditionally, has the vocabulary to qualify it, and does not.
 *
 * Claims under attack: UI-009.
 */

type PartContract = { classes: string[]; attributes: Record<string, unknown>; states: string[]; role?: string };
type KindContract = { rootClasses: string[]; parts: Record<string, PartContract> };

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

test("the contract fixes markup, part by part, and has no way to qualify it", () => {
  // The control: this is an anatomy rather than a list of names. A part that carries a class and a
  // role is a statement about the DOM, and a renderer that builds something else is not merely
  // styling differently.
  const trigger = CONTRACTS.select.parts.trigger;
  expect(trigger.classes, "the contract's select trigger declares no class").toContain("mdy-select__trigger");
  expect(trigger.role, "the contract's select trigger declares no role").toBe("combobox");

  const parts = Object.values(CONTRACTS).flatMap((kind) => Object.entries(kind.parts));
  expect(parts.length, "the contract shrank; the counts in this spec describe a surface that is gone").toBe(249);

  // The package can say "may be absent". Its shell structure does, on every node it has.
  expect(
    MDY_FORM_SHELL_STRUCTURE.nodes.every((node) => "optional" in node),
    "the shell no longer marks its nodes optional, so the omission below is not an omission",
  ).toBe(true);

  // And no widget part does, anywhere. `popup` is declared exactly as `root` is.
  const qualified = parts.filter(([, part]) =>
    ["optional", "conditional", "when", "repeated"].some((key) => key in (part as Record<string, unknown>)));
  expect(
    qualified.map(([name]) => name),
    "a part now says when it may be absent — this spec's premise is that none can",
  ).toEqual([]);
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
      `${host.name} built no ${CONTRACTS.select.parts.trigger.classes.join(".")}, which the contract declares with role ${CONTRACTS.select.parts.trigger.role} and never marks conditional`,
    ).toBe(true);
  });
}
