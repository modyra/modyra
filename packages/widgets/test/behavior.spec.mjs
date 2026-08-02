import assert from "node:assert/strict";
import test from "node:test";
import { colorValueEquals, colorValueTransition, dateDraftTransition, dateRangeDraftTransition, dateRangeValueTransition, dateValueTransition, dateWithinBounds, decideOverlayPlacement, fileSelectionTransition, clearFileSelection, multiselectOverlayAction, multiselectValueTransition, optionNavigationIndex, overlayCloseCommands, overlayLifecycleTransition, selectKeyboardAction, shouldCloseMultiselectOverlay, timeClockTransition, timeDraftTransition, timeInputTransition, widgetKeyIntent } from "../dist/index.js";

test("overlay placement resolves collision without a DOM dependency", () => {
  assert.equal(decideOverlayPlacement({ viewportWidth: 1000, viewportHeight: 800, anchorTop: 700, anchorBottom: 740, anchorLeft: 800, anchorRight: 900, anchorWidth: 100, minSpace: 128, minWidth: 250, preferred: "below" }).placement, "above");
  assert.deepEqual(decideOverlayPlacement({ viewportWidth: 320, viewportHeight: 240, anchorTop: 100, anchorBottom: 140, anchorLeft: 40, anchorRight: 280, anchorWidth: 240, minSpace: 128, minWidth: 250, preferred: "below" }), { placement: "overlay", alignment: "left", maxHeight: 168, width: 250, fits: true });
});
test("keyboard mapping owns navigation, commit, cancel and primitive toggles", () => {
  // Down on a *closed* combobox opens it; the list is only navigable once it is on screen. This
  // used to answer "move to the next option" for a control showing no options at all.
  assert.deepEqual(widgetKeyIntent("select", "ArrowDown", false), { type: "open" });
  assert.deepEqual(widgetKeyIntent("select", "ArrowDown", true), { type: "move", target: "next" });
  assert.deepEqual(widgetKeyIntent("select", "Escape", true), { type: "cancel", restoreFocus: true });
  assert.deepEqual(widgetKeyIntent("toggle", " ", false), { type: "toggle" });
  assert.deepEqual(overlayCloseCommands(true), [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "trigger" } }]);
});

test("option navigation resolves roving indices in Widgets", () => {
  assert.equal(optionNavigationIndex("ArrowRight", 2, 3), 0);
  assert.equal(optionNavigationIndex("ArrowLeft", 0, 3), 2);
  assert.equal(optionNavigationIndex("Home", 2, 3), 0);
  assert.equal(optionNavigationIndex("End", 0, 3), 2);
  assert.equal(optionNavigationIndex("Enter", 0, 3), null);
});

test("select keyboard policy resolves host actions without Angular", () => {
  // A closed list has nothing to move through: `ArrowDown` opens it, which is what the contract
  // states and what a user reaching for the options expects. This asserted `move` before, which is
  // an action on options nobody can see.
  assert.deepEqual(selectKeyboardAction({ key: "ArrowDown", open: false, searchFocused: false, activeKey: null, createAvailable: false }), { type: "open" });
  assert.equal(selectKeyboardAction({ key: "ArrowUp", open: false, searchFocused: false, activeKey: null, createAvailable: false }), null, "ArrowUp does not open a closed list");
  assert.deepEqual(selectKeyboardAction({ key: "ArrowDown", open: true, searchFocused: false, activeKey: null, createAvailable: false }), { type: "move", target: "next" });
  // Tab closes and lets focus continue; Escape closes and hands it back.
  assert.deepEqual(selectKeyboardAction({ key: "Tab", open: true, searchFocused: false, activeKey: null, createAvailable: false }), { type: "close", restoreFocus: false });
  assert.equal(selectKeyboardAction({ key: "Tab", open: false, searchFocused: false, activeKey: null, createAvailable: false }), null, "Tab through a closed field is not the widget's business");
  assert.deepEqual(selectKeyboardAction({ key: "Enter", open: false, searchFocused: false, activeKey: null, createAvailable: false }), { type: "open" });
  assert.deepEqual(selectKeyboardAction({ key: "Enter", open: true, searchFocused: false, activeKey: "it", createAvailable: false }), { type: "select", optionKey: "it" });
  assert.deepEqual(selectKeyboardAction({ key: "Enter", open: true, searchFocused: true, activeKey: null, createAvailable: true }), { type: "create" });
  assert.deepEqual(selectKeyboardAction({ key: "Escape", open: true, searchFocused: false, activeKey: null, createAvailable: false }), { type: "close", restoreFocus: true });
});

test("multiselect transitions own loose toggle, counters and clear", () => {
  assert.deepEqual(multiselectValueTransition([1], { type: "toggle", value: "1" }), []);
  assert.deepEqual(multiselectValueTransition(["a"], { type: "increment", value: "a" }), ["a", "a"]);
  assert.deepEqual(multiselectValueTransition(["a", "a"], { type: "decrement", value: "a" }), ["a"]);
  assert.deepEqual(multiselectValueTransition(["a"], { type: "clear" }), []);
});

test("multiselect overlay policy owns keyboard and close decisions", () => {
  assert.deepEqual(multiselectOverlayAction({ key: "Enter", open: false, query: "", activeKey: null }), { type: "open" });
  assert.deepEqual(multiselectOverlayAction({ key: "ArrowDown", open: true, query: "", activeKey: null }), { type: "move", target: "next" });
  assert.deepEqual(multiselectOverlayAction({ key: "Enter", open: true, query: "a", activeKey: "a" }), { type: "select", optionKey: "a" });
  assert.deepEqual(multiselectOverlayAction({ key: "Escape", open: true, query: "a", activeKey: null }), { type: "close", restoreFocus: true });
  assert.equal(shouldCloseMultiselectOverlay("single", 0), true);
  assert.equal(shouldCloseMultiselectOverlay("single", 1), false);
  assert.equal(shouldCloseMultiselectOverlay("multi", 0), false);
});

test("date value policy canonicalizes selections and rejects bounds violations", () => {
  assert.equal(dateWithinBounds("2026-07-27", "2026-01-01", "2026-12-31"), true);
  assert.equal(dateWithinBounds("2025-12-31", "2026-01-01", null), false);
  assert.equal(dateValueTransition({ type: "select", iso: "2026-07-27T12:00:00Z" }, "2026-01-01", "2026-12-31"), "2026-07-27");
  assert.equal(dateValueTransition({ type: "select", iso: "2027-01-01" }, null, "2026-12-31"), null);
  assert.equal(dateValueTransition({ type: "clear" }), null);
});

test("modal date draft keeps selection provisional until confirm and cancel discards it", () => {
  const closed = { committed: "2026-07-01", draft: null, open: false };
  const opened = dateDraftTransition(closed, { type: "open", committed: "2026-07-01" });
  assert.deepEqual(opened.state, { committed: "2026-07-01", draft: "2026-07-01", open: true });
  const selected = dateDraftTransition(opened.state, { type: "select", iso: "2026-07-27" });
  assert.equal(selected.state.draft, "2026-07-27");
  assert.equal(selected.commit, undefined);
  const cancelled = dateDraftTransition(selected.state, { type: "cancel" });
  assert.deepEqual(cancelled.state, { committed: "2026-07-01", draft: "2026-07-01", open: false });
  assert.equal(cancelled.restoreFocus, true);
  const confirmed = dateDraftTransition(selected.state, { type: "confirm" });
  assert.equal(confirmed.commit, "2026-07-27");
  assert.equal(confirmed.restoreFocus, true);
});

test("date range policy normalizes bounds, filters and reversed endpoints", () => {
  assert.deepEqual(dateRangeValueTransition({ start: "2026-07-27T10:00:00Z", end: "2026-07-20" }), { start: "2026-07-27", end: "2026-07-27" });
  assert.deepEqual(dateRangeValueTransition({ start: "2025-01-01", end: "2026-08-01" }, { minIso: "2026-01-01", maxIso: "2026-12-31" }), { start: null, end: "2026-08-01" });
  assert.deepEqual(dateRangeValueTransition({ start: "2026-07-27", end: "2026-07-28" }, { accepts: (iso) => !iso.endsWith("28") }), { start: "2026-07-27", end: null });
});

test("modal date range draft confirms complete ranges and cancels or rejects incomplete drafts", () => {
  const empty = { committed: { start: null, end: null }, draft: { start: null, end: null }, open: false };
  const opened = dateRangeDraftTransition(empty, { type: "open", committed: { start: "2026-07-01", end: "2026-07-02" } });
  const selected = dateRangeDraftTransition(opened.state, { type: "select", value: { start: "2026-07-27", end: "2026-07-28" } });
  const confirmed = dateRangeDraftTransition(selected.state, { type: "confirm" });
  assert.deepEqual(confirmed.commit, { start: "2026-07-27", end: "2026-07-28" });
  assert.equal(confirmed.restoreFocus, true);
  const incomplete = dateRangeDraftTransition(opened.state, { type: "select", value: { start: "2026-07-27", end: null } });
  assert.equal(dateRangeDraftTransition(incomplete.state, { type: "confirm" }).commit, undefined);
  assert.deepEqual(dateRangeDraftTransition(selected.state, { type: "cancel" }).state.draft, opened.state.committed);
});

test("time draft keeps clock selection provisional and typed input preserves invalid values", () => {
  const closed = { committed: "09:15 AM", draft: "09:15 AM", open: false };
  const opened = timeDraftTransition(closed, { type: "open", committed: null, fallback: "10:30 AM" });
  assert.equal(opened.state.draft, "10:30 AM");
  const selected = timeDraftTransition(opened.state, { type: "select", value: "11:45 AM" });
  assert.equal(selected.commit, undefined);
  assert.equal(timeDraftTransition(selected.state, { type: "confirm" }).commit, "11:45 AM");
  assert.equal(timeDraftTransition(selected.state, { type: "cancel" }).restoreFocus, true);
  assert.equal(timeInputTransition("", () => "ignored"), null);
  assert.equal(timeInputTransition("bad", () => null), undefined);
  assert.equal(timeInputTransition(" 09:30 ", (v) => v), "09:30");
});

test("time clock transition owns hour, minute, period and dial snapping", () => {
  assert.equal(timeClockTransition("09:15 AM", { type: "hour", value: 23, format: "24h" }), "11:15 PM");
  assert.equal(timeClockTransition("09:15 AM", { type: "hour", value: 0, format: "12h" }), null);
  assert.equal(timeClockTransition("09:15 AM", { type: "minute", value: 45 }), "09:45 AM");
  assert.equal(timeClockTransition("09:15 AM", { type: "period", value: "PM" }), "09:15 PM");
  assert.equal(timeClockTransition("09:15 AM", { type: "dial", field: "minute", angle: 180 }), "09:30 AM");
});

test("color value policy normalizes HEX input, preserves invalid drafts and closes presets", () => {
  assert.deepEqual(colorValueTransition({ type: "text", value: "A1b" }), { value: "#A1b", close: false, touched: false });
  assert.equal(colorValueTransition({ type: "text", value: "#12" }).value, undefined);
  assert.deepEqual(colorValueTransition({ type: "preset", value: "#4361ee" }), { value: "#4361ee", close: true, touched: true });
  assert.equal(colorValueEquals("#FFF", "#fff"), true);
});

test("file selection policy shares accept, size, count, single and clear behavior", () => {
  const png = { name: "a.png", type: "image/png", size: 10 };
  const jpg = { name: "b.jpg", type: "image/jpeg", size: 20 };
  const pdf = { name: "c.pdf", type: "application/pdf", size: 30 };
  const multi = fileSelectionTransition([png, jpg, pdf], { accept: "image/*,.pdf", multiple: true, maxFileSize: 25, maxFiles: 1 });
  assert.deepEqual(multi.accepted, [png]);
  assert.deepEqual(multi.rejected, [pdf, jpg]);
  assert.deepEqual(multi.value, [png]);
  const single = fileSelectionTransition([png, jpg], { multiple: false });
  assert.equal(single.value, png);
  assert.deepEqual(single.rejected, [jpg]);
  assert.equal(fileSelectionTransition([pdf], { accept: ".png", multiple: false }).value, undefined);
  assert.equal(clearFileSelection().value, null);
});

test("overlay lifecycle owns open, toggle, outside, escape, destroy and restoration decisions", () => {
  const closed = { open: false };
  assert.equal(overlayLifecycleTransition(closed, { type: "open", disabled: true, available: true }).effect, "none");
  const opened = overlayLifecycleTransition(closed, { type: "open", disabled: false, available: true });
  assert.deepEqual(opened, { state: { open: true }, effect: "setup", restoreFocus: false, announce: "opened" });
  assert.equal(overlayLifecycleTransition(opened.state, { type: "outside", outside: false }).effect, "none");
  assert.deepEqual(overlayLifecycleTransition(opened.state, { type: "outside", outside: true }), { state: { open: false }, effect: "teardown", restoreFocus: false, announce: "closed" });
  assert.equal(overlayLifecycleTransition(opened.state, { type: "escape" }).restoreFocus, true);
  assert.equal(overlayLifecycleTransition(opened.state, { type: "destroy" }).announce, null);
});
