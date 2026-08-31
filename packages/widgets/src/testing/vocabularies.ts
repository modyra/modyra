/**
 * The catalogues this door publishes, in one place, each saying what shape it is.
 *
 * The contract's own index lives beside the contract and names what a consumer reads to *build* a
 * renderer. It does not name these, and it must not: the door they come through carries fixtures and
 * comparison tables, and reaching them from the main barrel would put every one of them in the bundle
 * of somebody who only wanted to draw a field.
 *
 * So there are two indexes and no third list. A tool walking a door reads that door's index; nothing
 * published anywhere is indexed nowhere; and neither index needs an exemption ledger naming what the
 * other one covers — a ledger is the thing that goes stale silently, and two of them once hid five
 * undeclared classes between them.
 *
 * What these are for: they are the tables the adapters' own conformance fixtures compare against, so
 * that "the same actions" means the same thing in each. A fourth adapter's author needs them exactly
 * as much as the contract's own catalogues, which is why they are indexed rather than merely present.
 */
import { MDY_CALENDAR_ISSUE } from "./calendar.js";
import { MDY_SEMANTIC_ELEMENTS } from "./dom-tests.js";
import {
  MDY_CANONICAL_AFTER_ESCAPE, MDY_CANONICAL_AT_REST, MDY_CANONICAL_DISABLED, MDY_CANONICAL_EMPTY,
  MDY_CANONICAL_FILLED, MDY_CANONICAL_FILLED_OBSERVATION, MDY_CANONICAL_INVALID, MDY_CANONICAL_OPEN,
} from "./canonical.js";
import { MDY_LIFECYCLE_ISSUE, MDY_LIFECYCLE_TRANSITIONS } from "./lifecycle.js";
import { MDY_PAINT_BEATS } from "./paint-beat.js";

/** What a catalogue is shaped like, in the same words the contract's index uses. */
export interface MdyTestingVocabulary {
  readonly name: string;
  readonly shape: "list" | "names" | "keyed-by-kind" | "table" | "data";
  readonly value: unknown;
  readonly door: "./testing";
}

export const MDY_TESTING_VOCABULARIES: readonly MdyTestingVocabulary[] = [
  { name: "MDY_CALENDAR_ISSUE", shape: "names", value: MDY_CALENDAR_ISSUE, door: "./testing" },
  { name: "MDY_CANONICAL_AFTER_ESCAPE", shape: "keyed-by-kind", value: MDY_CANONICAL_AFTER_ESCAPE, door: "./testing" },
  { name: "MDY_CANONICAL_AT_REST", shape: "keyed-by-kind", value: MDY_CANONICAL_AT_REST, door: "./testing" },
  { name: "MDY_CANONICAL_DISABLED", shape: "keyed-by-kind", value: MDY_CANONICAL_DISABLED, door: "./testing" },
  { name: "MDY_CANONICAL_EMPTY", shape: "keyed-by-kind", value: MDY_CANONICAL_EMPTY, door: "./testing" },
  { name: "MDY_CANONICAL_FILLED", shape: "keyed-by-kind", value: MDY_CANONICAL_FILLED, door: "./testing" },
  { name: "MDY_CANONICAL_FILLED_OBSERVATION", shape: "keyed-by-kind", value: MDY_CANONICAL_FILLED_OBSERVATION, door: "./testing" },
  { name: "MDY_CANONICAL_INVALID", shape: "keyed-by-kind", value: MDY_CANONICAL_INVALID, door: "./testing" },
  { name: "MDY_CANONICAL_OPEN", shape: "keyed-by-kind", value: MDY_CANONICAL_OPEN, door: "./testing" },
  { name: "MDY_LIFECYCLE_ISSUE", shape: "names", value: MDY_LIFECYCLE_ISSUE, door: "./testing" },
  { name: "MDY_LIFECYCLE_TRANSITIONS", shape: "list", value: MDY_LIFECYCLE_TRANSITIONS, door: "./testing" },
  { name: "MDY_PAINT_BEATS", shape: "list", value: MDY_PAINT_BEATS, door: "./testing" },
  { name: "MDY_SEMANTIC_ELEMENTS", shape: "table", value: MDY_SEMANTIC_ELEMENTS, door: "./testing" },
];
