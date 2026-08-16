/**
 * The box says the address is fine and the form says it is not, and the other way round.
 *
 * `kind: "email"` puts `type="email"` on the control, so the platform judges what is typed. The
 * document may also ask for `validators: { email: true }`, and then the library judges it too. The two
 * do not agree, in either direction, and a form can be in either state.
 *
 * With the kind alone, the platform is the only judge — and it refuses `ünicode@example.com` while
 * nothing in the form objects. With the validator added, the library refuses `a@b` while the platform
 * is satisfied.
 *
 * VAL-004 names the second one: a native constraint never promises less than the validators it came
 * from. A control that accepts what the form will reject has promised less.
 *
 * The first is the same disagreement pointing the other way, and it is worth as much: inside a native
 * `<form>` the browser blocks a submission the library never objected to, and there is no message
 * anywhere that explains it — the form thinks the value is fine.
 *
 * Every address here is **typed**, not set, because the platform sanitises what is typed into an
 * email box: setting `"a@b.c "` programmatically leaves a space the model keeps and the box has
 * already dropped, and three of this spec's first disagreements were that and not this.
 *
 * Claims under attack: VAL-004, DYN-001.
 */

import { expect, test } from "@playwright/test";

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  errorsOf(id: string, path: string): Array<{ message?: string }>;
  dispose(id: string): void;
}>;

/** What each judge says about one address, typed into a field configured one way. */
async function judged(page: import("@playwright/test").Page, validators: unknown, typed: string) {
  await page.evaluate(({ v }) => {
    (window as never as Api).battle.mountFields("e", [{
      name: "mail", kind: "email", label: "Mail",
      ...(v === undefined ? {} : { validators: v }),
    }]);
  }, { v: validators });
  await page.waitForTimeout(280);

  const box = page.locator('[data-form="e"] input').first();
  await box.fill("");
  await box.type(typed);
  await box.blur();
  await page.waitForTimeout(240);

  const seen = await page.evaluate(() => {
    const input = document.querySelector('[data-form="e"] input') as HTMLInputElement;
    return {
      shown: input.value,
      platform: input.checkValidity(),
      library: (window as never as Api).battle.errorsOf("e", "mail").length === 0,
    };
  });
  await page.evaluate(() => (window as never as Api).battle.dispose("e"));
  await page.waitForTimeout(60);
  return seen;
}

test("two judges of one address", async ({ page }) => {
  test.setTimeout(200_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  // The control: an ordinary address both judges accept, in both configurations. Without it, two
  // judges that refused everything would agree perfectly.
  for (const validators of [undefined, { email: true }]) {
    const ordinary = await judged(page, validators, "a@b.c");
    expect(
      [ordinary.platform, ordinary.library],
      "an ordinary address was refused, so nothing below is about the addresses that disagree",
    ).toEqual([true, true]);
  }

  // The direction VAL-004 names: the control accepts what the form rejects.
  const withValidator = await judged(page, { email: true }, "a@b");
  expect(
    [withValidator.platform, withValidator.library],
    `the control says "a@b" is fine and the form says ${JSON.stringify(withValidator)}: a user is invited to submit what will be refused`,
  ).toEqual([withValidator.library, withValidator.library]);

  // And the same disagreement the other way, with the kind alone.
  const kindOnly = await judged(page, undefined, "ünicode@example.com");
  expect(
    [kindOnly.platform, kindOnly.library],
    `the control refuses "ünicode@example.com" and the form has no objection to it: inside a native form the browser blocks a submission nothing explains`,
  ).toEqual([kindOnly.library, kindOnly.library]);
});
