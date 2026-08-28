/**
 * The catalogues that make up the contract, in one place, each saying what shape it is.
 *
 * There was no such list. Ten vocabularies, ten separate exports, and nothing anywhere saying *these
 * are the ones* — so a tool built against "the contract" read whichever it happened to reach first
 * and looked complete. That is not a hypothetical: an enumerator that knew one of them reported
 * "41 properties declared, none silent", then "eight undeclared conventions", and both were wrong,
 * because the conventions were declared in catalogues it was not reading.
 *
 * **The shape is declared, not inferred.** Asking the data what it is fails on a real case: a flat
 * dictionary is the degenerate form of a table with one column, so a rule reading "are all the values
 * objects?" gets `{ formErrors: "mdy-form__errors" }` wrong and stops covering it silently. Every
 * consumer that would otherwise guess — an enumerator, a comb, a codemod, a person writing a fourth
 * adapter — reads the shape from here.
 *
 * Adding a vocabulary is a line in this file. That is the point: a list somebody maintains by hand is
 * worse than a derivation *except* where the derivation has to guess, and here it does.
 */
import { MDY_COLOR_PRESETS } from "./behavior/color.js";
import { MDY_WIDGET_KINDS } from "./catalog/kinds.js";
import { MDY_CSS_PROPERTIES, MDY_CSS_PROPERTY_NAMES } from "./css.js";
import { MDY_CALENDAR_VIEW_MODES } from "./field/calendar-view.js";
import {
  MDY_I18N_DEFAULT_TAGS, MDY_I18N_MESSAGES_DE, MDY_I18N_MESSAGES_DEFAULT, MDY_I18N_MESSAGES_ES,
  MDY_I18N_MESSAGES_FR, MDY_I18N_MESSAGES_IT, MDY_I18N_PRESETS,
} from "./i18n.js";
import { MDY_ICONS, MDY_ICON_SPANS } from "./icons.js";
import {
  MDY_LAYOUT_BREAKPOINTS, MDY_LAYOUT_COLUMN_COUNT_PROPERTIES,
  MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES, MDY_LAYOUT_COLUMN_START_PROPERTIES,
} from "./layout.js";
import { MDY_LABELABLE_TAGS, MDY_SEMANTICS_REQUIRING_NAME } from "./relations.js";
import { MDY_STATE_MODIFIERS } from "./state.js";
import { MDY_STATE_EXPRESSION, MDY_WIDGET_STATES, MDY_WIDGET_STATE_CONTRACTS, MDY_WIDGET_STATE_SUPPORT } from "./widget-states.js";
import { MDY_CHIP_CLASSES } from "./chip.js";
import { MDY_CANONICAL_UI_CLASSES, MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "./catalog.js";
import { MDY_LAYOUT_CLASSES } from "./layout.js";
import { MDY_WIDGET_RELATIONS } from "./relations.js";
import {
  MDY_FIELD_SHELL_CLASSES,
  MDY_FIELD_SHELL_STRUCTURE,
  MDY_FIELD_STATE_CLASSES,
  MDY_FORM_SHELL_CLASSES,
  MDY_FORM_SHELL_STRUCTURE,
  MDY_SHARED_UI_CLASSES,
} from "./structure.js";

import { MDY_WIDGET_KEYBOARD, MDY_WIDGET_TRANSITIONS } from "./transitions.js";
import { MDY_EVERY_TIME } from "./time-granularity.js";
import { deepFreeze } from "./freeze.js";

/**
 * How a vocabulary is arranged, which decides how a tool may walk it.
 *
 * - `keyed-by-kind` — one entry per widget kind. A tool asking "what does this kind declare" indexes
 *   straight in; one enumerating the whole contract iterates the seventeen.
 * - `names` — a flat dictionary from a role to the class name that carries it. The keys are a
 *   vocabulary of *roles*, not of instances, so a consumer reads a name and never enumerates.
 * - `table` — keys that carry structure rather than a single name: a list of states, a nested shape.
 * - `list` — an array of names belonging to no key at all.
 * - `data` — a collection the package publishes that is **not** a vocabulary: translations, colour
 *   presets, icon paths. It is in the index for the same reason the others are — an index with a gap
 *   is one a tool trusts and should not — and it is marked so a tool sweeping *the contract* skips it
 *   without keeping a list of names to ignore, which is the hand-kept exception this index removes.
 */
export type MdyVocabularyShape = "keyed-by-kind" | "names" | "table" | "list" | "data";

export interface MdyVocabulary {
  /** The exported name, so a report can say where a finding came from. */
  readonly name: string;
  readonly shape: MdyVocabularyShape;
  /** The vocabulary itself, so a consumer reads it here rather than importing ten symbols. */
  readonly value: unknown;
  /** What it is for, in one line, for a tool that lists them to a person. */
  readonly describes: string;
  /**
   * The subpath it is published from.
   *
   * Recorded because it has already cost two mistakes: a vocabulary reachable only from
   * `./vocabulary` reads as unpublished to anybody grepping the barrel, and three of the entries
   * below were found that way — by a check, after two of us had counted them by hand and agreed on
   * the wrong number.
   */
  readonly door: "." | "./vocabulary";
}

const CATALOGUES: MdyVocabulary[] = [
  { name: "MDY_WIDGET_CONTRACTS", shape: "keyed-by-kind", value: MDY_WIDGET_CONTRACTS, door: ".",
    describes: "each kind's anatomy: its parts, where they hang, what they are and what they carry" },
  { name: "MDY_WIDGET_KEYBOARD", shape: "keyed-by-kind", value: MDY_WIDGET_KEYBOARD, door: ".",
    describes: "the keys each kind answers to, and what each one means" },
  { name: "MDY_WIDGET_RELATIONS", shape: "keyed-by-kind", value: MDY_WIDGET_RELATIONS, door: ".",
    describes: "which part refers to which, and through which attribute" },
  { name: "MDY_POPUP_OPENERS", shape: "keyed-by-kind", value: MDY_POPUP_OPENERS, door: ".",
    describes: "for a kind with an overlay: which part opens it, what it controls, what it promises" },
  { name: "MDY_FIELD_SHELL_CLASSES", shape: "names", value: MDY_FIELD_SHELL_CLASSES, door: ".",
    describes: "the shell every field shares: its root, label, wrapper, errors" },
  { name: "MDY_FIELD_STATE_CLASSES", shape: "table", value: MDY_FIELD_STATE_CLASSES, door: ".",
    describes: "the states a field's parts may wear, and the classes that say so" },
  { name: "MDY_FORM_SHELL_CLASSES", shape: "names", value: MDY_FORM_SHELL_CLASSES, door: ".",
    describes: "what a form draws around its fields" },
  { name: "MDY_FORM_SHELL_STRUCTURE", shape: "table", value: MDY_FORM_SHELL_STRUCTURE, door: ".",
    describes: "the form shell's own anatomy, the way a kind declares its parts" },
  { name: "MDY_CHIP_CLASSES", shape: "names", value: MDY_CHIP_CLASSES, door: ".",
    describes: "a chosen value drawn as a chip, and everything it carries" },
  { name: "MDY_LAYOUT_CLASSES", shape: "names", value: MDY_LAYOUT_CLASSES, door: ".",
    describes: "the boxes a declared layout arranges fields in" },
  { name: "MDY_SHARED_UI_CLASSES", shape: "list", value: MDY_SHARED_UI_CLASSES, door: ".",
    describes: "names belonging to no single kind: the shared button, the overlay machinery" },
  { name: "MDY_WIDGET_STATE_CONTRACTS", shape: "table", value: MDY_WIDGET_STATE_CONTRACTS, door: "./vocabulary",
    describes: "the states a widget may be in, and what each obliges a renderer to say" },
  { name: "MDY_FIELD_SHELL_STRUCTURE", shape: "table", value: MDY_FIELD_SHELL_STRUCTURE, door: "./vocabulary",
    describes: "the shell's own anatomy, the way a kind declares its parts" },
  { name: "MDY_CANONICAL_UI_CLASSES", shape: "list", value: MDY_CANONICAL_UI_CLASSES, door: "./vocabulary",
    describes: "every class the contract can produce, flattened for a tool that sweeps them" },
  { name: "MDY_WIDGET_TRANSITIONS", shape: "keyed-by-kind", value: MDY_WIDGET_TRANSITIONS, door: ".",
    describes: "what each kind does in answer to an intent, and what state it lands in" },
  { name: "MDY_WIDGET_KINDS", shape: "list", value: MDY_WIDGET_KINDS, door: ".",
    describes: "the seventeen kinds themselves, which every other per-kind catalogue is keyed by" },
  { name: "MDY_WIDGET_STATES", shape: "list", value: MDY_WIDGET_STATES, door: "./vocabulary",
    describes: "every state a widget may be in" },
  { name: "MDY_WIDGET_STATE_SUPPORT", shape: "keyed-by-kind", value: MDY_WIDGET_STATE_SUPPORT, door: "./vocabulary",
    describes: "which states each kind can actually be in" },
  { name: "MDY_STATE_MODIFIERS", shape: "names", value: MDY_STATE_MODIFIERS, door: "./vocabulary",
    describes: "the class suffix each state carries" },
  { name: "MDY_STATE_EXPRESSION", shape: "names", value: MDY_STATE_EXPRESSION, door: ".",
    describes: "how a state is written where a class cannot carry it" },
  { name: "MDY_CSS_PROPERTIES", shape: "table", value: MDY_CSS_PROPERTIES, door: ".",
    describes: "the custom properties a theme sets, and what each governs" },
  { name: "MDY_CSS_PROPERTY_NAMES", shape: "list", value: MDY_CSS_PROPERTY_NAMES, door: "./vocabulary",
    describes: "those property names alone, for a tool that sweeps a sheet" },
  { name: "MDY_LAYOUT_BREAKPOINTS", shape: "names", value: MDY_LAYOUT_BREAKPOINTS, door: ".",
    describes: "the sizes a declared layout may be authored against" },
  { name: "MDY_LAYOUT_COLUMN_COUNT_PROPERTIES", shape: "names", value: MDY_LAYOUT_COLUMN_COUNT_PROPERTIES, door: ".",
    describes: "the property each breakpoint reads its column count from" },
  { name: "MDY_LAYOUT_COLUMN_START_PROPERTIES", shape: "names", value: MDY_LAYOUT_COLUMN_START_PROPERTIES, door: ".",
    describes: "the property a slot's column start is written to" },
  { name: "MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES", shape: "names", value: MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES, door: ".",
    describes: "the property that hides a slot at one size" },
  { name: "MDY_CALENDAR_VIEW_MODES", shape: "list", value: MDY_CALENDAR_VIEW_MODES, door: ".",
    describes: "the views a calendar can show: days, months, years" },
  { name: "MDY_SEMANTICS_REQUIRING_NAME", shape: "list", value: MDY_SEMANTICS_REQUIRING_NAME, door: ".",
    describes: "the semantics that oblige a part to carry an accessible name" },
  { name: "MDY_LABELABLE_TAGS", shape: "list", value: MDY_LABELABLE_TAGS, door: "./vocabulary",
    describes: "the tags a <label> may point at" },
  { name: "MDY_ICONS", shape: "data", value: MDY_ICONS, door: ".",
    describes: "the icon paths this library draws with" },
  { name: "MDY_ICON_SPANS", shape: "data", value: MDY_ICON_SPANS, door: ".",
    describes: "the box each icon is drawn in" },
  { name: "MDY_COLOR_PRESETS", shape: "data", value: MDY_COLOR_PRESETS, door: ".",
    describes: "the tints a colour field offers when a document names none" },
  { name: "MDY_I18N_MESSAGES_DEFAULT", shape: "data", value: MDY_I18N_MESSAGES_DEFAULT, door: ".",
    describes: "the words every control shows, in English" },
  { name: "MDY_I18N_MESSAGES_IT", shape: "data", value: MDY_I18N_MESSAGES_IT, door: ".",
    describes: "the same words in Italian" },
  { name: "MDY_I18N_MESSAGES_DE", shape: "data", value: MDY_I18N_MESSAGES_DE, door: ".",
    describes: "the same words in German" },
  { name: "MDY_I18N_MESSAGES_FR", shape: "data", value: MDY_I18N_MESSAGES_FR, door: ".",
    describes: "the same words in French" },
  { name: "MDY_I18N_MESSAGES_ES", shape: "data", value: MDY_I18N_MESSAGES_ES, door: ".",
    describes: "the same words in Spanish" },
  { name: "MDY_I18N_PRESETS", shape: "data", value: MDY_I18N_PRESETS, door: ".",
    describes: "the bundles a consumer picks a language from" },
  { name: "MDY_I18N_DEFAULT_TAGS", shape: "data", value: MDY_I18N_DEFAULT_TAGS, door: ".",
    describes: "the language tag each bundle answers to" },
  { name: "MDY_EVERY_TIME", shape: "data", value: MDY_EVERY_TIME, door: ".",
    describes: "the step a clock advances by when a document asks for no coarser one" },
];

// The index holds its own entry. An index that omits itself publishes one collection it does not
// cover, and "everything is in the list" stops being checkable without knowing which name to excuse.
CATALOGUES.push({
  name: "MDY_CONTRACT_VOCABULARIES", shape: "list", value: CATALOGUES, door: ".",
  describes: "this index: every catalogue the contract is made of, and the shape of each",
});

export const MDY_CONTRACT_VOCABULARIES: readonly MdyVocabulary[] = deepFreeze(CATALOGUES);
