/**
 * The behaviour a widget has, by domain.
 *
 * This was one file of eight hundred lines and fifty-two exports, holding overlay geometry, keyboard
 * mapping, listbox navigation, select, multiselect, dates, ranges, time, colour, files and the
 * overlay lifecycle — grouped by "is pure and is not a controller", which is not a domain. Nothing in
 * it shared state with anything else in it.
 *
 * Re-exported here so the surface is unchanged: a consumer importing from `@modyra/widgets` cannot
 * tell this happened, which is the point of doing it as its own step.
 */
export * from "./behavior/overlay-placement.js";
export * from "./behavior/keys.js";
export * from "./behavior/select.js";
export * from "./behavior/multiselect.js";
export * from "./behavior/date.js";
export * from "./behavior/date-range.js";
export * from "./behavior/time.js";
export * from "./behavior/color.js";
export * from "./behavior/file.js";
export * from "./behavior/overlay-lifecycle.js";
