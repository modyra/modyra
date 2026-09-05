import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { inspectWidgetDom } from "../dist/testing/index.js";

/**
 * Two parts that carry the same classes are told apart by where the contract says they live.
 *
 * No selector separates a timepicker's hour box from its minute box — both are
 * `mdy-timepicker-segment-input` — and the contract distinguishes them the only way it can: the hour
 * box lives inside the hour segment and the minute box inside the minute segment.
 *
 * Resolved by their position among the matches instead, the answer is right only while both are
 * rendered and in the expected order. A widget that draws one of them binds the *other* part to it,
 * and the walk then reports the surviving part as missing while quietly inspecting the wrong element
 * for the one that is gone — two findings, neither of them the truth.
 *
 * The comment beside that resolution already stated the rule: what separates them is in the anatomy.
 * These pin that the code does what the comment says.
 */

const dom = new JSDOM("<!doctype html><body></body>");
const { document } = dom.window;

/** A timepicker whose header holds only the segments named, in the order named. */
const timepicker = (segments) => {
  const make = (tag, classes, children = []) => {
    const element = document.createElement(tag);
    element.className = classes;
    for (const child of children) element.append(child);
    return element;
  };
  const segment = (which) => {
    const box = make("input", "mdy-timepicker-segment-input");
    // The role the contract gives these boxes. Without it the walk reports PART_ROLE on both and the
    // bench would be measuring its own fixture instead of the resolution.
    box.setAttribute("role", "spinbutton");
    return make("div", `mdy-timepicker-segment mdy-timepicker-segment--${which}`, [box]);
  };
  return make("div", "mdy-renderer mdy-renderer--timepicker", [
    make("div", "mdy-input-wrapper", []),
    make("div", "mdy-timepicker__popup mdy-popup", [
      make("div", "mdy-timepicker-container", [
        make("div", "mdy-timepicker-content", [
          make("div", "mdy-timepicker-header", segments.map(segment)),
        ]),
      ]),
    ]),
  ]);
};

const about = (issues, parts) =>
  issues.filter((issue) => parts.includes(issue.part))
    .map((issue) => `${issue.part}:${issue.code}`).sort();

test("with both segments drawn, each box belongs to its own segment", () => {
  const issues = inspectWidgetDom(timepicker(["hour", "minute"]), "timepicker", { open: true });
  assert.deepEqual(about(issues, ["hourControl", "minuteControl"]), []);
});

test("a segment out of order is one finding, not three", () => {
  // The contract does declare hour before minute, so a minutes-first document is a violation and
  // `PART_ORDER` says so. What must not happen is the walk adding two more: resolved by position,
  // each box binds to the other's element and both are then reported as sitting outside the parent
  // they are sitting inside. One true finding became three, two of them false, about the one
  // mistake the document actually made.
  const issues = inspectWidgetDom(timepicker(["minute", "hour"]), "timepicker", { open: true });
  assert.deepEqual(about(issues, ["hourControl", "minuteControl"]), []);
});

test("with only the minute segment drawn, the hour box is not bound to it", () => {
  const issues = inspectWidgetDom(timepicker(["minute"]), "timepicker", { open: true });
  // The minute box is where it should be, so nothing is owed about it. The hour segment is absent,
  // which is permitted, and its box is absent with it — not resolved to the minute's element, which
  // is what "the first match" answers.
  assert.deepEqual(about(issues, ["minuteControl"]), []);
  assert.equal(issues.some((i) => i.part === "hourControl" && i.code === "PART_NOT_CONTAINED"), false);
});
