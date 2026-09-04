/**
 * Every kind the catalogue declares, with the empty value its contract says it holds.
 *
 * The table itself lives in `examples/shared/scenarios`, where every demo reads it: a copy per
 * renderer is how a daterange comes to be driven with `""` — true for a text field, a string where
 * an object belongs for a range — and the page then shows a state the widget was never in. This
 * file is the shape those panels already ask for, over the one declaration.
 */
import { everyKind } from "../../shared/scenarios/every-kind.js";

/**
 * The kinds, in the order the vocabulary declares them, as `[kind, empty, presentation]`.
 *
 * The order and the triple are the panels' existing shape, kept so that lifting the table changed
 * where it is written and nothing about what is drawn.
 */
export const KINDS = everyKind.fields().map(({ kind, initial, name: _name, ...presentation }) =>
  [kind, initial, presentation]);
