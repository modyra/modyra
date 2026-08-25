/**
 * A form doing what its document said it would.
 *
 * `adversarial/dynamic-contract/a-rule-that-fires-on-nothing.battle.test.mjs` is the premise: the
 * parser reads a rule as behaviour — refusing an undeclared effect, an undeclared operator, a target
 * that is not a field, a condition on a field that is not there — and accepts a well-formed one in
 * strict mode, whose promise is that a partly valid document is never accepted.
 *
 * This is what the accepted document then does, and it is a regression test rather than an attack:
 * finding 156 was that nothing applied a rule at all, and `applyDynamicRules` closed it. The form is
 * built the way the guide says to build one — parse, then mount what the parse returned — and the
 * mount is handed `rules` along with `fields` and `layout`, which is the line the guide's own snippet
 * did not have and this host did not have either.
 *
 * The second test is where it stops being a rendering question. `disabled` is one of the four
 * effects, and a disabled field's value is excluded from what a form sends — that is a promise of
 * its own, and the same test proves it still works by disabling the same field the other way. So a
 * document saying "disable the tax id for a private customer" produces a form that sends the tax id
 * for a private customer, and the difference between the two paths is which one the document was
 * allowed to ask for.
 *
 * Claims under attack: DYN-004, DYN-001.
 */

import { expect, test } from "@playwright/test";
import { SETTLES, whatLanded } from "./bench";

type Api = Record<string, {
  mountDocument(id: string, envelope: unknown, options?: unknown): { mounted: boolean; diagnostics?: unknown[] };
  mountFields(id: string, fields: unknown[]): unknown;
  setValue(id: string, patch: unknown): void;
  submit(id: string): unknown;
  submittedBy(id: string): Array<Record<string, unknown>>;
  disable(id: string, path: string): void;
}>;

/** A field's own control, found the way this host names one: the field's name inside the id. */
function control(page: import("@playwright/test").Page, form: string, name: string) {
  return page.evaluate(({ formId, fieldName }) => {
    const found = Array.from(document.querySelectorAll(`[data-form="${formId}"] input`))
      .find((each) => (each.id ?? "").includes(fieldName)) as HTMLInputElement | undefined;
    return found === undefined
      ? null
      : { value: found.value, disabled: found.disabled, aria: found.getAttribute("aria-disabled") };
  }, { formId: form, fieldName: name });
}

const FIELDS = [
  {
    name: "customerType",
    kind: "select",
    label: "Type",
    options: [{ value: "person", label: "Person" }, { value: "business", label: "Business" }],
  },
  { name: "vatNumber", kind: "text", label: "VAT number" },
];

test("a field a document says to show only sometimes is out of play when it should be", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  // The guide's own worked example, verbatim in shape: show the VAT number for a business.
  const mounted = await page.evaluate((fields) =>
    (window as never as Api).battle.mountDocument("g", {
      version: 2,
      id: "invoice",
      fields,
      layout: [{ kind: "section", id: "identity", children: ["customerType", "vatNumber"] }],
      rules: [{
        effect: "visible",
        target: "vatNumber",
        when: { field: "customerType", operator: "equals", value: "business" },
      }],
    }), FIELDS);

  // The premise, in the page rather than in the parser: strict mode took this document.
  expect(mounted.mounted, "the document was refused, so there is no form to measure").toBe(true);

  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll('[data-form="g"] [id*="customerType"]').length), {
      message: "the document mounted and drew no control to set a value into",
      ...SETTLES,
    })
    .toBeGreaterThan(0);

  const vatShows = () => page.evaluate(() => {
    const found = Array.from(document.querySelectorAll('[data-form="g"] input'))
      .find((each) => (each.id ?? "").includes("vatNumber"));
    return Boolean(found) && (Boolean((found as HTMLElement).offsetParent) || (found as HTMLElement).getClientRects().length > 0);
  });

  await page.evaluate(() => (window as never as Api).battle.setValue("g", { customerType: "business" }));

  // The control: on the side of the condition the rule allows, the field is there. A field that
  // never rendered at all would fail here and the assertion below would be about nothing.
  await expect
    .poll(vatShows, { message: "the field is not shown even when the rule's condition holds", ...SETTLES })
    .toBe(true);

  await page.evaluate(() => (window as never as Api).battle.setValue("g", { customerType: "person" }));

  // What the rule does is take the field out of play rather than off the screen — finding 159 is that
  // `visible` and `hidden` are indistinguishable from `enabled` and `disabled`. What this test holds
  // is the part with consequences: on the side of the condition the rule excludes, the field is not
  // operable and does not go to the server.
  await expect
    .poll(async () => {
      const found = await control(page, "g", "vatNumber");
      return found === null ? null : { disabled: found.disabled, aria: found.aria };
    }, {
      message: "a document said to show this field only for a business and it is fully in play for a private customer",
      ...SETTLES,
    })
    .toEqual({ disabled: true, aria: "true" });
});

test("what a field a document disabled still sends", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  const secret = "SSN-123-45-6789";

  // The control first, through the path that is not a document: the same kind of field, disabled by
  // the form's own handle, is left out of what is sent.
  await page.evaluate(() => {
    (window as never as Api).battle.mountFields("byHand", [
      { name: "customerType", kind: "text", label: "Type" },
      { name: "taxId", kind: "text", label: "Tax id" },
    ]);
  });
  await expect
    .poll(() => control(page, "byHand", "taxId"), { message: "the fields mounted and no tax id was drawn", ...SETTLES })
    .not.toBeNull();

  await page.evaluate((value) => (window as never as Api).battle.setValue("byHand", { customerType: "person", taxId: value }), secret);
  await expect
    .poll(async () => (await control(page, "byHand", "taxId"))?.value, {
      message: "the value never reached the field, so disabling it proves nothing",
      ...SETTLES,
    })
    .toBe(secret);

  await page.evaluate(() => (window as never as Api).battle.disable("byHand", "taxId"));
  await expect
    .poll(async () => (await control(page, "byHand", "taxId"))?.disabled, {
      message: "the handle was asked to disable this field and it stayed in play",
      ...SETTLES,
    })
    .toBe(true);

  await page.evaluate(() => (window as never as Api).battle.submit("byHand"));
  const byHand = await whatLanded(page, "byHand");
  expect(
    JSON.stringify(byHand.at(-1)),
    "a field disabled through the handle was sent, so nothing below is a measurement of the document",
  ).not.toContain(secret);

  // And the same field, disabled by the document instead.
  const mounted = await page.evaluate(() =>
    (window as never as Api).battle.mountDocument("byDocument", {
      version: 2,
      id: "invoice",
      fields: [
        { name: "customerType", kind: "text", label: "Type" },
        { name: "taxId", kind: "text", label: "Tax id" },
      ],
      rules: [{
        effect: "disabled",
        target: "taxId",
        when: { field: "customerType", operator: "equals", value: "person" },
      }],
    }));
  expect(mounted.mounted, "the document was refused, so there is no form to measure").toBe(true);

  await page.evaluate((value) => (window as never as Api).battle.setValue("byDocument", { customerType: "person", taxId: value }), secret);
  await expect
    .poll(async () => (await control(page, "byDocument", "taxId"))?.value, {
      message: "the value never reached the field, so what the form sends is not a measurement of the rule",
      ...SETTLES,
    })
    .toBe(secret);

  await page.evaluate(() => (window as never as Api).battle.submit("byDocument"));
  const byDocument = await whatLanded(page, "byDocument");
  expect(
    JSON.stringify(byDocument.at(-1)),
    "a document disabled this field for this customer and the form sent its value anyway",
  ).not.toContain(secret);
});
