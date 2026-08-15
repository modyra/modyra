import { expect, test } from "@playwright/test";

/**
 * What a page shows when a server says no, in each of the shapes an application hands back.
 *
 * `onSubmit` returns field errors to reject. Its type says `MdyFormError[] | void`, and its argument
 * is whatever the application produces from a response — so the shapes below are not exotic. They are
 * what `await response.json()` gives you when the endpoint's envelope is not the one the type wanted,
 * and TypeScript does not stop any of them because the value crossing that boundary is `any`.
 *
 * Three of the four wrong shapes end differently, and two of the three end worse than the one already
 * on record:
 *
 *   [{ path, message: <the response object> }]   "[object Object]" beside the field
 *   ["Already registered"]                        nothing at all
 *   { errors: [...] }                             nothing at all
 *
 * `[object Object]` at least says something is wrong. A bare string and a non-list say nothing: the
 * control goes back to `aria-invalid="false"`, no message appears, and the person who pressed Submit
 * has every reason to believe it worked. The server refused and nobody was told.
 *
 * The correct shape is asserted first, so each failure is about the shape rather than about a page
 * that never renders a server's answer at all.
 */

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

/** Mount a one-field form whose submit answers with `errors`, fill it, submit, and read the page. */
async function submitAnswering(page: import("@playwright/test").Page, id: string, errors: unknown) {
  await page.evaluate(
    ({ mountId, answer }) =>
      window.battle.mountWithSubmit(mountId, [{ name: "email", kind: "text", label: "Email" }] as never, answer as never),
    { mountId: id, answer: errors },
  );
  await settled(page);
  await page.locator(`[data-form="${id}"] input`).fill("a@b.c");
  await page.locator(`[data-form="${id}"] button`).last().click();
  await page.waitForTimeout(250);

  return page.evaluate((selector) => {
    const host = document.querySelector(selector) as HTMLElement;
    const list = host.querySelector(".mdy-control__errors") as HTMLElement | null;
    return {
      errorText: (list?.innerText ?? "").trim(),
      invalid: host.querySelector("input")?.getAttribute("aria-invalid") ?? null,
    };
  }, `[data-form="${id}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("a server's refusal, in the shape the type asks for, reaches the person", async ({ page }) => {
  // The control for everything below.
  const shown = await submitAnswering(page, "ok", [{ path: "email", message: "Already registered" }]);
  expect(shown).toEqual({ errorText: "Already registered", invalid: "true" });
});

test("a refusal in a shape the type did not ask for still reaches the person", async ({ page }) => {
  const outcomes = [];

  // The response object handed back as the message — the shape already on record.
  outcomes.push({
    what: "the response object as the message",
    ...(await submitAnswering(page, "obj", [{ path: "email", message: { detail: "taken", code: 409 } }])),
  });

  // A bare string in the list, which is what an endpoint returning `["..."]` produces.
  outcomes.push({
    what: "a bare string in the list",
    ...(await submitAnswering(page, "str", ["Already registered"])),
  });

  // The whole envelope, unwrapped by nobody.
  outcomes.push({
    what: "the whole response, not a list",
    ...(await submitAnswering(page, "env", { errors: [{ path: "email", message: "taken" }] })),
  });

  // Every one of them refused the submission. A person who pressed Submit and was told nothing
  // believes it worked, which is worse than being told something unreadable.
  const silent = outcomes.filter((outcome) => outcome.errorText === "");
  expect(silent, JSON.stringify(outcomes, null, 1)).toEqual([]);

  // And what is said is something a person can read.
  const unreadable = outcomes.filter((outcome) => outcome.errorText.includes("[object"));
  expect(unreadable, JSON.stringify(outcomes, null, 1)).toEqual([]);
});

test("answering with nothing is not a refusal", async ({ page }) => {
  // The other side, and it is green: `void` means the submission succeeded, so no message and a valid
  // control is right. Without this the assertions above would read as "any answer must produce text".
  const shown = await submitAnswering(page, "none", null);
  expect(shown).toEqual({ errorText: "", invalid: "false" });
});
