import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

/**
 * Every widget kind the vocabulary declares, rendered and handed to an auditor that is not this suite.
 *
 * The rest of the browser tier asks questions it thought of. This one asks a rule set nobody here
 * wrote: axe-core, restricted to the WCAG 2.0 and 2.1 A and AA tags, over one form of every kind in
 * `MDY_DYNAMIC_FIELD_KINDS`. The value is precisely that the checks were not chosen to match what the
 * renderer does — a suite grades its own homework otherwise, and the failures it never imagined stay
 * invisible.
 *
 * The kinds are listed rather than read from the package because a browser bundle here renders rather
 * than imports core; the count is asserted against the vocabulary's own size so a kind added anywhere
 * makes this fail until it is rendered here too.
 *
 * A violation is reported with the element and axe's own explanation, because "17 kinds have an
 * accessibility problem" is not something anybody can act on.
 *
 * Three states, because a widget's markup is not one thing: settled and untouched, opened and typed
 * into, and every field declared required. The third is not decoration — the attributes a required
 * control carries are only present when it is required, so a page audited without one never reaches
 * that markup at all.
 *
 * Claims under attack: A11Y-001, A11Y-002, A11Y-003, A11Y-004.
 */

const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

/** Every kind `MDY_DYNAMIC_FIELD_KINDS` declares. */
const KINDS = [
  "text", "textarea", "email", "password", "number", "slider", "checkbox", "toggle", "select",
  "radio", "multiselect", "segmented", "datepicker", "daterange", "timepicker", "file", "colors",
];

const needsOptions = (kind: string) => /select|radio|segmented/.test(kind);

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

async function mountEveryKind(page: import("@playwright/test").Page, { required = false } = {}) {
  for (const kind of KINDS) {
    const field: Record<string, unknown> = { name: kind, kind, label: `Label ${kind}` };
    if (required) field.validators = { required: true };
    if (needsOptions(kind)) field.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
    const mounted = await page.evaluate(
      ({ id, declared }) => window.battle.mountFields(id, [declared] as never),
      { id: `k-${kind}`, declared: field },
    );
    expect(mounted.mounted, `${kind} did not mount: ${mounted.message ?? ""}`).toBe(true);
  }
  await settled(page);
}

async function auditStage(page: import("@playwright/test").Page) {
  await page.addScriptTag({ content: AXE });

  // What the auditor could not decide, printed beside what it did. A run that showed only violations
  // would pass while critical items waited for a person, and nobody would know they were waiting.
  const undecided = await page.evaluate(async () => {
    const axe = (window as never as {
      axe: { run: (context: unknown, options: unknown) => Promise<{ incomplete: Array<Record<string, unknown>> }> };
    }).axe;
    const result = await axe.run("#stage", {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return (result.incomplete ?? []).map((item) => `${item.id as string} ×${((item.nodes as unknown[]) ?? []).length}`);
  });
  if (undecided.length > 0) console.log(`    axe could not decide: ${undecided.join(", ")}`);

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
      help: violation.help as string,
      nodes: (violation.nodes as Array<{ target: string[]; html: string; failureSummary?: string }>).map((node) => ({
        target: node.target.join(" "),
        html: node.html.slice(0, 140),
        why: (node.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 160),
      })),
    }));
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("the auditor reports a problem when the page has one", async ({ page }) => {
  // A check nobody has watched fail is only a claim. An input with no label at all is the plainest
  // thing this rule set exists to catch, so seeing it caught is what the assertions below rest on.
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "text";
    document.querySelector("#stage")!.append(input);
  });

  const violations = await auditStage(page);
  expect(violations.map((each) => each.id)).toContain("label");
});

test("every declared kind renders a form the auditor has nothing to say about", async ({ page }) => {
  await mountEveryKind(page);

  // The premise: all seventeen are on the page. An audit of a page that failed to render most of them
  // would be clean for the wrong reason.
  const rendered = await page.evaluate(() => document.querySelectorAll("#stage [data-mdy-field]").length);
  expect(rendered).toBe(KINDS.length);

  const violations = await auditStage(page);
  expect(violations, JSON.stringify(violations, null, 1)).toEqual([]);
});

test("a form the user has opened and filled is still one the auditor has nothing to say about", async ({ page }) => {
  // A settled, untouched page is the easy state. What a person leaves behind — an open listbox, a
  // typed value, a visible error — is the state a rule set is more likely to have something to say
  // about, and the one nobody screenshots.
  await mountEveryKind(page);

  await page.locator('[data-form="k-text"] input').fill("typed");
  await page.locator('[data-form="k-select"] [role="combobox"]').click();
  await settled(page);

  const violations = await auditStage(page);
  expect(violations, JSON.stringify(violations, null, 1)).toEqual([]);
});

test("every declared kind is one the auditor has nothing to say about when it is required", async ({ page }) => {
  // The attributes a required control carries exist only when it is required, so the two states above
  // never reach that markup. `aria-required` in particular is permitted on some roles and not others,
  // which makes this the state where a widget's role and its attributes have to agree.
  await mountEveryKind(page, { required: true });

  const marked = await page.evaluate(() => document.querySelectorAll('#stage [aria-required="true"]').length);
  expect(marked, "no control was marked required, so this state is the same as the first").toBeGreaterThan(0);

  const violations = await auditStage(page);
  expect(violations, JSON.stringify(violations, null, 1)).toEqual([]);
});
