import { expect, test } from "@playwright/test";

/**
 * Smoke test: the packaged demo boots, a text control accepts input and
 * required validation surfaces an error while blocking submit.
 */
test("demo boots, accepts input and enforces required fields", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "modyra Demo" }),
  ).toBeVisible();

  // Scope to the declarative contact form (other sections have their own
  // forms and submit buttons).
  const contactForm = page.locator("mdy-form", {
    has: page.getByLabel("First Name", { exact: true }),
  });

  // A text control accepts input.
  const firstName = contactForm.getByLabel("First Name", { exact: true });
  await firstName.fill("Ada");
  await expect(firstName).toHaveValue("Ada");

  // Required validation: blur an empty required field, the field is flagged
  // invalid with a visible error indicator and submit stays disabled.
  await firstName.fill("");
  await firstName.blur();
  await expect(firstName).toHaveAttribute("aria-invalid", "true");
  await expect(
    contactForm.getByRole("img", { name: /This field is required/ }),
  ).toBeVisible();
  await expect(
    contactForm.getByRole("button", { name: "Submit", exact: true }),
  ).toBeDisabled();
});

/**
 * The typed-form section runs a debounced, cancellable serverValidator on
 * the username: a pending indicator appears while the mock endpoint runs,
 * then the "taken" error surfaces on blur.
 */
test("typed form validates the username against the server", async ({
  page,
}) => {
  await page.goto("/");
  // Scope to the typed-form section (the Zod wizard has a Username too).
  const section = page.locator("section", {
    has: page.getByRole("heading", { name: /Typed form/ }),
  });
  const username = section.getByLabel("Username", { exact: true });

  await username.fill("admin");
  await expect(
    section.getByRole("status").filter({ hasText: "checking…" }),
  ).toBeVisible();

  await username.blur();
  await expect(
    section.getByText("Username is already taken"),
  ).toBeVisible();
});
