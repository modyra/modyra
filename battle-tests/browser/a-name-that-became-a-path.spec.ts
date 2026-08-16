/**
 * A field called `a.b`, and a payload with an object in it.
 *
 * A dot is this library's path separator: `rows.r.c` is a cell inside a row inside a collection. So a
 * field *named* `a.b` is a name that reads as a path, and the contract's answer is that it is not a
 * name — `parseDynamicFields` drops it, and one renderer draws nothing for it.
 *
 * Both renderers build the path anyway. One draws a control for it and the other draws nothing, and
 * either way the model holds `{ a: { b: … } }` — a group the consumer never declared — and that shape
 * is what leaves the form.
 *
 * The renderer that draws nothing is the worse of the two: the value is in the payload with no control
 * on the page that could have put it there, and nothing a user did explains it.
 *
 * So the parser calls the name unusable and the engine behind both renderers treats it as a path.
 *
 * What is asserted allows either correct answer: **the mount is refused, or what is submitted carries
 * the names that were declared.** Dropping the field, refusing the list, and rendering it under its
 * literal name all pass; nesting it does not.
 *
 * Claims under attack: SUB-001, SEC-001.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
] as const;

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): { mounted: boolean; message?: string };
  submit(id: string): unknown;
  submittedBy(id: string): Array<Record<string, unknown>>;
  valueOf(id: string): Record<string, unknown>;
}>;

for (const host of HOSTS) {
  test(`a name that became a path, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mounted = await page.evaluate(({ api }) =>
      (window as never as Api)[api].mountFields("d", [
        { name: "a.b", kind: "text", label: "Dotted" },
        { name: "plain", kind: "text", label: "Plain" },
      ]), { api: host.api });
    await page.waitForTimeout(300);

    // Refusing the list is one of the ways to be right.
    if (mounted.mounted === false) {
      expect(mounted.message, "the mount was refused without saying what was wrong").toMatch(/name|path/i);
      return;
    }

    const boxes = page.locator('[data-form="d"] input');
    const drawn = await boxes.count();

    // The control: the well-named field is there, so a form that rendered nothing at all would not
    // pass the assertion below for the wrong reason.
    expect(drawn, "no controls were drawn, so nothing below is a measurement").toBeGreaterThan(0);

    if (drawn > 1) {
      await boxes.first().fill("typed into the dotted one");
      await page.waitForTimeout(260);
    }

    await page.evaluate(({ api }) => (window as never as Api)[api].submit("d"), { api: host.api });
    await page.waitForTimeout(300);

    const sent = await page.evaluate(({ api }) => (window as never as Api)[api].submittedBy("d").at(-1) ?? {}, { api: host.api });

    expect(
      Object.keys(sent).sort(),
      `the form sent ${JSON.stringify(sent)}: a field named "a.b" became a group called "a" that nothing declared`,
    ).not.toContain("a");
  });
}
