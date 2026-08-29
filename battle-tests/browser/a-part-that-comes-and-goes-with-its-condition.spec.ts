/**
 * A part declared under a condition is there when the condition holds and gone when it does not.
 *
 * `presentWhen` is the contract's answer to *when is this optional part owed*, and until every
 * condition had a published way to decide it, nothing read those declarations at all: a renderer
 * could draw the part always, or never, and no check could tell. A rule wired to nothing is the
 * shape this repository keeps producing, and it drifts silently because half of it is true.
 *
 * Three conditions are driven here because a **document** can put a field on either side of them:
 * whether the field is required, whether it holds a value, whether it holds none. The others need a
 * gesture or a runtime state and belong with the checks that make those — an overlay's parts are
 * asked by the spec that opens one.
 *
 * **Owed is asked, not derived.** A node carries more than the condition it is present under: a part
 * may also want a capability the field was never given, and a run that read `presentWhen` alone
 * demanded a reorder grip from a multiselect nobody may reorder. `partIsOwed` takes both halves, so
 * what this compares is the contract's own answer rather than half of it read carefully.
 *
 * **Both sides, always.** A part that is always drawn passes "present when the condition holds" and a
 * part that is never drawn passes "absent when it does not"; only the pair says the renderer read the
 * declaration. What is reported names which side failed, because they are different defects: drawn
 * too eagerly is noise in the tree, and missing when owed is a control with a piece removed.
 *
 * **A state that cannot be reached from a document is reported, not skipped.** A file field takes no
 * value a page can declare, so the parts under `valueIsPresent` there are named as unreached rather
 * than counted as green — a check that quietly drops what it cannot drive reads as coverage.
 *
 * Claims under attack: UI-009, A11Y-004.
 */

import { expect, test, type Page } from "@playwright/test";
import { MDY_PRESENCE_RESOLUTION, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, partIsOwed } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Node = { part: string; presentWhen?: string; optional?: boolean };

const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, {
  parts: Record<string, { classes: string[] }>;
  structure: { nodes: Node[] };
}>;
const RESOLUTION = MDY_PRESENCE_RESOLUTION as unknown as Record<string, { resolver: string | null }>;

/** The conditions a document alone can put a field on either side of. */
const DRIVEN = ["fieldIsRequired", "valueIsPresent", "valueIsAbsent"] as const;
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

/** A value each kind will accept from a document, or nothing where a page cannot declare one. */
const VALUE: Record<string, unknown> = {
  select: "a", multiselect: ["a"], text: "x", email: "a@b.co", password: "x", textarea: "x",
  number: 1, slider: 1, checkbox: true, toggle: true, radio: "a", segmented: "a",
  datepicker: "2026-03-12", daterange: { start: "2026-03-12", end: "2026-03-14" },
  timepicker: "10:30", colors: "#336699",
};

for (const host of HOSTS) {
/**
 * What the shape this renderer actually drew requires, or `null` for a kind that declares no shapes.
 *
 * Which document asks for which shape is not published, so the shape is read back from the page. A
 * platform control is recognised by the platform's own element, because the parts a variant requires
 * do not separate the two: a native control is styled with the same arrow as a custom trigger.
 */
const drawnVariantRequires = async (page: Page, id: string, kind: string): Promise<string[] | null> => {
  const variants = (CONTRACTS[kind] as { variants?: Record<string, { required?: string[] }> }).variants ?? {};
  const names = Object.keys(variants);
  if (names.length === 0) return null;
  if (names.includes("native")) {
    const native = await page.evaluate(({ id }) =>
      document.querySelector(`[data-form="${id}"] select`) !== null, { id });
    return [...(variants[native ? "native" : "custom"]?.required ?? [])];
  }
  const drawn = names.filter((name) => (variants[name]?.required ?? []).length > 0);
  return drawn.length === 1 ? [...(variants[drawn[0]]?.required ?? [])] : null;
};

  test(`a part is there when its condition holds and gone when it does not, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // A condition with nothing to decide it is one no renderer could have read, and this would be
    // measuring agreement by accident.
    for (const condition of DRIVEN) {
      expect(RESOLUTION[condition]?.resolver, `${condition} has no published resolver`).not.toBeNull();
    }

    const mount = async (id: string, kind: string, field: Record<string, unknown>) => {
      await page.evaluate(({ api, mountId, one }) => {
        (window as never as Api)[api].mountFields(mountId, [one] as never);
      }, { api: host.api, mountId: id, one: { name: "f", kind, label: "L", options: OPTIONS, ...field } });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(110);
    };

    const drawn = (id: string, classes: string[]) => page.evaluate(({ mountId, sel }) => {
      const root = document.querySelector(`[data-form="${mountId}"]`);
      return (root?.querySelectorAll(sel).length ?? 0) > 0;
    }, { mountId: id, sel: classes.map((one) => `.${one}`).join("") });

    /** What a document says to put a field on the true side of each condition. */
    const holding = (condition: string, kind: string): Record<string, unknown> | null => {
      if (condition === "fieldIsRequired") return { validators: { required: true } };
      const value = VALUE[kind];
      if (value === undefined) return null;
      return condition === "valueIsPresent" ? { initialValue: value } : {};
    };
    const failing = (condition: string, kind: string): Record<string, unknown> | null => {
      if (condition === "fieldIsRequired") return {};
      const value = VALUE[kind];
      if (value === undefined) return null;
      return condition === "valueIsPresent" ? {} : { initialValue: value };
    };

    const drawnWithoutIt: string[] = [];
    const missingWhenOwed: string[] = [];
    const unreachable: string[] = [];
    let compared = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      for (const node of CONTRACTS[kind].structure.nodes) {
        if (node.presentWhen === undefined || !DRIVEN.includes(node.presentWhen as never)) continue;
        const classes = CONTRACTS[kind].parts[node.part]?.classes ?? [];
        if (classes.length === 0) { unreachable.push(`${kind}.${node.part}: names no class`); continue; }

        const yes = holding(node.presentWhen, kind);
        const no = failing(node.presentWhen, kind);
        if (yes === null || no === null) {
          unreachable.push(`${kind}.${node.part}: no value a document can declare`);
          continue;
        }

        const onId = `on_${kind}_${node.part}`;
        await mount(onId, kind, yes);
        const offId = `off_${kind}_${node.part}`;
        await mount(offId, kind, no);
        compared += 1;

        // The field is mounted with no capability beyond its kind, so a part that wants one is not
        // owed here whatever its condition says.
        // A kind that declares shapes answers this from the shape it drew, not from the condition: a
        // variant's required list replaces the presence conditions rather than joining them, so a
        // part conditioned on a value is owed by the shape that lists it and by no other. A platform
        // control has no element to carry a part the custom anatomy draws, and demanding one of it
        // reports the shape as a missing piece.
        const shapeRequires = await drawnVariantRequires(page, onId, kind);
        const owedWhenHolding = shapeRequires === null
          ? partIsOwed(node as never, {
            holds: (condition: string) => condition === node.presentWhen,
            offers: () => false,
          } as never)
          : shapeRequires.includes(node.part);
        if (owedWhenHolding && !(await drawn(onId, classes))) {
          missingWhenOwed.push(`${kind}.${node.part} (${node.presentWhen})`);
        }
        if (await drawn(offId, classes)) drawnWithoutIt.push(`${kind}.${node.part} (${node.presentWhen})`);
      }
    }

    expect(
      compared,
      `${host.name} could drive almost none of the declarations`
      + `${unreachable.length > 0 ? `: ${JSON.stringify(unreachable)}` : ""}, so the agreement below is `
      + "this run finding nothing to compare rather than the renderer following the contract",
    ).toBeGreaterThan(15);

    expect(
      { missingWhenOwed, drawnWithoutIt },
      `${host.name} draws parts against their declared condition. Owed and absent: `
      + `${JSON.stringify(missingWhenOwed)} — a control with a piece removed. Drawn with the condition `
      + `false: ${JSON.stringify(drawnWithoutIt)} — a part in the tree that nothing asks for. `
      + (unreachable.length > 0
        ? `Not driven from a document, so untested here: ${JSON.stringify(unreachable)}.`
        : "Every declaration was driven from both sides."),
    ).toEqual({ missingWhenOwed: [], drawnWithoutIt: [] });
  });
}
