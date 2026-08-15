import { expect, test } from "@playwright/test";

/**
 * The same refusal, asked of two renderers.
 *
 * `@modyra/plain` and `@modyra/lit` build different markup from the same engine, so a question worth
 * asking of one is worth asking of both — and a gap that is in both is a gap in the contract they
 * share rather than in either of them.
 *
 * The question: a submission is refused, and the person who pressed the button is told.
 *
 * A refusal naming a field reaches the person in both. A refusal naming no field — a failed network
 * call, a service that is down, a cross-field rule only the server can check — reaches neither: the
 * engine holds it in `lastSubmitErrors` with `path: null` and there is no region in either renderer's
 * markup to put it in. `@modyra/widgets` has no part for one either, which is where that leaves the
 * fix.
 *
 * Both renderers are driven through their own host page, each built from the published entry points a
 * consumer would import. Nothing is asserted about how they differ in markup — only about whether the
 * sentence arrives.
 */

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** Mount one text field, use it so the renderer considers it visited, and submit with `answer`. */
async function refuse(page: import("@playwright/test").Page, host, id, answer) {
  await page.goto(host.page);
  await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

  await page.evaluate(
    ({ api, mountId }) => {
      const battle = (window as never as Record<string, Record<string, Function>>)[api];
      const fields = [{ name: "email", kind: "text", label: "Email" }];
      if (api === "battle") return battle.mountWithSubmit(mountId, fields, null);
      return battle.mountFields(mountId, fields);
    },
    { api: host.api, mountId: id },
  );
  await page.waitForTimeout(200);

  // Visited, because a renderer may hold what it has to say until the person has been there — one of
  // these two does, and this battle is not about that difference.
  const input = page.locator(`[data-form="${id}"] input`).first();
  await input.click();
  await input.fill("a@b.c");
  await input.blur();
  await page.waitForTimeout(150);

  await page.evaluate(
    async ({ api, mountId, given }) => {
      const battle = (window as never as Record<string, Record<string, Function>>)[api];
      if (api === "battleLit") return battle.submitAnswering(mountId, given);
      // The plain host takes the answer at mount time, so it is remounted with it.
      battle.dispose(mountId);
      battle.mountWithSubmit(mountId, [{ name: "email", kind: "text", label: "Email" }], given);
      return null;
    },
    { api: host.api, mountId: id, given: answer },
  );

  if (host.api === "battle") {
    await page.waitForTimeout(150);
    const again = page.locator(`[data-form="${id}"] input`).first();
    await again.fill("a@b.c");
    await page.locator(`[data-form="${id}"] button`).last().click();
  }
  await page.waitForTimeout(300);

  return page.evaluate(
    ({ api, mountId }) => {
      const battle = (window as never as Record<string, Record<string, Function>>)[api];
      return {
        held: battle.lastSubmitErrorsOf(mountId).map((entry: Record<string, string>) => `${entry.path ?? "(form)"}`),
        onThePage: document.body.innerText.replace(/\s+/g, " ").trim(),
      };
    },
    { api: host.api, mountId: id },
  );
}

for (const host of HOSTS) {
  test(`${host.name}: a refusal that names a field reaches the person`, async ({ page }) => {
    // The control: each renderer does show what it has a place for, so the silence in the next test
    // is about the place and not about refusals never being rendered.
    const seen = await refuse(page, host, "f", [{ path: "email", message: "FIELD LEVEL MESSAGE" }]);
    expect(seen.held).toContain("email");
    expect(seen.onThePage).toContain("FIELD LEVEL MESSAGE");
  });

  test(`${host.name}: a refusal that names no field reaches the person too`, async ({ page }) => {
    const seen = await refuse(page, host, "g", [{ path: null, message: "SERVICE UNAVAILABLE" }]);

    // The premise: the engine kept it, so the page's silence is a rendering gap rather than a value
    // nobody produced.
    expect(seen.held, "the form did not keep the form-level refusal").toContain("(form)");
    expect(seen.onThePage, "the form holds it and this renderer has nowhere to show it").toContain("SERVICE UNAVAILABLE");
  });
}
