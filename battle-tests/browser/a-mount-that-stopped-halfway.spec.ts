import { expect, test } from "@playwright/test";

/**
 * What a page keeps when mounting refuses a field.
 *
 * `assertUsableWidgetId` is deliberately loud rather than repairing: "an id is consumer-visible, so
 * rewriting one silently would change what a host's tests and stylesheets look for. An id containing
 * whitespace was never a usable id, so nothing correct is refused." The refusal is right, and the
 * message names the reason — that is not what is under attack here.
 *
 * What a real browser adds is what is left behind. Mounting paints as it goes, so a field refused
 * partway leaves every field before it in the container, plus the beginnings of the one that was
 * refused. The throw takes the return value with it, so the caller never receives the handle whose
 * `dispose()` is the only published way to unmount what was painted.
 *
 * The stray control is not nameless — it carries `aria-label`, and that is asserted, because the
 * finding is narrower than "an inaccessible control appeared". What it has no id, so its `<label>`
 * carries `for=""` and associates with nothing, and no ARIA reference can ever point at it.
 *
 * Claims under attack: A11Y-001 (a rendering never leaves a dangling or unresolvable reference),
 * LIF-001 (nothing is left behind that nobody owns).
 */

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

const cell = (name: string) => ({ name, kind: "text", label: name });

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("a mount that refuses a field leaves nothing of the fields it had already painted", async ({ page }) => {
  // The control: the same fields without the unusable one mount cleanly, so what the refusal leaves
  // is measured against a page that worked rather than against an assumption.
  const clean = await page.evaluate(
    (fields) => window.battle.mountFields("clean", fields as never),
    [cell("one"), cell("two")],
  );
  await settled(page);
  expect(clean.mounted).toBe(true);
  expect(await page.locator('[data-form="clean"] input').count()).toBe(2);

  const refused = await page.evaluate(
    (fields) => window.battle.mountFields("halfway", fields as never),
    [cell("one"), cell("two"), cell("a b")],
  );
  await settled(page);

  // The refusal itself is right, and says which field caused it.
  //
  // **The name, not the wording.** This pinned the phrase "cannot be a widget id" and went red when
  // the refusal was reworded — a rewrite of a message reading as a broken guard. What a person
  // needs from a refusal is which of their fields is the problem, and that survives any rewording:
  // a message that does not name `"a b"` leaves them to find it among however many they declared.
  expect(refused.mounted).toBe(false);
  expect(
    refused.message,
    `the mount refused, but the message does not name the field that caused it: ${refused.message}`,
  ).toContain("a b");

  const left = await page.evaluate(() => {
    const host = document.querySelector('[data-form="halfway"]');
    if (host === null) return { host: false, inputs: [] as Array<Record<string, unknown>> };
    return {
      host: true,
      inputs: [...host.querySelectorAll("input")].map((input) => ({
        id: input.id,
        labels: input.labels?.length ?? 0,
        ariaLabel: input.getAttribute("aria-label"),
      })),
      labelsPointingNowhere: [...host.querySelectorAll("label")].filter((label) => label.htmlFor === "").length,
    };
  });

  // Only what mounting owns is asserted. The container is the caller's — this page created it before
  // calling — but every control inside it was painted by the mount that then threw, and the call
  // returned no handle, so `dispose()`, the only published way to unmount what was painted, is not
  // reachable for any of it.
  expect(left.inputs.length).toBe(0);
});

test("the control a refused field left behind can still be referenced", async ({ page }) => {
  await page.evaluate(
    (fields) => window.battle.mountFields("halfway", fields as never),
    [cell("one"), cell("a b")],
  );
  await settled(page);

  const state = await page.evaluate(() => {
    const host = document.querySelector('[data-form="halfway"]');
    const inputs = [...(host?.querySelectorAll("input") ?? [])];
    const stray = inputs[inputs.length - 1];
    return {
      count: inputs.length,
      strayId: stray?.id ?? null,
      strayHasName: stray?.getAttribute("aria-label") !== null,
      strayLabels: stray?.labels?.length ?? 0,
      danglingReported: window.battle.danglingReferences(),
    };
  });

  // Narrower than "an inaccessible control appeared": it does carry an accessible name. What it has
  // no id, so its label associates with nothing and no ARIA reference can point at it — and the
  // page's own dangling-reference check cannot see that, because `for=""` points at no id at all
  // rather than at a missing one.
  if (state.count > 1) {
    expect({ hasName: state.strayHasName, id: state.strayId, labels: state.strayLabels }).toEqual({
      hasName: true,
      id: expect.not.stringMatching(/^$/),
      labels: 1,
    });
  }
});
