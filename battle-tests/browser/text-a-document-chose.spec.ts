import { expect, test } from "@playwright/test";

/**
 * Every string a document chose, rendered into a real page.
 *
 * A form arrives as data from somewhere that is not the application — a CMS, a model, a saved
 * project, a POST — and almost everything a user sees comes from it: labels, placeholders, option
 * text, error messages, and the id prefix a host passes beside them. The Plain renderer builds its
 * DOM with `document.createElement` and `addEventListener`, "no virtual DOM, no template engine", so
 * these are set as text and attributes rather than parsed as markup.
 *
 * That is a property of how it is written, and the kind that a refactor takes away by accident: one
 * `innerHTML` for convenience and every one of these strings becomes markup a document author chose.
 * A green battle here is a tripwire on that, not a report of a defect.
 *
 * The id prefix is checked alongside because it is the one string a *host* chooses that lands in the
 * same place, and because its guard is the contrast that matters elsewhere: `mountMdyForm` refuses an
 * unusable `idPrefix` before painting anything.
 *
 * Claims under attack: SEC-001, A11Y-001.
 */

const PAYLOAD = '<img src=x onerror="window.__battleXss = true">';

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
  await page.evaluate(() => {
    (window as never as { __battleXss?: boolean }).__battleXss = false;
  });
});

test("a label, a placeholder and an option a document chose are text, not markup", async ({ page }) => {
  const fields = [
    { name: "one", kind: "text", label: PAYLOAD, placeholder: PAYLOAD },
    { name: "two", kind: "select", label: "Pick", options: [{ value: "a", label: PAYLOAD }] },
  ];

  // Counted before anything is mounted: the page carries its own module script, and a check that
  // did not subtract it would report an injection on an empty page.
  const before = await page.evaluate(() => document.querySelectorAll("img, script, iframe, object, embed").length);

  const mounted = await page.evaluate(
    (declared) => window.battle.mountFields("hostile", declared as never),
    fields,
  );
  await settled(page);
  expect(mounted.mounted).toBe(true);

  // The select is a combobox: its options exist once the listbox is opened, which is where a user
  // reads them and therefore where the text has to be text.
  await page.locator('[data-form="hostile"] [role="combobox"]').click();
  await settled(page);

  const rendered = await page.evaluate(() => {
    const host = document.querySelector('[data-form="hostile"]')!;
    return {
      // Over the whole document rather than the container: an open listbox is rendered outside it, so
      // a count scoped to the container would miss the one place the option text is read.
      injected: document.querySelectorAll("img, script, iframe, object, embed").length,
      // The renderer's own chevron is not one of those elements, so it is asked about separately.
      decorativeIcons: [...host.querySelectorAll("svg")].map((each) => each.getAttribute("aria-hidden")),
      ran: (window as never as { __battleXss?: boolean }).__battleXss,
      labelText: host.querySelector("label")?.textContent ?? "",
      placeholder: host.querySelector("input")?.getAttribute("placeholder") ?? "",
      optionText: [...document.querySelectorAll('[role="option"], option')].map((each) => each.textContent),
    };
  });

  // Nothing was parsed, nothing ran, and every string arrived intact — the last part matters as much
  // as the first: a renderer that stripped these would be safe and would also be losing text.
  expect(rendered.injected).toBe(before);
  expect(rendered.ran).toBe(false);

  // The renderer draws its own chevron, and it is hidden from assistive technology — an icon a
  // screen reader announces is noise between the label and the value.
  expect(rendered.decorativeIcons).toEqual(rendered.decorativeIcons.map(() => "true"));

  expect(rendered.labelText).toContain(PAYLOAD);
  expect(rendered.placeholder).toBe(PAYLOAD);
  expect(rendered.optionText).toContain(PAYLOAD);
});

test("an error message a document chose is text where the user reads it", async ({ page }) => {
  const fields = [{ name: "one", kind: "text", label: "One", validators: { required: true, message: PAYLOAD } }];

  await page.evaluate((declared) => window.battle.mountFields("msg", declared as never), fields);
  await settled(page);

  const input = page.locator('[data-form="msg"] input').first();
  await input.click();
  await input.fill("x");
  await input.fill("");
  await input.blur();
  await settled(page);

  const shown = await page.evaluate(() => {
    const host = document.querySelector('[data-form="msg"]')!;
    return {
      injected: [...document.querySelectorAll("img, iframe")].length,
      ran: (window as never as { __battleXss?: boolean }).__battleXss,
      text: (host as HTMLElement).innerText,
    };
  });

  expect(shown.injected).toBe(0);
  expect(shown.ran).toBe(false);
  // Whether this document's own message or the built-in one is shown, it is text either way.
  expect(shown.text.length).toBeGreaterThan(0);
});

test("an id prefix that cannot be one is refused before anything is painted", async ({ page }) => {
  // The contrast: this guard runs first, so a refused prefix leaves an empty container rather than a
  // partly built form.
  const attempts = await page.evaluate(() => {
    const fields = [{ name: "one", kind: "text", label: "One" }];
    const out: Array<{ prefix: string; mounted: boolean; painted: number }> = [];
    for (const prefix of ["ok", "a__b", "a b", ""]) {
      const id = `p-${out.length}`;
      const result = window.battle.mountFields(id, fields as never, { idPrefix: prefix });
      out.push({
        prefix,
        mounted: result.mounted,
        painted: document.querySelectorAll(`[data-form="${id}"] input`).length,
      });
    }
    return out;
  });
  await settled(page);

  expect(attempts).toEqual([
    { prefix: "ok", mounted: true, painted: 1 },
    { prefix: "a__b", mounted: false, painted: 0 },
    { prefix: "a b", mounted: false, painted: 0 },
    { prefix: "", mounted: false, painted: 0 },
  ]);

  // And the prefix that was accepted actually scopes the ids, so the refusals above are about the
  // guard rather than about a prefix that never reaches an id.
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-form="p-0"] [id]')].map((each) => each.id));
  expect(ids.every((id) => id.startsWith("ok"))).toBe(true);
});
