/**
 * Whether one document produces one date on the screen.
 *
 * A document says a field holds `2026-01-02`. What a person then reads in the box is not the same
 * question — a date can be written many ways, and writing it the way a reader expects is a service
 * rather than a liberty. This file does not say which way is right, and there is a good argument for
 * more than one.
 *
 * **It says that the answer does not depend on which renderer drew the field.** The same document,
 * handed to each, produces `2026-01-02` in two of them and `01/02/2026` in the third. Nothing in the
 * document asked for either. An application that changes renderer changes what its users read, and an
 * organisation running two of them shows two things to two halves of its staff — from one source that
 * says nothing about the matter.
 *
 * **This is not about what is sent.** A form now posts the value the field holds wherever it is drawn,
 * and that is settled. What is left is the reading, and the reading is what a person copies into an
 * email, checks against a paper form, or reads aloud on the telephone. `01/02` is the second of
 * January to one reader and the first of February to another, and the document that produced it took
 * no position.
 *
 * **The check is agreement, not spelling.** Whichever way the three converge — all in the value's own
 * notation, all in the reader's, all in something else — this goes green. It goes red only while they
 * disagree, which is the one state that cannot be defended, because it is not a decision anybody made.
 *
 * **A renderer's own extra input is not the cause.** One of the three accepts a formatting option in
 * its templates that the others have no equivalent of; passing it through the document changes nothing
 * in any of them, so it is not what produces the difference. The difference is a default, which makes
 * it the harder kind: nobody chose it for this field, and nothing about the field records that a
 * choice was made.
 *
 * **The premise is that a date was drawn at all**, and that what is read back is the same in two
 * successive readings — a box still settling would produce a disagreement that is about time rather
 * than about renderers.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { HOSTS } from "./bench";

/**
 * The decision this measures, read from the record that takes it.
 *
 * Agreement alone was the property while nothing had been decided, and it is the weaker half: plain
 * and lit already agree on the value's own notation, so a check that asks only for agreement passes
 * the state the decision was taken to leave. While the record stands, the display is also owed the
 * shape it names.
 */
const DECIDED = (() => {
  const path = join(process.cwd(), "docs", "architecture", "0178-a-date-a-person-can-read-aloud.md");
  const text = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (text === null || !/^Status:\s*Accepted\s*$/m.test(text)) return null;
  return text.includes("A date is displayed with its month named, in the reader's language and order.")
    ? "the month named, in the reader's language and order"
    : null;
})();

/** A display that could be read as two different days depending on where the reader is. */
const isAmbiguous = (shown: string) => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(shown.trim());

/** The value's own notation: unambiguous, and not a thing a person says out loud. */
const isTheValue = (shown: string) => /^\d{4}-\d{2}-\d{2}$/.test(shown.trim());

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** A date whose parts differ, so a swapped order is visible rather than a coincidence. */
const HELD = "2026-01-02";

test("one document is one date on the screen, whoever drew it", async ({ page }) => {
  test.setTimeout(300_000);

  const shown: Record<string, string> = {};

  for (const host of HOSTS) {
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api, held }) => {
      (window as never as Api)[api].mountFields("spelling", [{
        name: "d", kind: "datepicker", label: "Data", initialValue: held,
      }] as never);
    }, { api: host.api, held: HELD });
    await page.locator('[data-form="spelling"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(400);

    const read = () => page.evaluate(() => {
      const box = document.querySelector(
        '[data-form="spelling"] input[type="text"], [data-form="spelling"] input:not([type="hidden"])',
      ) as HTMLInputElement | null;
      return box === null ? null : box.value;
    });

    const first = await read();
    expect(first, `${host.name} drew no box a date could be read from`).not.toBeNull();

    // Read twice: a box still settling disagrees with itself, and that disagreement is about time.
    await page.waitForTimeout(300);
    const second = await read();
    expect(
      second,
      `${host.name} read "${first}" and then "${second}" a moment later, so the box was still `
      + "settling and what it says is not yet what it will say",
    ).toBe(first);

    expect(
      first,
      `${host.name} drew an empty box for a field the document says holds ${HELD}`,
    ).not.toBe("");

    shown[host.name] = first!;
  }

  const spellings = [...new Set(Object.values(shown))];
  expect(
    spellings.length,
    "one document, drawn by each renderer, puts a different date on the screen: "
    + `${Object.entries(shown).map(([name, value]) => `${name} reads "${value}"`).join(", ")}. `
    + "Two people comparing screens and seeing different text for the same day will, at least once, "
    + "conclude they hold different days — and under a numeric format they will actually have read "
    + "different days.",
  ).toBe(1);

  // The record is read rather than restated: while it stands, a display is owed the shape it names,
  // and if it is superseded this falls back to agreement without anybody editing this file.
  if (DECIDED === null) return;

  const wrong = Object.entries(shown)
    .filter(([, value]) => isAmbiguous(value) || isTheValue(value))
    .map(([name, value]) => `${name} reads "${value}"`);

  expect(
    wrong,
    `${wrong.length} renderer(s) display a date as digits where the record calls for ${DECIDED}:\n`
    + `${wrong.join("\n")}\n\n`
    + "A numeric triple is two dates and which one it is depends on who is reading; the value's own "
    + "notation is unambiguous and not a thing anybody says out loud. Only a named month is both.",
  ).toEqual([]);
});
