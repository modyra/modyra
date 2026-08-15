import { expect, test } from "@playwright/test";
import { MDY_FORM_SHELL_CLASSES, MDY_FORM_SHELL_STRUCTURE } from "@modyra/widgets";

/**
 * An error the form holds and the page has nowhere to put.
 *
 * Not every refusal belongs to a field. A network call that failed, a service that is down, a
 * cross-field rule the server checked and the client cannot — all of these arrive with no path, and
 * the engine has a place for them: `state.lastSubmitErrors()` carries them with `path: null`, and it
 * turns a submit action that *throws* into one of them rather than letting the failure escape.
 *
 * The page has no place for them. There is no form-level error region in the rendered DOM — not empty,
 * absent — so the message is held by the form, reachable from the console, and never shown. A person
 * who pressed Submit while the service was down sees the button, the fields as they left them, and
 * nothing else.
 *
 * This is the same boundary as a server's refusal in the wrong shape, and the more complete half of
 * it: that one is about a message being dropped on the way in, this one is about there being nowhere
 * to render a message that arrived intact.
 *
 * Both halves are asserted. The engine holding it is what makes the page's silence a rendering gap
 * rather than a value that was never produced.
 *
 * The last test pins what the region *is* rather than that it holds the message.
 * `MDY_FORM_SHELL_STRUCTURE` declares it as a `status` — a live region, which is the difference
 * between a refusal being visible and a refusal being announced — with one `formErrorItem` per
 * error. Nothing asserted that before: a renderer could swap the role for a plain `div` and every
 * other test here would stay green while a screen reader stopped saying anything.
 */

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

/** Mount, fill, submit with `answer`, and read both what the form holds and what the page shows. */
async function submitAnswering(page: import("@playwright/test").Page, id: string, answer: unknown) {
  await page.evaluate(
    ({ mountId, given }) =>
      window.battle.mountWithSubmit(mountId, [{ name: "email", kind: "text", label: "Email" }] as never, given as never),
    { mountId: id, given: answer },
  );
  await settled(page);
  await page.locator(`[data-form="${id}"] input`).fill("a@b.c");
  await page.locator(`[data-form="${id}"] button`).last().click();
  await page.waitForTimeout(280);

  return page.evaluate((mountId) => ({
    held: window.battle.lastSubmitErrorsOf(mountId),
    onThePage: document.body.innerText.replace(/\s+/g, " ").trim(),
  }), id);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("an error that belongs to a field is shown where the field is", async ({ page }) => {
  // The control: the renderer does show what it has a place for, so the silence below is about the
  // place and not about errors never being rendered.
  const outcome = await submitAnswering(page, "field", [{ path: "email", message: "FIELD LEVEL MESSAGE" }]);
  expect(outcome.held).toEqual([{ path: "email", message: "FIELD LEVEL MESSAGE" }]);
  expect(outcome.onThePage).toContain("FIELD LEVEL MESSAGE");
});

test("an error that belongs to no field is shown too", async ({ page }) => {
  const outcome = await submitAnswering(page, "form", [{ path: null, message: "SERVICE UNAVAILABLE" }]);

  // The premise: the form is holding it. Without this the page's silence would mean the error never
  // existed rather than that it has nowhere to go.
  expect(outcome.held, "the form did not keep the form-level error").toEqual([
    { path: null, message: "SERVICE UNAVAILABLE" },
  ]);

  expect(outcome.onThePage, "the form holds it and the page never shows it").toContain("SERVICE UNAVAILABLE");
});

test("a submit action that throws is shown too", async ({ page }) => {
  // The shape an application produces without meaning to: the fetch rejected. The engine turns it
  // into a form-level error rather than letting it escape — which is right, and leaves it in the same
  // place with the same nowhere to go.
  const outcome = await submitAnswering(page, "threw", { __throw: "NETWORK DOWN" });

  expect(outcome.held.map((entry) => entry.message), "the form did not keep the thrown failure").toContain("NETWORK DOWN");
  expect(outcome.onThePage, "a failed submission left the page exactly as it was").toContain("NETWORK DOWN");
});

test("the region a refusal arrives in is the one the contract declares", async ({ page }) => {
  const outcome = await submitAnswering(page, "shell", [{ path: null, message: "SERVICE UNAVAILABLE" }]);

  // The control: the engine holds it, so what follows is about the region rather than a message that
  // never arrived.
  expect(outcome.held).toEqual([{ path: null, message: "SERVICE UNAVAILABLE" }]);

  const declared = MDY_FORM_SHELL_STRUCTURE.nodes.find((node) => node.part === "formErrors");
  expect(declared, JSON.stringify(MDY_FORM_SHELL_STRUCTURE)).toMatchObject({ element: "status" });

  const seen = await page.evaluate(({ region, item }) => {
    const root = document.querySelector('[data-form="shell"]');
    if (root === null) return null;
    const found = root.querySelector(`.${region}`);
    return {
      present: found !== null,
      role: found?.getAttribute("role") ?? null,
      hidden: found === null ? null : (found as HTMLElement).hidden,
      items: root.querySelectorAll(`.${item}`).length,
      text: (found?.textContent ?? "").replace(/\s+/g, " ").trim(),
    };
  }, { region: MDY_FORM_SHELL_CLASSES.formErrors, item: MDY_FORM_SHELL_CLASSES.formErrorItem });

  expect(seen, JSON.stringify(seen)).toMatchObject({
    present: true,
    role: "status",
    hidden: false,
    items: 1,
  });
  expect(seen?.text).toContain("SERVICE UNAVAILABLE");
});
