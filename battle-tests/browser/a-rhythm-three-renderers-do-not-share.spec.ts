/**
 * A form's spacing and alignment are the same wherever it is drawn.
 *
 * The rule is coherence and symmetry: a person reading a form follows one left edge and one vertical
 * rhythm down the page, and both belong to the contract rather than to whichever renderer drew it.
 * `@modyra/widgets` is the whole framework-agnostic UI contract; a form built on plain and the same
 * form built on Angular are the same form, and a difference between them is a defect unless it was
 * decided and written down.
 *
 * Three properties, and they fail in different places:
 *
 *   1. **within one form**, consecutive fields are the same distance apart — an uneven rhythm reads as
 *      grouping that nobody meant;
 *   2. **within one form**, every control's box starts and ends on the same vertical line, and the
 *      labels start on that line too;
 *   3. **across renderers**, one stylesheet gives one rhythm.
 *
 * The third is the one that is red, and it is invisible to any suite that measures one renderer at a
 * time — which is every spec in this directory that came before it. Each renderer is internally
 * consistent and they disagree with each other, so a per-renderer check passes three times and the
 * project still ships three different forms.
 *
 * Measured on more than one stylesheet, because a rhythm that agrees on the default and diverges on a
 * theme is the shape finding 356 already had. Each sheet is swapped in and read back before anything
 * is measured.
 *
 * Claims under attack: UI-009, UI-011.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

const SHEETS = ["./modyra.css", "./modyra-modern.css", "./modyra-material.css", "./modyra-ios.css", "./modyra-ionic.css"];
const OPTIONS = [{ value: "x", label: "Roma" }, { value: "y", label: "Milano" }];

interface Layout {
  boxes: { left: number; right: number; top: number; height: number }[];
  labels: number[];
  gaps: number[];
  primary: string;
}

async function layoutOf(page: import("@playwright/test").Page, host: typeof HOSTS[number], sheet: string): Promise<Layout> {
  await page.goto(host.page);
  await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

  const applied = await page.evaluate(async (href) => {
    const link = document.querySelector("link[rel=stylesheet]") as HTMLLinkElement | null;
    if (link === null) return null;
    link.href = href;
    for (let waited = 0; waited < 3_000; waited += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (link.sheet !== null) break;
    }
    return {
      loaded: link.sheet !== null,
      primary: getComputedStyle(document.documentElement).getPropertyValue("--mdy-sys-color-primary").trim(),
    };
  }, sheet);
  expect(applied?.loaded, `${sheet} did not load in the ${host.name} host, so nothing read here is its`).toBe(true);

  await page.evaluate(({ api, options }) => {
    (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
      .mountFields("rhythm", [
        { name: "t", kind: "text", label: "Testo" },
        { name: "n", kind: "number", label: "Numero" },
        { name: "s", kind: "select", label: "Select", options },
        { name: "m", kind: "multiselect", label: "Multi", options, initialValue: ["x"] },
      ] as never);
  }, { api: host.api, options: OPTIONS });
  await page.waitForTimeout(450);

  const read = await page.evaluate(() => {
    const root = document.querySelector('[data-form="rhythm"]');
    if (root === null) return null;
    // The control's own box wherever a kind has one of its own, so a multiselect that does not carry
    // the shared wrapper class is measured rather than skipped — a skipped row is a rhythm with a hole
    // in it that reads as even.
    const seen = new Set<Element>();
    const boxes: { left: number; right: number; top: number; height: number }[] = [];
    for (const element of Array.from(root.querySelectorAll(".mdy-input-wrapper, .mdy-multiselect"))) {
      if (Array.from(seen).some((other) => other.contains(element) || element.contains(other))) continue;
      seen.add(element);
      const rect = element.getBoundingClientRect();
      boxes.push({
        left: Math.round(rect.left), right: Math.round(rect.right),
        top: Math.round(rect.top), height: Math.round(rect.height),
      });
    }
    boxes.sort((left, right) => left.top - right.top);
    return {
      boxes,
      labels: Array.from(root.querySelectorAll("label")).map((label) => Math.round(label.getBoundingClientRect().left)),
      gaps: boxes.slice(1).map((box, at) => Math.round(box.top - (boxes[at].top + boxes[at].height))),
    };
  });
  expect(read, `${host.name} mounted nothing under ${sheet}`).not.toBeNull();
  return { ...read!, primary: applied!.primary };
}

for (const host of HOSTS) {
  test(`a form's rows are evenly spaced and share one edge, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    const uneven: string[] = [];
    const ragged: string[] = [];

    for (const sheet of SHEETS) {
      const layout = await layoutOf(page, host, sheet);
      // The premise: there are rows to compare. Four fields were mounted; fewer boxes means a kind drew
      // none, and three evenly spaced rows out of four is not an even form.
      expect(
        layout.boxes.length,
        `${host.name} drew ${layout.boxes.length} control boxes for four fields under ${sheet} — a kind ` +
          `that draws no box of its own cannot be aligned with the others`,
      ).toBe(4);

      if (new Set(layout.gaps).size > 1) uneven.push(`${sheet}  gaps ${layout.gaps.join(" · ")}`);
      const edges = new Set(layout.boxes.map((box) => box.left));
      const rightEdges = new Set(layout.boxes.map((box) => box.right));
      const labelEdges = new Set(layout.labels);
      if (edges.size > 1 || rightEdges.size > 1 || labelEdges.size > 1) {
        ragged.push(
          `${sheet}  left ${[...edges].join("/")} · right ${[...rightEdges].join("/")} · labels ${[...labelEdges].join("/")}`,
        );
      }
    }

    expect(uneven, `the rows are not evenly spaced, so the form reads as grouped where nothing groups it:\n  ${uneven.join("\n  ")}`).toEqual([]);
    expect(ragged, `the controls do not share one vertical line:\n  ${ragged.join("\n  ")}`).toEqual([]);
  });
}

for (const sheet of SHEETS) {
  test(`one stylesheet gives one rhythm, ${sheet.replace("./modyra", "").replace(".css", "") || "-default"}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const measured: Record<string, Layout> = {};
    for (const host of HOSTS) {
      const page = await browser.newPage();
      try {
        measured[host.name] = await layoutOf(page, host, sheet);
      } finally {
        await page.close();
      }
    }

    // The sheet really is the same one in all three windows: they are separate pages and a swap that
    // silently failed in one of them would show up here as a disagreement that is not about rhythm.
    const fingerprints = new Set(Object.values(measured).map((layout) => layout.primary));
    expect(
      [...fingerprints],
      `the three hosts do not agree on which stylesheet is loaded, so a rhythm difference between them ` +
        `would be a difference of sheet rather than of renderer`,
    ).toHaveLength(1);

    const rhythmOf = (layout: Layout) => [...new Set(layout.gaps)].sort((a, b) => a - b).join("/");
    const shown = Object.entries(measured).map(([name, layout]) => `${name} ${rhythmOf(layout)}px`).join(" · ");
    expect(
      new Set(Object.values(measured).map(rhythmOf)).size,
      `the same form on the same stylesheet has a different vertical rhythm in each renderer — ${shown}. ` +
        `\`@modyra/widgets\` is the whole UI contract and a form is the same form wherever it is drawn; ` +
        `a per-renderer check passes three times and the project still ships three forms`,
    ).toBe(1);

    const heights = Object.entries(measured).map(([name, layout]) => `${name} ${[...new Set(layout.boxes.map((box) => box.height))].join("/")}px`);
    expect(
      new Set(Object.values(measured).flatMap((layout) => layout.boxes.map((box) => box.height))).size,
      `the controls are not the same height in every renderer — ${heights.join(" · ")}`,
    ).toBe(1);
  });
}
