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
  const mount = async (page: import("@playwright/test").Page, id: string, fields: unknown[], scope?: string) => {
    await page.evaluate(({ api, id, fields, scope }) => {
      const mountFields = (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api].mountFields;
      // **An unscoped mount passes nothing, not `null`.** Handing `{ idPrefix: null }` is a scope of
      // its own kind and changed plain's ids — a mount option invented by the fixture, which read as
      // the renderer losing its stability.
      if (scope === null) mountFields(id, fields as never);
      else mountFields(id, fields as never, { idPrefix: scope } as never);
    }, { api: host.api, id, fields, scope: scope ?? null });
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

  /**
   * Two **scoped** forms do not collide — and an unscoped pair is not silent about it.
   *
   * The first version of this asked for two forms mounted from one document to get distinct ids
   * without a consumer supplying anything. That cannot be had, and
   * [ADR 0135](../../docs/architecture/0135-an-id-is-a-function-of-the-document.md) now carries the
   * contradiction: an id that depends only on the document gives two live copies one id, and an id
   * that tells the copies apart depends on the instance. Nothing distinguishes two mounts of one
   * document except the host or the order they were created in, and the second is the counter that
   * record removed.
   *
   * So the promise is the scoped one, and it is asserted here. What is **not** a defect is a page
   * whose author gave one identity to two things; what **is** one is that nothing says so — two forms
   * sharing a scope produce no warning today, so a page whose `aria-describedby` resolves into the
   * wrong form looks exactly like a page whose references are right.
   */
  test(`two scoped forms on one page do not render one id twice, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await mount(page, "left", FIELDS, "left");
    await mount(page, "right", FIELDS, "right");

    const left = await idsIn(page, "left");
    const right = await idsIn(page, "right");
    expect(left, "nothing was mounted").not.toBeNull();
    expect(left!.length, `${host.name} published no ids`).toBeGreaterThan(2);

    // The premise: the two really were given different scopes. If a renderer ignores the option, this
    // assertion would be measuring the unscoped case under the scoped case's name.
    expect(
      left!.some((id) => right!.includes(id)) === false || left![0] !== right![0],
      "the two forms were given different scopes and rendered identical first ids, so the scope was not applied at all",
    ).toBe(true);

    const shared = left!.filter((id) => right!.includes(id));
    expect(
      shared.slice(0, 4),
      `${shared.length} ids appear in both forms although the two were given different scopes — every ` +
        `reference to one of them is ambiguous, and a stylesheet naming it hits both`,
    ).toEqual([]);
  });

  test(`one scope for two forms is not silent, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") warnings.push(message.text());
    });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The same declaration twice with nothing to tell them apart: one identity, two things. The
    // consumer did this, and it is theirs to fix — with one attribute, if anybody tells them.
    await mount(page, "twinA", FIELDS);
    await mount(page, "twinB", FIELDS);

    const a = await idsIn(page, "twinA");
    const b = await idsIn(page, "twinB");
    expect(a, "nothing was mounted").not.toBeNull();

    // The premise: they really did collide. If a renderer disambiguated them, there is nothing to warn
    // about and this case is measuring the wrong page.
    const shared = a!.filter((id) => b!.includes(id));
    expect(
      shared.length,
      "the two unscoped forms rendered no id in common, so nothing collided and there is nothing to say",
    ).toBeGreaterThan(0);

    expect(
      warnings.filter((text) => /id|scope/i.test(text)),
      `${shared.length} ids are claimed by both forms and nothing said so. A page whose ` +
        `\`aria-describedby\` resolves into the other form looks exactly like a page whose references ` +
        `are right — and the person who could fix it with one attribute is the one nobody tells`,
    ).not.toEqual([]);
  });
}
