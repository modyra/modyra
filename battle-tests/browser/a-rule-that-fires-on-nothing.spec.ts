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
 */

import { expect, test } from "@playwright/test";

type Api = Record<string, {
  mountDocument(id: string, envelope: unknown, options?: unknown): { mounted: boolean; diagnostics?: unknown[] };
  mountFields(id: string, fields: unknown[]): unknown;
  setValue(id: string, patch: unknown): void;
  submit(id: string): unknown;
  submittedBy(id: string): Array<Record<string, unknown>>;
  disable(id: string, path: string): void;
}>;

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
  await page.waitForTimeout(340);

  // The premise, in the page rather than in the parser: strict mode took this document.
  expect(mounted.mounted, "the document was refused, so there is no form to measure").toBe(true);

  const vatShows = () => page.evaluate(() => {
    const found = Array.from(document.querySelectorAll('[data-form="g"] input'))
      .find((each) => (each.id ?? "").includes("vatNumber"));
    return Boolean(found) && (Boolean((found as HTMLElement).offsetParent) || (found as HTMLElement).getClientRects().length > 0);
  });

  await page.evaluate(() => (window as never as Api).battle.setValue("g", { customerType: "business" }));
  await page.waitForTimeout(320);

  // The control: on the side of the condition the rule allows, the field is there. A field that
  // never rendered at all would fail here and the assertion below would be about nothing.
  expect(await vatShows(), "the field is not shown even when the rule's condition holds").toBe(true);

  await page.evaluate(() => (window as never as Api).battle.setValue("g", { customerType: "person" }));
  await page.waitForTimeout(320);

  // What the rule does is take the field out of play rather than off the screen — finding 159 is that
  // `visible` and `hidden` are indistinguishable from `enabled` and `disabled`. What this test holds
  // is the part with consequences: on the side of the condition the rule excludes, the field is not
  // operable and does not go to the server.
  const off = await page.evaluate(() => {
    const found = Array.from(document.querySelectorAll('[data-form="g"] input'))
      .find((each) => (each.id ?? "").includes("vatNumber")) as HTMLInputElement | undefined;
    return found === undefined ? null : { disabled: found.disabled, aria: found.getAttribute("aria-disabled") };
  });

  expect(
    off,
    "a document said to show this field only for a business and it is fully in play for a private customer",
  ).toEqual({ disabled: true, aria: "true" });
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
  await page.waitForTimeout(300);
  await page.evaluate((value) => (window as never as Api).battle.setValue("byHand", { customerType: "person", taxId: value }), secret);
  await page.waitForTimeout(280);
  await page.evaluate(() => (window as never as Api).battle.disable("byHand", "taxId"));
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as never as Api).battle.submit("byHand"));
  await page.waitForTimeout(400);

  const byHand = await page.evaluate(() => (window as never as Api).battle.submittedBy("byHand"));
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
  await page.waitForTimeout(340);
  expect(mounted.mounted, "the document was refused, so there is no form to measure").toBe(true);

  await page.evaluate((value) => (window as never as Api).battle.setValue("byDocument", { customerType: "person", taxId: value }), secret);
  await page.waitForTimeout(320);
  await page.evaluate(() => (window as never as Api).battle.submit("byDocument"));
  await page.waitForTimeout(400);

  const byDocument = await page.evaluate(() => (window as never as Api).battle.submittedBy("byDocument"));
  expect(
    JSON.stringify(byDocument.at(-1)),
    "a document disabled this field for this customer and the form sent its value anyway",
  ).not.toContain(secret);
});
