/**
 * The submission that did not fail — it broke.
 *
 * A handler can answer with errors, and that path is well travelled. It can also **throw**: the
 * network went, the token expired mid-flight, a library the application calls has a bad day. Nothing
 * on either side of the form chose that, and it is the path where a page gets stuck.
 *
 * Three things have to hold, and the third is the one people lose. The form must not be left
 * *submitting* — a button that never comes back is a form nobody can send, and the user's only move
 * is to reload and retype. The page must say something, because a submission that silently does
 * nothing is indistinguishable from one that worked. And a retry must be possible, which is the whole
 * point of saying so.
 *
 * A throw is also not a page error. An unhandled rejection escaping the form takes out whatever else
 * the application had running.
 *
 * Claims under attack: API-001.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

for (const host of HOSTS) {
  test(`a submission that fell over leaves a form somebody can use, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    const escaped: string[] = [];
    page.on("pageerror", (error) => escaped.push(String(error.message).slice(0, 120)));

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("x", [{ name: "who", kind: "text", label: "Who", initialValue: "lorenzo" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    const sent = () => page.evaluate(({ api }) =>
      (window as never as Record<string, { submittedBy(i: string): unknown[] }>)[api].submittedBy("x").length,
      { api: host.api });
    const shown = () => page.evaluate(() =>
      (document.querySelector('[data-form="x"]')?.textContent ?? "").replace(/\s+/g, " ").trim());

    const before = await shown();

    // The handler throws rather than answering.
    const settled = await page.evaluate(async ({ api }) => {
      try {
        await (window as never as Record<string, { submitAnswering(i: string, a: unknown): Promise<void> }>)[api]
          .submitAnswering("x", { __throw: "the network fell over" });
        return "resolved";
      } catch {
        return "rejected";
      }
    }, { api: host.api });
    await page.waitForTimeout(420);

    // The premise: the handler did run. Otherwise everything below is about a submission that never
    // happened.
    expect(await sent(), "the handler never ran, so nothing threw").toBe(1);

    expect(settled, "the failure escaped the form as a rejection for the caller to catch").toBe("resolved");
    expect(escaped, "the failure escaped as a page error, taking whatever else was running with it").toEqual([]);

    const after = await shown();
    expect(after !== before, "the page did not change, so a submission that broke looks like one that worked").toBe(true);
    expect(after, "the page does not say what went wrong").toContain("the network fell over");

    // And the form is usable again — which is what saying so was for.
    await page.evaluate(({ api }) =>
      (window as never as Record<string, { submit(i: string): Promise<number> }>)[api].submit("x"),
      { api: host.api });
    await page.waitForTimeout(400);

    expect(await sent(), "the form could not be submitted again after a failure").toBe(2);
    expect(await shown(), "the message from the last failure is still on the page after a fresh submission")
      .not.toContain("the network fell over");
  });
}
