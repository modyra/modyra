/**
 * What a server said, and whether the page passes it on.
 *
 * A submit handler may answer with errors, and each carries a path: a field's name, or `null` for
 * something about the whole form. That is the one channel a server has to explain a refusal — "that
 * name is already taken", "this card was declined" — and it is the only one that can point at the
 * field to fix.
 *
 * The engine records them either way. Whether anybody reads them out is the renderer's part, and
 * that is what this asks: after a refusal naming a field, does the page say what the server said?
 *
 * The control is the same field made wrong by a validator instead. If a renderer shows one and not
 * the other, the difference is where the error came from — not a page that cannot show errors at
 * all, which is what makes this a finding rather than a repeat of one.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`a refusal about a field reaches that field, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const textOf = (id: string) => page.evaluate((sel) =>
      (document.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim(), `[data-form="${id}"]`);

    // The control: a validator's message on the same kind of field does reach the page.
    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("rule", [{ name: "who", kind: "text", label: "Who", validators: { minLength: 5 } }]);
    }, { api: host.api });
    await page.waitForTimeout(280);

    const control = page.locator('[data-form="rule"] input').first();
    await control.fill("ab");
    await control.blur();
    await page.waitForTimeout(320);

    expect(await textOf("rule"), "a validator's message does not reach the page either, so nothing below is about servers")
      .toContain("Minimum length");

    // And a refusal that came from the submit handler, naming the same field.
    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("server", [{ name: "who", kind: "text", label: "Who", initialValue: "lorenzo" }]);
    }, { api: host.api });
    await page.waitForTimeout(280);

    const before = await textOf("server");

    await page.evaluate(({ api }) =>
      (window as never as Record<string, { submitAnswering(i: string, a: unknown): Promise<void> }>)[api]
        .submitAnswering("server", [{ path: "who", message: "Already taken" }]),
      { api: host.api });
    await page.waitForTimeout(420);

    // The premise: the engine took the refusal. Without this, silence on the page could be a submit
    // that never happened.
    const recorded = await page.evaluate(({ api }) =>
      (window as never as Record<string, { lastSubmitErrorsOf(i: string): Array<{ path: string | null; message: string }> }>)[api]
        .lastSubmitErrorsOf("server"), { api: host.api });
    expect(recorded, "the engine did not record the refusal, so the page had nothing to show")
      .toEqual([{ path: "who", message: "Already taken" }]);

    const after = await textOf("server");
    expect(after !== before, "the page did not change at all after a server refused the submission").toBe(true);
    expect(after, "the page does not say what the server said, so the user is refused without a reason")
      .toContain("Already taken");
  });
}
