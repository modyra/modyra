/**
 * Whether a field an application locked still takes a file.
 *
 * `readonly` is an application's statement that this value is not the person's to change. For a text
 * box the browser enforces it; for a file field there is nothing native to lean on, so whatever
 * enforces it has to be the control.
 *
 * **Two renderers guard the button and nothing else.** The picker is disabled, so a pointer cannot
 * open it — and a file that arrives by any other route is taken and written into the model. Dropping
 * one on the field is such a route, and so is a script, and so is assistive software driving the
 * input directly. A guard on one door is not a lock.
 *
 * The file here is delivered straight to the input, which is what a test driver can do and what a
 * drop does: it is the arrival that is being tested, not the gesture.
 *
 * **The control is a field that is not locked**, taking the same file by the same route. Without it a
 * model that stayed empty would say the delivery never worked, and this file would report a lock that
 * nothing was testing.
 *
 * Claims under attack: VAL-002, API-001.
 */

import { expect, test } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

import { became, HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** Written where the machine keeps scratch, not beside the spec: a run must leave the tree as it found it. */
const A_FILE = join(tmpdir(), "mdy-a-file-to-hand-over.txt");

for (const host of HOSTS) {
  test(`a field an application locked does not take a file, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    writeFileSync(A_FILE, "a file a person handed over\n", "utf8");

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const held = async (id: string, lock: boolean) => {
      await page.evaluate(({ api, mountId }) =>
        (window as never as Api)[api].mountFields(mountId as never, [{ name: "f", kind: "file", label: "L" }] as never),
        { api: host.api, mountId: id });
      await became(() => page.evaluate((sel) => (document.querySelector(sel)?.children.length ?? 0) > 0, `[data-form="${id}"]`));

      if (lock) {
        await page.evaluate(({ api, mountId }) =>
          (window as never as Api)[api].readonly(mountId as never, "f" as never), { api: host.api, mountId: id });
        // The lock has to have reached the control before a file is handed to it, or what is measured
        // is a field that was never locked.
        await became(() => page.evaluate(
          (sel) => document.querySelector(`${sel} [aria-readonly="true"], ${sel} [aria-disabled="true"], ${sel} :disabled`) !== null,
          `[data-form="${id}"]`));
      }

      const input = page.locator(`[data-form="${id}"] input[type="file"]`).first();
      const arrived = await input.setInputFiles(A_FILE, { timeout: 5_000 }).then(() => true).catch(() => false);

      const value = await page.evaluate(({ api, mountId }) =>
        JSON.stringify((window as never as Api)[api].valueOf(mountId as never)), { api: host.api, mountId: id });
      return { arrived, held: JSON.parse(value as string).f as unknown[] | undefined };
    };

    const open = await held("take-open", false);
    const locked = await held("take-locked", true);

    // The control: the delivery works on a field that is not locked, so an empty model below is the
    // lock rather than a file that never got there.
    expect(
      open.arrived && (open.held?.length ?? 0) > 0,
      `${host.name}: a file handed to a field that is not locked did not reach the model `
      + `(${JSON.stringify(open)}), so nothing below is a measurement of the lock`,
    ).toBe(true);

    expect(
      locked.held ?? [],
      `${host.name}: a field the application declared read-only took a file and wrote it into the `
      + `model (${JSON.stringify(locked)}). Disabling the picker stops a pointer and nothing else — a `
      + "drop, a script or assistive software hands the file straight to the input, and the value the "
      + "application said was not the person's to change has changed.",
    ).toEqual([]);
  });
}
