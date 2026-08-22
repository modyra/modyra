/**
 * Three renderers agree about which parts carry an id.
 *
 * An id is not decoration. It is the anchor an `aria-controls`, an `aria-labelledby` or an
 * `aria-activedescendant` points at, it is what a consumer's stylesheet can select, and it is what
 * their own `aria-describedby` can name. So a part that carries an id in one renderer and not in
 * another is a contract answered three ways: an attribute that resolves on one and dangles or is
 * absent on the others, and a hook a consumer can use in one adapter and cannot in the rest.
 *
 * It came up as a side question — *what would renaming a part break?* — and the answer was *one
 * renderer of three, because the other two never published the id*. That is a defect on its own and it
 * is invisible to every spec that measures one renderer.
 *
 * **The comparison is between renderers, not against a list.** Nothing here says which parts ought to
 * have ids: that is the contract's business, and a spec that named them would be deciding it. What it
 * says is that the three must answer the same way, which is what `@modyra/widgets` being *the* UI
 * contract means.
 *
 * Open and closed are both measured, because a popup's insides do not exist at rest — which is where
 * a missing id hides best.
 *
 * Claims under attack: UI-011, A11Y-001.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const KINDS = ["select", "multiselect", "datepicker", "timepicker"] as const;

/** Which classed parts carry an id, as a set of `class → true` this renderer publishes. */
async function idsByPart(page: import("@playwright/test").Page, root: string) {
  return page.evaluate((sel) => {
    const field = document.querySelector(sel);
    if (field === null) return null;
    // The popup is portalled out of the field in some renderers, so the sweep is the document minus
    // anything belonging to another field.
    const scope = Array.from(document.querySelectorAll('[class*="mdy-"]'))
      .filter((element) => field.contains(element) || element.closest("[data-form]") === null);
    const carries: Record<string, boolean> = {};
    for (const element of scope) {
      for (const name of element.className.toString().split(/\s+/)) {
        if (!name.startsWith("mdy-") || name.includes("--")) continue;
        carries[name] = carries[name] === true || element.id !== "";
      }
    }
    return carries;
  }, root);
}

for (const kind of KINDS) {
  test(`the three renderers agree which parts of a ${kind} carry an id`, async ({ browser }) => {
    test.setTimeout(240_000);
    const seen: Record<string, Record<string, boolean>> = {};

    for (const host of HOSTS) {
      const page = await browser.newPage();
      try {
        await page.goto(host.page);
        await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
        await page.evaluate(({ api, kind, options }) => {
          const field: Record<string, unknown> = { name: "f", kind, label: "L" };
          if (kind === "select" || kind === "multiselect") field.options = options;
          (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
            .mountFields("ids", [field] as never);
        }, { api: host.api, kind, options: OPTIONS });
        await page.waitForTimeout(400);
        // Open it: a popup's insides are where a missing id hides, because they do not exist at rest.
        await page.locator('[data-form="ids"] button, [data-form="ids"] [aria-haspopup]')
          .first().click({ timeout: 4_000 }).catch(() => undefined);
        await page.waitForTimeout(350);
        const read = await idsByPart(page, '[data-form="ids"]');
        expect(read, `${host.name} mounted no ${kind}`).not.toBeNull();
        seen[host.name] = read!;
      } finally {
        await page.close();
      }
    }

    // Only parts every renderer drew are compared. A part one of them does not build at all is a
    // different defect, and `a-part-the-contract-requires.spec.ts` is the file that owns it.
    const everywhere = Object.keys(seen.plain!)
      .filter((part) => part in seen.lit! && part in seen.angular!);
    expect(
      everywhere.length,
      `the three renderers share no parts for a ${kind}, so nothing here is being compared`,
    ).toBeGreaterThan(3);

    const disagreed = everywhere
      .filter((part) => new Set(HOSTS.map((host) => seen[host.name]![part])).size > 1)
      .map((part) => `${part}: ${HOSTS.map((host) => `${host.name}=${seen[host.name]![part] ? "id" : "none"}`).join(" ")}`);

    expect(
      disagreed,
      `a part carries an id in one renderer of a ${kind} and not in another. An id is what an ` +
        `\`aria-controls\` points at and what a consumer's stylesheet selects, so this is one contract ` +
        `answered three ways — and the attribute that resolves on one dangles or is absent on the ` +
        `others:\n  ${disagreed.join("\n  ")}`,
    ).toEqual([]);
  });
}
