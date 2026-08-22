/**
 * The same document renders the same ids, whatever else is on the page.
 *
 * An id is the only part of a widget a consumer can name from outside: in their own
 * `aria-describedby`, in a stylesheet, in a test. That requires it to be a function of the document
 * they wrote — and in two renderers of three it was a function of **mount order**, because the widget
 * id was a counter. The same field declaration mounted second and then alone got
 * `mdy-field-1__label` and `mdy-field-2__label`.
 *
 * [ADR 0135](../../docs/architecture/0135-an-id-is-a-function-of-the-document.md) settles it: a widget
 * bound to a field derives its id from that field's path within its form's id scope.
 *
 * **Two cases, and the second exists because the first can be satisfied while the rule is broken.**
 * A renderer that derived from the path and dropped the scope would pass *the same document renders
 * the same ids* — two documents each render the same ids as themselves. The record says so and this
 * file is why: the scope needs a case of its own, and it is the one a plausible implementation fails.
 *
 * What it does **not** assert is what the id contains. The path, a hash of the path and a
 * consumer-supplied value all satisfy both sentences, and naming one would decide a contract from a
 * test file.
 *
 * Claims under attack: UI-011, A11Y-001.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

/** Every id inside a mounted form, in document order. */
const idsIn = (page: import("@playwright/test").Page, form: string) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (root === null) return null;
    return Array.from(root.querySelectorAll("[id]")).map((element) => element.id);
  }, `[data-form="${form}"]`);

const FIELDS = [{ name: "when", kind: "datepicker", label: "D" }];

for (const host of HOSTS) {
  const mount = async (page: import("@playwright/test").Page, id: string, fields: unknown[]) => {
    await page.evaluate(({ api, id, fields }) => {
      (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
        .mountFields(id, fields as never);
    }, { api: host.api, id, fields });
    await page.waitForTimeout(400);
  };

  test(`the same declaration renders the same ids whatever came first, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // Something else first, then the declaration under test — the ordinary page.
    await mount(page, "other", [{ name: "unrelated", kind: "text", label: "T" }]);
    await mount(page, "after", FIELDS);
    const afterSomething = await idsIn(page, "after");

    // The same declaration again, with more in front of it.
    await mount(page, "more", [{ name: "another", kind: "text", label: "T" }]);
    await mount(page, "later", FIELDS);
    const afterMore = await idsIn(page, "later");

    expect(afterSomething, "nothing was mounted").not.toBeNull();
    // The premise: this control publishes ids at all. A renderer that published none would compare
    // two empty lists and pass while saying nothing.
    expect(afterSomething!.length, `${host.name} published no ids for a datepicker`).toBeGreaterThan(2);

    expect(
      afterMore,
      `the same declaration rendered ${JSON.stringify(afterMore?.slice(0, 2))} where it rendered ` +
        `${JSON.stringify(afterSomething!.slice(0, 2))} a moment earlier — the id depends on what was ` +
        `mounted first, so a consumer cannot name it in advance and a server render and a client mount ` +
        `disagree the moment their order does`,
    ).toEqual(afterSomething);
  });

  test(`two forms on one page do not render one id twice, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The same field name in two forms — ordinary, and nobody has made a mistake.
    await mount(page, "left", FIELDS);
    await mount(page, "right", FIELDS);

    const left = await idsIn(page, "left");
    const right = await idsIn(page, "right");
    expect(left, "nothing was mounted").not.toBeNull();
    expect(left!.length, `${host.name} published no ids`).toBeGreaterThan(2);

    const shared = left!.filter((id) => right!.includes(id));
    expect(
      shared.slice(0, 4),
      `${shared.length} ids appear in both forms — the same field name in two forms produced the same ` +
        `id, so every reference to it is ambiguous and a stylesheet naming it hits both. This is the ` +
        `case a renderer passes by deriving from the path and dropping the scope, which is why it is ` +
        `asked separately from whether ids are stable`,
    ).toEqual([]);

    // And the ids really are collisions rather than the whole document being empty of them.
    const duplicated = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("[id]")).map((element) => element.id);
      return all.filter((id, at) => all.indexOf(id) !== at);
    });
    expect(
      duplicated.slice(0, 4),
      `the page carries ${duplicated.length} duplicated ids, which makes every \`aria-*\` naming one of ` +
        `them resolve to whichever the browser reached first`,
    ).toEqual([]);
  });
}
