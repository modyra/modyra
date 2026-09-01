import { expect, test } from "@playwright/test";

/**
 * One document, defined by a Rust service, drawn by Lit.
 *
 * This is the claim the contract exists for, and the only way to check it is to have two renderers
 * draw the same document and compare what they made of it. The plain demo draws this same checkout;
 * nothing in either page knows what a checkout is.
 *
 * The API may not be running — a person opening this demo without it should see why rather than a
 * hole — so absence is asserted as a stated absence rather than skipped.
 */
test("the served checkout is drawn, or its absence says how to end it", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("served-checkout");
  await expect(section).toBeVisible();

  const note = section.locator("p").first();
  await expect(note).not.toHaveText("asking the API…", { timeout: 15_000 });
  const said = (await note.textContent()) ?? "";

  if (/not answering/.test(said)) {
    // The honest half: no server, and the page says which command starts one.
    expect(said).toMatch(/demo:lit|cargo run/);
    expect(await section.locator(".mdy-renderer").count()).toBe(0);
    return;
  }

  // The server answered: the document was read strictly and drawn by this package's own elements.
  expect(said).toMatch(/Contract v\d+/);
  expect(said).toMatch(/drawn by Lit/);

  const drawn = section.locator(".mdy-renderer");
  await expect(drawn.first()).toBeVisible();
  expect(await drawn.count()).toBeGreaterThan(3);

  // A kind Lit draws nothing for is reported rather than dropped: a document naming one would
  // otherwise lose a field with nobody told.
  await expect(section.getByText(/no Lit element draws/)).toHaveCount(0);
});
