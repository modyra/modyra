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
import { MDY_WIDGET_STATE_CONTRACTS } from "./widget-states.js";
import { MDY_WIDGET_KEYBOARD } from "./transitions.js";

/**
 * How a vocabulary is arranged, which decides how a tool may walk it.
 *
 * - `keyed-by-kind` — one entry per widget kind. A tool asking "what does this kind declare" indexes
 *   straight in; one enumerating the whole contract iterates the seventeen.
 * - `names` — a flat dictionary from a role to the class name that carries it. The keys are a
 *   vocabulary of *roles*, not of instances, so a consumer reads a name and never enumerates.
 * - `table` — keys that carry structure rather than a single name: a list of states, a nested shape.
 * - `list` — an array of names belonging to no key at all.
 */
export type MdyVocabularyShape = "keyed-by-kind" | "names" | "table" | "list";

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

export const MDY_CONTRACT_VOCABULARIES: readonly MdyVocabulary[] = Object.freeze([
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
]);
