import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * A field a document declared without a label, and the control nobody can name.
 *
 * The Dynamic Form Contract makes `label` optional. Measured rather than assumed: `parseDynamicForm`
 * accepts a field with no `label` key, with an empty one and with a whitespace one, in **both**
 * lenient and strict mode, for every kind — including `daterange` and `select`.
 *
 * The widgets contract says something else about the result. `MDY_SEMANTICS_REQUIRING_NAME` is a
 * published list of the roles that must carry an accessible name — `listbox`, `dialog`, `grid` — and
 * a `daterange` without a label renders `role="grid"` with neither `aria-label` nor
 * `aria-labelledby`. A plain text field renders an input with no `aria-label`, no `aria-labelledby`,
 * and a `<label for>` element that is **empty**.
 *
 * So the two halves of the contract disagree about the same field, and the renderer resolves it by
 * producing a control a screen reader announces as its role and nothing else.
 *
 * **An auditor does not see all of it**, which is why the check is written by hand. axe-core over the
 * same four fields catches the text field, the select and the checkbox — and says nothing about the
 * `daterange`, whose `role="grid"` has no name at all. A role with no name is not a rule axe runs
 * here, and it is the one the widgets contract names explicitly.
 *
 * Either repair closes it: require a label where a document is read, or give a control the field's
 * own name when nobody wrote one. What this refuses is a control with a role and no name.
 */

const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

/** Every kind, with the option list the ones that need it require and no label anywhere. */
const KINDS = [
  "text", "email", "password", "textarea", "number", "slider", "checkbox", "toggle",
  "select", "multiselect", "radio", "segmented", "datepicker", "daterange", "timepicker",
  "file", "colors",
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("a field declared with a label names its control", async ({ page }) => {
  // The control. Without it every failure below would also be true of a renderer that names nothing.
  const named = await page.evaluate(async () => {
    window.battle.mountFields("named", [{ name: "f", kind: "text", label: "Given name" }] as never);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const host = document.querySelector('[data-form="named"]') as HTMLElement;
    const input = host.querySelector("input") as HTMLInputElement;
    const label = host.querySelector(`label[for="${input.id}"]`) as HTMLElement | null;
    return { aria: input.getAttribute("aria-label"), labelText: (label?.innerText ?? "").trim() };
  });
  expect(named.aria === "Given name" || named.labelText === "Given name", JSON.stringify(named)).toBe(true);
});

test("every control has a name even when the document declared none", async ({ page }) => {
  const unnamed: Array<Record<string, unknown>> = [];

  for (const kind of KINDS) {
    const id = `noname-${kind}`;
    await page.evaluate(
      ({ mountId, k }) => window.battle.mountFields(mountId, [{ name: "f", kind: k, options: [{ value: "a", label: "A" }] }] as never),
      { mountId: id, k: kind },
    );
    await page.waitForTimeout(140);

    const seen = await page.evaluate((mountId) => {
      const host = document.querySelector(`[data-form="${mountId}"]`) as HTMLElement;
      if (host === null) return { missing: true, unnamed: ["the field did not mount"] };

      /** The accessible name of one element, as far as this check can compute it. */
      const nameOf = (element: Element): string => {
        const aria = element.getAttribute("aria-label");
        if (aria !== null && aria.trim() !== "") return aria.trim();
        const by = element.getAttribute("aria-labelledby");
        if (by !== null) {
          const text = by
            .split(/\s+/)
            .map((ref) => (document.getElementById(ref)?.innerText ?? "").trim())
            .join(" ")
            .trim();
          if (text !== "") return text;
        }
        const id = (element as HTMLElement).id;
        if (id !== "") {
          const label = host.querySelector(`label[for="${CSS.escape(id)}"]`) as HTMLElement | null;
          const text = (label?.innerText ?? "").trim();
          if (text !== "") return text;
        }
        const wrapping = element.closest("label") as HTMLElement | null;
        return (wrapping?.innerText ?? "").trim();
      };

      // The parts that carry a name: the roles the widgets contract lists as requiring one, and the
      // native controls a person actually operates.
      const parts = [
        ...host.querySelectorAll('[role="listbox"],[role="dialog"],[role="grid"],[role="combobox"],[role="radiogroup"]'),
        ...host.querySelectorAll("input,textarea,select"),
      ];
      const missing = parts
        .filter((part) => nameOf(part) === "")
        .map((part) => `${part.tagName.toLowerCase()}${part.getAttribute("role") ? `[role=${part.getAttribute("role")}]` : ""}`);
      return { missing: [...new Set(missing)], parts: parts.length };
    }, id);

    if ((seen.missing as string[]).length > 0) unnamed.push({ kind, ...seen });
  }

  expect(unnamed, JSON.stringify(unnamed, null, 1)).toEqual([]);
});

test("the auditor does not see all of it, which is why this check is written by hand", async ({ page }) => {
  // Not an assertion about Modyra: an assertion about the tool, so that "axe is green" is never read
  // as "every control has a name". If axe ever does catch these, this test says so by failing.
  await page.addScriptTag({ content: AXE });
  const seen: Record<string, string[]> = {};

  for (const [what, field] of [
    ["text", { name: "f", kind: "text" }],
    ["daterange", { name: "f", kind: "daterange" }],
    ["select", { name: "f", kind: "select", options: [{ value: "a", label: "A" }] }],
    ["checkbox", { name: "f", kind: "checkbox" }],
  ] as Array<[string, Record<string, unknown>]>) {
    const id = `axe-${what}`;
    await page.evaluate(({ mountId, f }) => window.battle.mountFields(mountId, [f] as never), { mountId: id, f: field });
    await page.waitForTimeout(150);
    seen[what] = await page.evaluate(async (mountId) => {
      const axe = (window as never as {
        axe: { run: (context: unknown, options: unknown) => Promise<{ violations: Array<Record<string, unknown>> }> };
      }).axe;
      const result = await axe.run(document.querySelector(`[data-form="${mountId}"]`), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      });
      return result.violations.map((violation) => String(violation.id));
    }, id);
  }

  // What it does catch, so this test fails if axe stops working rather than silently proving nothing.
  expect(seen.text.length + seen.select.length + seen.checkbox.length, JSON.stringify(seen))
    .toBeGreaterThan(2);

  // And what it does not. `role="grid"` with no accessible name is the case the widgets contract
  // names explicitly and the auditor is silent about — so "axe is green" must never be read as
  // "every control has a name".
  expect(seen.daterange, JSON.stringify(seen)).toEqual([]);
});
