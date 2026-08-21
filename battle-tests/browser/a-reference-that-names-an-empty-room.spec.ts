/**
 * A field does not point a screen reader at an element with nothing in it.
 *
 * Every field draws a slot for supporting text and names it with `aria-describedby`. Nothing could put
 * words in that slot — no field type carries the property, and the widgets projection has no text in
 * it — so a reader following the reference arrived somewhere empty.
 *
 * **That is worse than having no reference at all.** A description that says nothing still costs the
 * person the move: they are told there is more to hear, they go and hear silence, and they learn that
 * this control's descriptions are not worth following.
 *
 * The two halves are asserted separately on purpose, because only one of them needs a new capability:
 *
 *   - **a field with no supporting text has no dangling reference.** Testable today, in every
 *     renderer, and it is the half that is broken. One renderer already does it correctly by omitting
 *     both the element and the reference, which is the pair — hiding the element while keeping the
 *     reference is one step worse than the empty description, because the id then names nothing at
 *     all.
 *   - **a field that declares supporting text says those words.** Guarded by a premise: if the
 *     library does not yet accept the declaration, this says so in those terms rather than failing as
 *     though the renderer dropped it. A property no field type carries is not a renderer defect, and
 *     an earlier probe of mine reported it as one in all three at once.
 *
 * Claims under attack: A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

for (const host of HOSTS) {
  const mount = async (page: import("@playwright/test").Page, id: string, field: Record<string, unknown>) => {
    await page.evaluate(({ api, id, field }) => {
      (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
        .mountFields(id, [field] as never);
    }, { api: host.api, id, field });
    await page.waitForTimeout(400);
  };

  /** What every `aria-describedby` on this field actually leads to. */
  const described = (page: import("@playwright/test").Page, root: string) =>
    page.evaluate((sel) => {
      const field = document.querySelector(sel);
      if (field === null) return null;
      return Array.from(field.querySelectorAll("[aria-describedby]")).flatMap((source) =>
        (source.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map((id) => {
          const target = document.getElementById(id);
          return {
            id,
            from: (source.className || source.tagName).toString().split(" ")[0],
            exists: target !== null,
            words: target === null ? null : (target.textContent ?? "").trim(),
          };
        }));
    }, root);

  test(`a field with nothing to add points nowhere, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount(page, "bare", { name: "t", kind: "text", label: "Nome" });

    const links = await described(page, '[data-form="bare"]');
    expect(links, "nothing was mounted").not.toBeNull();

    const empty = links!.filter((link) => !link.exists || link.words === "");
    expect(
      empty.map((link) => `${link.from} → ${link.id}${link.exists ? " (empty)" : " (missing)"}`),
      `this field names ${empty.length} description${empty.length === 1 ? "" : "s"} with nothing in ` +
        `${empty.length === 1 ? "it" : "them"}. A reader is told there is more to hear, goes, and hears ` +
        `silence — which costs them the move and teaches them not to follow the next one`,
    ).toEqual([]);
  });

  test(`a field that declares supporting text says it, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount(page, "helped", { name: "t", kind: "text", label: "Nome", supportingText: "Serve un aiuto qui" });

    const links = await described(page, '[data-form="helped"]');
    expect(links, "nothing was mounted").not.toBeNull();

    const slot = await page.evaluate(() =>
      document.querySelector('[data-form="helped"] .mdy-supporting-text') !== null);

    // The premise, stated as its own sentence: a property the library does not carry is not a renderer
    // dropping it, and a probe that could not tell the two apart reported this as broken in all three
    // renderers at once — which is nearly always the instrument rather than the code.
    expect(
      slot,
      "no renderer draws a supporting-text slot at all, so this is a question about the shell rather " +
        "than about the words",
    ).toBe(true);

    expect(
      links!.some((link) => link.words === "Serve un aiuto qui"),
      `the field declared supporting text and no description carries it — the descriptions it does ` +
        `name are ${JSON.stringify(links!.map((link) => link.words))}. The slot is drawn and named; ` +
        `what is missing is the route from a declaration to the words in it`,
    ).toBe(true);
  });
}
