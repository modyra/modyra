import { expect, test } from "@playwright/test";

/**
 * What a page shows when a server says no, in each of the shapes an application hands back.
 *
 * `onSubmit` returns field errors to reject. Its argument is whatever the application made of a
 * response, and that value is `any`, so the shapes below are not exotic — they are what
 * `await response.json()` gives you when the endpoint's envelope is not the one the type wanted.
 *
 * Every one of them now reaches somebody. A refusal naming a field lands on that field, and one whose
 * message is not a string lands there too, with a sentence a person can read instead of the name of a
 * JavaScript type. That is what this file asserts.
 *
 * The shapes that name no field — a bare string, an envelope that is not a list — land at form level,
 * and `an-error-with-nowhere-to-go.spec.ts` is where that is asked about. They are not asserted here
 * twice: what happens to them is a rendering gap rather than a routing one, and one finding wearing
 * two names is harder to close than one.
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

test("a refusal whose message is not a string is still readable", async ({ page }) => {
  // The shape an application produces without meaning to: the response object handed back as the
  // message. It used to reach the field as the name of a JavaScript type.
  const outcome = await submitAnswering(page, "obj", [{ path: "email", message: { detail: "taken", code: 409 } }]);

  expect(outcome.invalid, "the refusal did not reach the field at all").toBe("true");
  expect(outcome.errorText, "the field shows the name of a type instead of a sentence").not.toContain("[object");
  expect(outcome.errorText.length, "the field is marked invalid and says nothing").toBeGreaterThan(0);
});

test("answering with nothing is not a refusal", async ({ page }) => {
  // The other side, and it is green: `void` means the submission succeeded, so no message and a valid
  // control is right. Without this the assertions above would read as "any answer must produce text".
  const shown = await submitAnswering(page, "none", null);
  expect(shown).toEqual({ errorText: "", invalid: "false" });
});
