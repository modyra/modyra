import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

/**
 * Every widget kind, rendered by `@modyra/lit`, handed to the same auditor Plain gets.
 *
 * The Plain audit is next door and asks the same question of the same rule set. Running both is what
 * turns "this renderer has an accessibility defect" into something a reader can act on: a defect one
 * renderer has and the other does not is that renderer's, and one they share is the contract's.
 *
 * They do not share these. Lit is clean where Plain is not — no role-less wrapper carrying
 * `aria-label` — and reports two of its own:
 *
 *   aria-allowed-attr   critical   both daterange inputs carry `aria-expanded` on a bare textbox
 *   nested-interactive  serious    the colours button contains something interactive
 *
 * `aria-expanded` needs a role that permits it, and Plain's datepicker input carries
 * `role="combobox"` where Lit's daterange inputs carry none — so the fix has a shape to copy in the
 * repository rather than one to invent.
 *
 * That the two renderers fail differently is the finding underneath both: `@modyra/widgets` describes
 * the parts and the relations, and neither of these is checked anywhere the renderers share.
 */

const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const KINDS = [
  "text", "textarea", "email", "password", "number", "slider", "checkbox", "toggle", "select",
  "radio", "multiselect", "segmented", "datepicker", "daterange", "timepicker", "file", "colors",
];

const needsOptions = (kind) => /select|radio|segmented/.test(kind);

async function auditStage(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const axe = (window as never as {
      axe: { run: (context: unknown, options: unknown) => Promise<{ violations: Array<Record<string, unknown>> }> };
    }).axe;
    const result = await axe.run("#stage", {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.map((violation) => ({
      id: violation.id as string,
      impact: violation.impact as string,
      nodes: (violation.nodes as Array<{ target: string[]; failureSummary?: string }>).map((node) => ({
        target: node.target.join(" "),
        why: (node.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 120),
      })),
    }));
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/lit.html");
  await page.waitForFunction(() => (window as never as { battleLitReady?: boolean }).battleLitReady === true);
});

test("the auditor reports a problem when the lit page has one", async ({ page }) => {
  // A check nobody has watched fail is only a claim, and this page is new.
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "text";
    document.querySelector("#stage")!.append(input);
  });
  const violations = await auditStage(page);
  expect(violations.map((each) => each.id)).toContain("label");
});

test("every declared kind renders a lit form the auditor has nothing to say about", async ({ page }) => {
  const mounted = await page.evaluate(
    ({ kinds }) =>
      kinds.map((kind: string) => {
        const field: Record<string, unknown> = { name: kind, kind, label: `L ${kind}` };
        if (/select|radio|segmented/.test(kind)) {
          field.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
        }
        const outcome = (window as never as { battleLit: Record<string, Function> }).battleLit
          .mountFields(`k-${kind}`, [field]);
        return { kind, ok: outcome.mounted, message: outcome.message ?? null };
      }),
    { kinds: KINDS },
  );

  // The premise: every kind is on the page. An audit of a page that rendered half of them would be
  // clean for the wrong reason.
  expect(mounted.filter((each) => !each.ok), JSON.stringify(mounted)).toEqual([]);
  expect(await page.evaluate(() => document.querySelectorAll("#stage [data-form]").length)).toBe(KINDS.length);

  await page.waitForTimeout(400);
  const violations = await auditStage(page);
  expect(violations, JSON.stringify(violations, null, 1)).toEqual([]);
});
