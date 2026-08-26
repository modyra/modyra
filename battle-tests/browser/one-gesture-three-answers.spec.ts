/**
 * The same keystrokes, from the same start, reach the same value in every renderer.
 *
 * A document declares a control; a person presses keys; a value comes out. Nothing in that sentence
 * names a framework, and `@modyra/widgets` exists so that it does not have to. A gesture that means
 * one thing in one adapter and another elsewhere makes the document a description of the page it
 * happened to be built with.
 *
 * Measured, three runs each, deterministic: open a `select` with nothing chosen, press `ArrowDown`
 * once, confirm.
 *
 *     plain     Alpha Bravo Charlie   →  "b"
 *     lit       Alpha Bravo Charlie   →  "b"
 *     angular   Alpha Bravo Charlie   →  "a"
 *
 * One opens with the first option already under the reading position, so the first move goes past it;
 * the other opens with the position nowhere, so the first move arrives at it. **Both are defensible
 * alone**, which is exactly why this needs a check rather than an argument: neither renderer is
 * obviously wrong, and the difference is invisible to anything that compares markup, parts, or the
 * set of keys a control answers.
 *
 * The assertion is deliberately blind to which answer is right. It compares the renderers to **each
 * other**, so it fails while they disagree and passes on whichever convention is chosen — the
 * decision belongs to the contract, and a battle that picked one would be legislating.
 *
 * Claims under attack: ADP-001, A11Y-006, UI-011.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

/** One press down from nothing chosen, then confirm. The smallest gesture that has an answer. */
async function chooseWithOneStep(
  page: import("@playwright/test").Page,
  host: (typeof HOSTS)[number],
  id: string,
  kind = "select",
) {
  await page.evaluate(({ api, mountId, options, k }) => {
    (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
      .mountFields(mountId, [{ name: "f", kind: k, label: "Plan", searchable: true, options }] as never);
  }, { api: host.api, mountId: id, options: OPTIONS, k: kind });

  const control = page.locator(`[data-form="${id}"] [role="combobox"], [data-form="${id}"] select`).first();
  await expect(control, `${host.name} drew no select this spec can reach`).toHaveCount(1, { timeout: 5_000 });
  await control.focus();

  // **Each keystroke is waited on for what that keystroke changes.** This test drives all three
  // renderers and then compares what they answered, so a host read a beat early reports a value the
  // others do not have and the failure says *the keyboard model diverges* about a page that had
  // simply not finished.
  //
  // Waiting for *the value to stop moving* does not do that job for the first two presses, because
  // neither of them moves the value: the first opens the list and the second moves the reading
  // position inside it. A wait for something to stop changing, asked of something that has not begun
  // to change, returns at once — it is a pause wearing the clothes of a settle, and it is the shape
  // that fails under load and passes alone.
  //
  // So the opening is waited on as an opening, the move as a move, and only the last press — the one
  // that writes — is waited on by the value coming to rest.
  const held = () => page.evaluate(({ api, mountId }) =>
    JSON.stringify((window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api]
      .valueOf(mountId).f ?? null),
    { api: host.api, mountId: id });

  /** Where the reading position is, by whichever of the two mechanisms an anatomy uses to carry it. */
  const readingAt = () => page.evaluate((mountId) => {
    const root = document.querySelector(`[data-form="${mountId}"]`);
    const active = document.activeElement;
    const pointed = root?.querySelector("[aria-activedescendant]")?.getAttribute("aria-activedescendant") ?? "";
    const selected = root?.querySelector("[aria-selected='true'],[aria-current='true']")?.id ?? "";
    return `${active === null ? "" : active.id || active.className}|${pointed}|${selected}`;
  }, id);

  const became = async (holds: () => Promise<boolean>, timeout = 3_000) => {
    const until = Date.now() + timeout;
    for (;;) {
      if (await holds().catch(() => false)) return true;
      if (Date.now() >= until) return false;
      await page.waitForTimeout(40);
    }
  };

  const settled = async () => {
    let last = await held();
    for (let still = 0; still < 3;) {
      await page.waitForTimeout(60);
      const now = await held();
      still = now === last ? still + 1 : 0;
      last = now;
    }
    return last;
  };

  const openNow = () => page.evaluate((mountId) =>
    document.querySelector(`[data-form="${mountId}"] [aria-expanded]`)?.getAttribute("aria-expanded") ?? "(none)", id);

  const wasClosed = await openNow();
  await page.keyboard.press("Enter");
  // A kind whose popup reports no expanded state at all cannot be waited on this way; there the
  // reading position moving is the only signal, and the next wait covers it.
  await became(async () => wasClosed === "(none)" || (await openNow()) !== wasClosed);

  const before = await readingAt();
  await page.keyboard.press("ArrowDown");
  await became(async () => (await readingAt()) !== before);

  await page.keyboard.press("Enter");
  await settled();

  return page.evaluate(({ api, mountId }) =>
    (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(mountId).f,
    { api: host.api, mountId: id });
}

test("one press down from nothing chosen reaches one value, in every renderer", async ({ page }) => {
  test.setTimeout(180_000);

  const answers: Record<string, unknown> = {};
  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    answers[host.name] = await chooseWithOneStep(page, host, "gesture");
  }

  // The premise: the gesture did something everywhere. Three renderers agreeing on `null` would
  // satisfy the comparison below while describing three broken controls.
  const chose = Object.values(answers).filter((each) => each !== null && each !== undefined && each !== "");
  expect(
    chose.length,
    `the gesture chose nothing in ${HOSTS.length - chose.length} renderer(s): ${JSON.stringify(answers)}`,
  ).toBe(HOSTS.length);

  const distinct = [...new Set(Object.values(answers).map((each) => JSON.stringify(each)))];
  expect(
    distinct.length,
    `the same keystrokes reached different values: ${JSON.stringify(answers)}. One renderer opens ` +
      "with the first option already under the reading position so the first move goes past it, and " +
      "another opens with the position nowhere so the first move arrives at it. Either convention is " +
      "defensible; having both means a document describes the page it was built with rather than a " +
      "control",
  ).toBe(1);
});

/**
 * The same question of the kinds that carry a value behind a popup.
 *
 * Asked of `select` first because it was the cheapest, and the answer was worth asking twice. These
 * two land on the **same** control in all three renderers — a text input, verified rather than
 * assumed, because "the first focusable thing" is a different element in three anatomies and a
 * divergence found that way would be the selector's.
 *
 * `colors` is deliberately not here. Its first focusable element is a swatch button in two renderers
 * and the native colour input in the third, so the gesture reaches different controls and any
 * disagreement says nothing about the keyboard model. That is a real difference in anatomy and a
 * question for a different spec.
 */
for (const kind of ["datepicker", "timepicker"]) {
  test(`one press down reaches one value for a ${kind}, in every renderer`, async ({ page }) => {
    test.setTimeout(180_000);

    const answers: Record<string, unknown> = {};
    for (const host of HOSTS) {
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      answers[host.name] = await chooseWithOneStep(page, host, `gesture-${kind}`, kind);
    }

    // The premise, which this test was missing while its sibling above carried it: the gesture chose
    // something everywhere. Three renderers answering nothing agree perfectly, and would report three
    // controls no keystroke reaches as one control behaving consistently.
    const chose = Object.values(answers).filter((each) => each !== null && each !== undefined && each !== "");
    expect(
      chose.length,
      `the gesture chose nothing on a ${kind} in ${HOSTS.length - chose.length} renderer(s): `
      + `${JSON.stringify(answers)}`,
    ).toBe(HOSTS.length);

    const distinct = [...new Set(Object.values(answers).map((each) => JSON.stringify(each)))];
    expect(
      distinct.length,
      `the same keystrokes on a ${kind} reached different values: ${JSON.stringify(answers)}. All ` +
        "three focus the same control — a text input — so this is the keyboard model diverging and " +
        "not the spec reaching for different elements",
    ).toBe(1);
  });
}
