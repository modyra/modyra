/**
 * One live region for the page, and the three things that make announcing more than writing text.
 *
 * Eight adapters each named a region of their own, so a page carrying two of them carried two polite
 * regions. Two regions speaking in the same instant are read in an order nothing specifies — every
 * screen reader has its own policy — and one cuts the other off partway. The loss exists with one
 * region too; with one there is somewhere to put the queue that prevents it.
 *
 * These assertions read the DOM, not the source. A region is a thing a reader watches, and the only
 * evidence that two renderers share one is a page with both of them on it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "../../plain/test/support/dom-env.mjs";

installDomGlobals();
const { createMdyAnnouncer, MDY_SHARED_REGION_ATTRIBUTE, MDY_SHARED_REGION_ID } =
  await import("../dist/index.js");

const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Every distinct value the region held, sampled.
 *
 * Sampling can miss a value that lived between two samples, and it fails in the safe direction: a
 * missed write makes the assertion red, never green. This host has no MutationObserver.
 */
function record(region) {
  const seen = [];
  const tick = setInterval(() => {
    const text = region.textContent;
    if (seen[seen.length - 1] !== text) seen.push(text);
  }, 5);
  return { seen, stop: () => clearInterval(tick) };
}
const regions = () => document.querySelectorAll(`[${MDY_SHARED_REGION_ATTRIBUTE}]`);

test("two announcers built independently reach the same region", () => {
  createMdyAnnouncer();
  createMdyAnnouncer();
  assert.equal(regions().length, 1,
    "a second announcer made a second region — two polite regions on one page are read in an order "
    + "nothing specifies, and one cuts the other off partway");
  assert.equal(regions()[0].id, MDY_SHARED_REGION_ID, "the region is not the one the contract names");
});

test("the region exists before anything is said, and exists empty", () => {
  // A reader announces a change to a region it already knows. One created and filled in the same
  // instant is met already full, with no change to read, and the first announcement of a page is the
  // one most likely to be lost that way.
  document.getElementById(MDY_SHARED_REGION_ID)?.remove();
  createMdyAnnouncer();
  const region = document.getElementById(MDY_SHARED_REGION_ID);
  assert.ok(region, "no region until the first message — the first message is the one that is lost");
  assert.equal(region.textContent, "", "the region was born holding text, so there is no change to read");
  assert.equal(region.getAttribute("aria-live"), "polite");
  assert.equal(region.getAttribute("aria-atomic"), "true");
});

test("two things said in the same instant are both heard", async () => {
  document.getElementById(MDY_SHARED_REGION_ID)?.remove();
  const announcer = createMdyAnnouncer();
  const region = document.getElementById(MDY_SHARED_REGION_ID);
  const tape = record(region);

  announcer.announce("Città: elenco aperto");
  announcer.announce("3 risultati");
  await settle(900);
  tape.stop();
  const heard = tape.seen.filter((text) => text !== "");

  assert.deepEqual(heard, ["Città: elenco aperto", "3 risultati"],
    "a message written over another in the same instant is lost — the second overwrote the first "
    + `before a reader saw it. Heard: ${JSON.stringify(heard)}`);
});

test("the same words twice running are said twice", async () => {
  document.getElementById(MDY_SHARED_REGION_ID)?.remove();
  const announcer = createMdyAnnouncer();
  const region = document.getElementById(MDY_SHARED_REGION_ID);
  const tape = record(region);

  announcer.announce("Errore corretto");
  await settle(400);
  announcer.announce("Errore corretto");
  await settle(400);
  tape.stop();
  const writes = tape.seen;

  // The clear between them is what makes the repeat a change. Without it a reader announcing changes
  // sees the same string it already holds and says nothing.
  const cleared = writes.filter((text) => text === "");
  assert.ok(cleared.length >= 2,
    `the region was cleared ${cleared.length} time(s) across two identical messages — a reader `
    + "announces changes, and the same text written over itself is not one");
});
