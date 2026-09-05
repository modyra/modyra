import { test } from "node:test";
import assert from "node:assert/strict";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "../dist/index.js";

/**
 * A kind that promises a popup points at the part that keeps the promise.
 *
 * An opener announces what it opens — `aria-haspopup="grid"`, `"listbox"`, `"dialog"` — and names the
 * element it opens with `aria-controls`. Those two are one sentence: the value of the first is a
 * claim about the role of the thing the second points at. A reader told "this opens a grid" and sent
 * to an element with no role has been told about a grid that, as far as the page is concerned, is
 * not there.
 *
 * **The reference names a sub-region, not the panel.** A date picker points past its own popup at
 * the calendar inside it, which is the practice this contract already follows for four of its six
 * kinds and the shape APG gives a date dialog. So the rule is not "the panel carries the role" — it
 * is "whatever is pointed at does".
 */

/** Every kind whose opener makes a promise, derived rather than listed. */
const PROMISING = Object.entries(MDY_POPUP_OPENERS)
  .filter(([, opener]) => opener?.promises !== undefined && opener?.controls !== undefined);

test("some kind promises a popup, or this guards nothing", () => {
  assert.ok(PROMISING.length > 1);
});

test("what an opener points at carries the role it promised", () => {
  const broken = [];
  for (const [kind, opener] of PROMISING) {
    const parts = MDY_WIDGET_CONTRACTS[kind].parts;
    const pointed = parts[opener.controls]?.role ?? null;
    if (pointed === opener.promises) continue;
    // Named with the parts that *do* carry it, so a reader is told where the promise could land
    // rather than only that it does not.
    const carriers = Object.entries(parts)
      .filter(([, part]) => part?.role === opener.promises).map(([name]) => name);
    broken.push(
      `${kind}: promises ${opener.promises}, points at ${opener.controls} (role ${String(pointed)})`
      + ` — carried by ${carriers.join(", ") || "no part of this kind"}`,
    );
  }
  assert.deepEqual(broken, []);
});
