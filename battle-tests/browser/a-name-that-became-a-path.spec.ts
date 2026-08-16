/**
 * A value in the payload with no control on the page that could have put it there.
 *
 * A dot in a field name **is** a path here, by construction: a flattened document names
 * `shipping.city`, and the trusted-list door reads it that way on purpose. So `{ a: { b: … } }` is not
 * an undeclared group — it is what `a.b` means, and building it is the engine doing its job.
 *
 * What the two renderers then do differs. One draws a control for the field. The other draws nothing
 * at all, and the value still leaves the form:
 *
 *     lit    no control on the page      submits { "plain": "", "a": { "b": "" } }
 *
 * That is the finding, and it is not about the dot. A form that submits a field it never rendered has
 * a value nobody could have entered, corrected or seen — and no repair to the name grammar would
 * touch it, because the name is legitimate.
 *
 * So what is asserted is the pairing rather than the shape: **every field a form submits has a control
 * on the page.** Rendering it under any shape passes; refusing the list passes; submitting a field
 * with nothing drawn for it does not.
 *
 * Claims under attack: SUB-001, A11Y-001.
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

    // One control per field the form will send. The dotted field is one of two, so a page drawing
    // both is right whatever shape the payload takes.
    const leaves = (value: unknown, prefix = ""): string[] =>
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) => leaves(inner, prefix ? `${prefix}.${key}` : key))
        : [prefix];
    const sentPaths = leaves(sent).sort();

    expect(
      drawn,
      `the form sent ${JSON.stringify(sentPaths)} and drew ${drawn} control(s): a value leaves the page that nothing on it could have entered`,
    ).toBe(sentPaths.length);
  });
}
