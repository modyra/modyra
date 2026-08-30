import { expect, test } from "@playwright/test";

/**
 * A section that only counts sometimes, and the attributes nobody wrote.
 *
 * Both are engine-level properties, asserted in every package's own suite — this is the one place
 * they are observed in a browser, on a page a person could open, through a renderer's real DOM.
 *
 * The demo prints what the form holds, so the assertions read the same numbers a reader sees rather
 * than reaching into the page's internals.
 */
type Page = import("@playwright/test").Page;

const state = (page: Page) =>
  page.locator("[data-conditional-state]").innerText().then((text) => JSON.parse(text));

/**
 * Picks an account kind through the widget's own affordances.
 *
 * Every renderer here draws a combobox rather than a native `<select>` — that is the contract — so
 * the spec opens it and chooses, which is also what a person does.
 */
const chooseAccount = async (page: Page, label: string) => {
  const control = page.getByRole("combobox", { name: "Account" });
  // A listbox is the contract's default and each renderer draws it with what it has: two use the
  // platform's chooser, one draws its own. Both answer to the combobox role, which is the part the
  // contract fixes — so the spec asks what it found rather than assuming a renderer.
  const isNative = await control.evaluate((el) => el.tagName === "SELECT");
  if (isNative) {
    await control.selectOption({ label });
    return;
  }
  await control.click();
  await page.getByRole("option", { name: label }).click();
};

/**
 * By label, not by id: every renderer mints ids its own way — one uses the field path, another a
 * counter — and the accessible name is the thing the contract fixes. It is also how a person finds
 * a field.
 */
const codeInput = (page: Page) => page.getByLabel("Code", { exact: true });
const nameInput = (page: Page) => page.getByLabel("Company name", { exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-conditional-state]").first()).toBeVisible();
});

test("a closed section asks for nothing and is not submitted", async ({ page }) => {
  const held = await state(page);

  expect(held.valid).toBe(true);
  expect(held.submitted).not.toContain("company");
});

test("a closed section is not announced as failing either", async ({ page }) => {
  const name = nameInput(page);
  const code = codeInput(page);

  // The perimeter, before the verdict. "Nothing announces a refusal" is also true of a page where
  // the section was never drawn, and that is the reading this assertion would otherwise get for
  // free — a closed section's controls stay in the document, disabled, which is the only state in
  // which the question means anything.
  await expect(name).toHaveCount(1);
  await expect(code).toHaveCount(1);

  await expect(name).toHaveAttribute("aria-invalid", "false");
  await expect(code).toHaveAttribute("aria-invalid", "false");

  // The control case, in the same run. An assertion that a value is right cannot show that the
  // attribute is read at all — a control that never announces anything passes the two lines above
  // whatever the form does. Opening the section and leaving the required field empty is the state
  // in which the announcement is owed, so a page that stayed silent here would fail rather than
  // pass, and the silence above stops being free.
  await chooseAccount(page, "Company");

  // The control case, made the way the record allows. Reading a field is not declining it: focus
  // arriving and leaving with the value untouched leaves it silent, deliberately, so a control that
  // only clicks and blurs asserts the opposite of what the library promises. A value typed and taken
  // away is the same person changing their mind, and that is what makes the field speak.
  await nameInput(page).fill("x");
  await nameInput(page).fill("");
  await nameInput(page).blur();

  await expect.poll(async () => nameInput(page).getAttribute("aria-invalid")).toBe("true");
});

test("opening the section brings what it holds into play", async ({ page }) => {
  await chooseAccount(page, "Company");

  await expect.poll(async () => (await state(page)).valid).toBe(false);

  await nameInput(page).fill("ACME");
  await expect.poll(async () => (await state(page)).valid).toBe(true);
});

test("what was typed survives leaving the section and coming back", async ({ page }) => {
  await chooseAccount(page, "Company");
  await nameInput(page).fill("ACME");

  await chooseAccount(page, "Personal");
  await expect.poll(async () => (await state(page)).kept.name).toBe("ACME");
  await expect.poll(async () => (await state(page)).submitted).not.toContain("company");

  await chooseAccount(page, "Company");
  await expect.poll(async () => (await state(page)).submitted).toContain("company");
});

test("the rules reach the keyboard: the control carries what they state", async ({ page }) => {
  const code = codeInput(page);

  await expect(code).toHaveAttribute("maxlength", "8");
  await expect(code).toHaveAttribute("minlength", "2");
  await expect(code).toHaveAttribute("pattern", "^[A-Z]+$");
});

test("the attribute constrains typing and never what the form holds", async ({ page }) => {
  await chooseAccount(page, "Company");
  const code = codeInput(page);

  await code.fill("ABCDEFGHIJKL");

  // The browser stops at eight; the model is not repaired behind anyone's back either way.
  await expect(code).toHaveValue("ABCDEFGH");
  await expect.poll(async () => (await state(page)).kept.code).toBe("ABCDEFGH");
});
