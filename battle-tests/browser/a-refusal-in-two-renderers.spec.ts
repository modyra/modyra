/**
 * Claims under attack: VAL-003, UI-008.
 */

import type { EitherHost } from "./host-api";
import { expect, test } from "@playwright/test";
import { parseDynamicFields } from "@modyra/core";

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
 *
 * The last test asks a second question of the same shape, because it has the same answer in both: a
 * date or a time the field cannot read is erased on blur with `aria-invalid` left `false` and nothing
 * said. Where two renderers agree, the thing they agree about is the contract's.
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
      const battle = (window as never as Record<string, EitherHost>)[api];
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
      const battle = (window as never as Record<string, EitherHost>)[api];
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
      const battle = (window as never as Record<string, EitherHost>)[api];
      return {
        held: battle.lastSubmitErrorsOf(mountId).map((entry) => `${entry.path ?? "(form)"}`),
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

for (const host of HOSTS) {
  test(`${host.name}: a value the picker cannot read is either kept or explained`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const outcomes = [];
    for (const [index, [kind, typed, readable]] of ([
      ["datepicker", "03/04/2026", true],
      ["datepicker", "not a date", false],
      ["timepicker", "2:30 PM", true],
      ["timepicker", "14:30", false],
    ] as const).entries()) {
      const id = `v${index}`;
      await page.evaluate(
        ({ api, mountId, k }) => {
          const battle = (window as never as Record<string, EitherHost>)[api];
          const fields = [{ name: "f", kind: k, label: "F" }];
          return api === "battle" ? battle.mountFields(mountId, fields) : battle.mountFields(mountId, fields);
        },
        { api: host.api, mountId: id, k: kind },
      );
      await page.waitForTimeout(180);

      const control = page.locator(`[data-form="${id}"] [aria-haspopup], [data-form="${id}"] input`).first();
      await control.focus();
      await page.keyboard.type(typed);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(220);

      const seen = await page.evaluate((selector) => {
        const element = document.querySelector(`${selector} [aria-haspopup], ${selector} input`) as HTMLInputElement;
        const list = document.querySelector(`${selector} .mdy-control__errors`) as HTMLElement | null;
        return { shows: element.value, invalid: element.getAttribute("aria-invalid"), errorText: (list?.innerText ?? "").trim() };
      }, `[data-form="${id}"]`);
      outcomes.push({ kind, typed, readable, ...seen });
    }

    // The control: the shape each picker does read is kept, so a failure below is the erasure rather
    // than a control that takes nothing.
    const kept = outcomes.filter((each) => each.readable);
    expect(kept.every((each) => each.shows !== ""), JSON.stringify(kept)).toBe(true);

    // And the ones it cannot read are either kept for correction or explained.
    const swallowed = outcomes.filter(
      (each) => !each.readable && each.shows === "" && each.invalid !== "true" && each.errorText === "",
    );
    expect(swallowed, JSON.stringify(swallowed, null, 1)).toEqual([]);
  });
}

for (const host of HOSTS) {
  test(`${host.name}: what a renderer draws is what the parse kept`, async ({ page }) => {
    // Two options may share a value — a plan sold monthly and yearly is one plan — and **the
    // contract has already answered that, against**. `parseDynamicFields` drops the repeat and says
    // why: an option's value is its identity, so two options sharing one leave a value naming both
    // and a control able to reach only the first. That decision has its own passing battle.
    //
    // This test asserted the opposite and was red in one renderer, which read as that renderer
    // losing an option. It was not: one host built its form from the parse and the other from the
    // raw field list, so the two disagreed about a document the contract had already ruled on. A
    // spec is not the place to overturn a parser decision — that is an ADR and a change to the
    // parser, and it is recorded as an open question rather than legislated here.
    //
    // What is asserted instead is the property this file is named for: **the two renderers say the
    // same thing**, and what they say is what the parse kept. That is the cross-renderer claim, and
    // it holds whichever way the duplicate question is eventually decided.
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const options = [
      { value: "pro", label: "Pro monthly" },
      { value: "pro", label: "Pro yearly" },
      { value: "lite", label: "Lite" },
    ];
    await page.evaluate(
      ({ api, given }) => {
        const battle = (window as never as Record<string, EitherHost>)[api];
        // Through the parser, on both hosts. This test is about what the **contract** does with a
        // repeated option value, so it must come through the door that applies the contract — the
        // raw door is `mountMdyForm`'s own behaviour and a different question.
        return battle.mountFields("opts", [{ name: "s", kind: "select", label: "Plan", options: given }], { parse: true });
      },
      { api: host.api, given: options },
    );
    await page.waitForTimeout(250);

    // Open it if it needs opening — a native select lists its options without being asked.
    const trigger = page.locator('[data-form="opts"] [role="combobox"]');
    if ((await trigger.count()) > 0) {
      await trigger.first().click();
      await page.waitForTimeout(220);
    }

    const rendered = await page.evaluate(() =>
      [...document.querySelectorAll('[role="option"], [data-form="opts"] option')].map((each) => each.textContent?.trim()),
    );

    const kept = parseDynamicFields([{ name: "s", kind: "select", label: "Plan", options }])[0]?.options ?? [];
    expect(
      rendered,
      `the renderer drew ${JSON.stringify(rendered)} and the parse kept ` +
        `${JSON.stringify(kept.map((each) => each.label))} — a control showing something the ` +
        `contract refused, or missing something it accepted, is a document that means two things`,
    ).toEqual(kept.map((each) => each.label));
  });
}
