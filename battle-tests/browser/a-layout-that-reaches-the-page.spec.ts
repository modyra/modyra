/**
 * The whole layout chain, from a document to a computed style.
 *
 * `layout` is the headline of contract v2 and it had no browser coverage at all: five published
 * tables govern it, no battle cited any of them, and neither host had ever mounted a document
 * carrying one. What the node-level battles pin is what the functions produce; this asks whether any
 * of it reaches a page.
 *
 * The chain has five links and each can break quietly. A document declares `at` and a slot's
 * placement; the parser keeps them; `layoutNodeAttributes` and `layoutSlotStyle` turn them into
 * custom properties named by `MDY_LAYOUT_COLUMN_*_PROPERTIES`; the renderer puts them on the
 * elements it builds with the classes `MDY_LAYOUT_CLASSES` names; and the shipped stylesheets read
 * them. A property set on an element nothing styles looks exactly like a working layout in the DOM,
 * which is why the last link is checked as a *computed* style rather than as an attribute.
 *
 * Only plain is asked. Lit publishes field elements and an adapter — assembling a form, and so
 * laying it out, is its consumer's job — so there is no lit door for a document with a layout to go
 * through, and that is an architectural difference rather than a gap.
 *
 * The stylesheets are added to the page here: the host is a harness and carries none of its own.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { expect, test } from "@playwright/test";
import {
  MDY_LAYOUT_CLASSES,
  MDY_LAYOUT_COLUMN_COUNT_PROPERTIES,
  MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES,
  MDY_LAYOUT_COLUMN_START_PROPERTIES,
} from "@modyra/widgets";

const SHIPPED = resolve(dirname(new URL(import.meta.url).pathname), "..", "..", "packages", "styles", "dist");

test("plain: a document's layout reaches the page and the stylesheet reads it", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);

  for (const file of readdirSync(SHIPPED).filter((name) => name.endsWith(".css"))) {
    await page.addStyleTag({ content: readFileSync(join(SHIPPED, file), "utf8") });
  }

  const seen = await page.evaluate((names) => {
    const fields = [
      { name: "a", kind: "text", label: "A" },
      { name: "b", kind: "text", label: "B" },
      { name: "c", kind: "text", label: "C" },
    ];
    // One section with a label, and two columns of which the first is placed and hidden at base.
    const layout = [
      { kind: "section", id: "s", label: "Section", children: ["c"] },
      {
        kind: "columns",
        id: "col",
        at: { base: 2, md: 4 },
        columns: [[{ ref: "a", at: { base: { hidden: true, column: 2 } } }], [{ ref: "b" }]],
      },
    ];

    const outcome = (window as never as {
      battle: { mountFields(id: string, f: unknown[], o: unknown): { mounted: boolean; message?: string } };
    }).battle.mountFields("lay", fields, { layout });
    if (!outcome.mounted) return { mounted: false, message: outcome.message ?? null };

    const root = document.querySelector('[data-form="lay"]');
    if (root === null) return { mounted: false, message: "nothing rendered" };

    const count = (cls: string) => root.querySelectorAll(`.${cls}`).length;
    const values = (property: string) => Array.from(root.querySelectorAll("*"))
      .map((element) => (element as HTMLElement).style.getPropertyValue(property))
      .filter((value) => value !== "");

    return {
      mounted: true,
      sections: count(names.section),
      legends: count(names.sectionLabel),
      columnsNodes: count(names.columns),
      columnElements: count(names.column),
      countBase: values(names.countBase),
      countMd: values(names.countMd),
      startBase: values(names.startBase),
      displayBase: values(names.displayBase),
      computed: Array.from(root.querySelectorAll(`.${names.column}`)).map((element) => {
        const style = getComputedStyle(element as HTMLElement);
        return { display: style.display, gridColumnStart: style.gridColumnStart };
      }),
    };
  }, {
    section: MDY_LAYOUT_CLASSES.section,
    sectionLabel: MDY_LAYOUT_CLASSES.sectionLabel,
    columns: MDY_LAYOUT_CLASSES.columns,
    column: MDY_LAYOUT_CLASSES.column,
    countBase: MDY_LAYOUT_COLUMN_COUNT_PROPERTIES.base,
    countMd: MDY_LAYOUT_COLUMN_COUNT_PROPERTIES.md,
    startBase: MDY_LAYOUT_COLUMN_START_PROPERTIES.base,
    displayBase: MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES.base,
  });

  expect(seen, JSON.stringify(seen)).toMatchObject({ mounted: true });

  // The renderer built what the document declared, under the classes the table names.
  expect(seen, JSON.stringify(seen)).toMatchObject({
    sections: 1, legends: 1, columnsNodes: 1, columnElements: 2,
  });

  // The counts and the placement arrived as the properties the tables name.
  expect(seen.countBase, JSON.stringify(seen)).toEqual(["2"]);
  expect(seen.countMd, JSON.stringify(seen)).toEqual(["4"]);
  expect(seen.startBase, JSON.stringify(seen)).toEqual(["2"]);
  expect(seen.displayBase, JSON.stringify(seen)).toEqual(["none"]);

  // And the stylesheet read them. The second column is the control: it is visible, so a hidden first
  // one is the placement rather than a page where nothing is displayed.
  expect(seen.computed, JSON.stringify(seen.computed)).toEqual([
    { display: "none", gridColumnStart: "2" },
    { display: "flex", gridColumnStart: "auto" },
  ]);
});
