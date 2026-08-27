/**
 * Two forms on one page, and the second one reads out the first one's help text.
 *
 * A field's id is built from the field's **name** and nothing else — `n`, `n__label`,
 * `n__description`. A name is unique within a form, which is the only place a schema author is asked
 * to think about it. Put two forms built from that schema on one page and every id in the second is a
 * copy of one in the first.
 *
 * Ids are how ARIA points at things, and `getElementById` returns the *first* match in the document.
 * So the relation does not dangle, which would at least be silent — it resolves, to the wrong
 * element:
 *
 *     form two   aria-describedby="n__description"  →  form one's description
 *
 * A person filling in the second form, using a screen reader, is told the first form's hint for a
 * field they cannot see. Nothing looks wrong on screen and nothing throws, because the page is not
 * broken — it is answering a different question correctly.
 *
 * **It was never one renderer's defect**, though it was first reported against one alone, which reads
 * as a gap in that renderer's configuration. It was not: every renderer collided on every id. The
 * report stayed quiet about the others because their own config declares an id prefix, so the kit
 * scoped what the *page* did not — a configuration masking the defect it was meant to find.
 *
 * **And it was not silent where it could have been heard.** One renderer detected the collision and
 * printed the remedy exactly, which is the worse combination to diagnose: loud in the console and
 * wrong in the page, so somebody reading the warning believes the framework is handling it.
 *
 * Two forms of the same shape is not an exotic arrangement. It is a filter beside a form, a repeated
 * row, a comparison of two records, a dialog over a page.
 *
 * **What this asserts is the relation, not the id.** Counting duplicate ids would report the same
 * defect and would also report every harmless one; and a scheme could satisfy uniqueness while still
 * pointing somewhere useless. What has to hold is that a reference made inside a form lands inside
 * that form.
 *
 * Claims under attack: A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** Relations that name an element by id, rather than carrying their text inline. */
const POINTS_AT_AN_ID = ["aria-describedby", "aria-labelledby", "aria-controls", "aria-errormessage"];

for (const host of HOSTS) {
  test(`a reference made in one form lands in that form, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The same shape twice, which is what a schema reused on one page produces. The supporting text
    // differs so a reference landing in the wrong form is legible in the failure rather than inferred.
    for (const form of ["primo", "secondo"]) {
      await page.evaluate(({ api, form, hint }) => {
        (window as never as Api)[api].mountFields(form, [
          { name: "n", kind: "text", label: "Nome", supportingText: hint },
          { name: "q", kind: "number", label: "Quanti", supportingText: `${hint} — quantità` },
        ] as never);
      }, { api: host.api, form, hint: form === "primo" ? "aiuto del primo" : "aiuto del secondo" });
    }

    await page.locator('[data-form="secondo"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(400);

    const reading = await page.evaluate(({ attributes }) => {
      const strayed: string[] = [];
      let references = 0;
      for (const form of ["primo", "secondo"]) {
        const scope = document.querySelector(`[data-form="${form}"]`);
        if (scope === null) continue;
        for (const element of Array.from(scope.querySelectorAll("*"))) {
          for (const attribute of attributes) {
            const value = element.getAttribute(attribute);
            if (value === null || value.trim() === "") continue;
            for (const id of value.trim().split(/\s+/)) {
              references += 1;
              const target = document.getElementById(id);
              // A reference to nothing is a different defect and a different file's business.
              if (target === null) continue;
              const landed = (target.closest("[data-form]") as HTMLElement | null)?.dataset.form ?? null;
              if (landed === form) continue;
              const said = (target.textContent ?? "").trim().slice(0, 40);
              strayed.push(
                `${form}: ${element.tagName.toLowerCase()}[${attribute}="${id}"] resolves into `
                + `${landed === null ? "no form at all" : `form ${landed}`}, which says "${said}"`,
              );
            }
          }
        }
      }
      return { strayed: [...new Set(strayed)], references };
    }, { attributes: POINTS_AT_AN_ID });

    // The premise, and it caught a first version of this file that reported nothing: with the wrong
    // property name the fields carried no supporting text, no relation was emitted, and the loop
    // above examined an empty set while passing. A page that points at nothing cannot be checked for
    // pointing in the wrong place.
    expect(
      reading.references,
      `${host.name} emitted no id-carrying ARIA relation across two mounted forms, so this file has `
      + "examined nothing. Either the fields did not render or the relations are not being emitted; "
      + "both are worth knowing and neither is what this file is about.",
    ).toBeGreaterThan(2);

    expect(
      reading.strayed,
      `${reading.strayed.length} reference(s) made inside one form resolve inside another:\n`
      + `${reading.strayed.join("\n")}\n\n`
      + "Ids are built from the field's name, which is unique within a form and not within a page. "
      + "getElementById returns the first match in the document, so the relation does not dangle — it "
      + "lands on the wrong element and a screen reader reads out the other form's text.",
    ).toEqual([]);
  });
}
