/**
 * The scenarios every demo renders, declared once.
 *
 * A demo answers two questions and they belong to different people: *what is this form* — which
 * fields, which kinds, which words, which rules — and *how does this framework mount it*. The first
 * is the same everywhere and is written here; the second is idiomatic and stays in each demo. Split
 * the other way round, four pages drift into four different products wearing one name, and no report
 * about "the invoices example" means the same thing twice.
 *
 * It is the argument `legend.js` already makes for the words above a panel — one declaration, every
 * reader — made for the fields below them. Where it differs: a legend can read the page and the
 * contract and invent nothing, while a scenario is content, and content has to be stated.
 *
 * **What a scenario does not say**: markup, classes, ARIA, or which element a kind is drawn as.
 * Those are the contract's answers, and a demo that wrote them by hand would be the thing this
 * library exists to stop — which is what the Vue demo was doing on the day this was written, hand-
 * rolling `aria-invalid` beside a package that ships seventeen components deriving it.
 */
import { MDY_FIELD_KINDS } from "@modyra/core";
import { aDelivery } from "./a-delivery.js";
import { everyKind } from "./every-kind.js";

/**
 * The catalogue, kept apart from the stories on purpose.
 *
 * Coverage and narrative are different jobs. Asking one scenario to do both is how a colour picker
 * ends up in a checkout to fill a box.
 */
export const CATALOGUE_SCENARIOS = Object.freeze([everyKind]);

/**
 * The scenarios with something to accomplish. Each arrives as its own unit; the set is deliberately
 * short, because an example nobody finishes reading teaches nothing.
 */
export const STORY_SCENARIOS = Object.freeze([aDelivery]);

export const SCENARIOS = Object.freeze([...CATALOGUE_SCENARIOS, ...STORY_SCENARIOS]);

/** Every kind a scenario puts on a page, without duplicates. */
export function kindsCovered(scenarios = SCENARIOS) {
  return [...new Set(scenarios.flatMap((scenario) => scenario.fields().map((field) => field.kind)))];
}

/**
 * How many of the scenarios with a story each kind appears in.
 *
 * Reported, never enforced. "Which kinds also live inside something somebody would actually do" is
 * worth reading, and it is not worth forcing: a kind pushed into a story to raise this number would
 * make the story worse and the number meaningless. If the bar is ever raised, it will be raised
 * against a figure that was already being watched.
 */
export function storyCoverage(scenarios = STORY_SCENARIOS) {
  const counts = new Map(MDY_FIELD_KINDS.map((kind) => [kind, 0]));
  for (const scenario of scenarios) {
    for (const kind of new Set(scenario.fields().map((field) => field.kind))) {
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Refused at import, in every demo that reads this, rather than by a test somebody may not run.
 *
 * The set is the page a reader is shown; a kind the vocabulary declares and no scenario draws is a
 * control that silently is not there, and the absent one is the one nobody thinks to look for. The
 * check runs in both directions because both go wrong: a kind added to the vocabulary with nowhere
 * to appear, and a scenario naming a kind that no longer exists.
 */
const covered = new Set(kindsCovered());
const missing = MDY_FIELD_KINDS.filter((kind) => !covered.has(kind));
const unknown = [...covered].filter((kind) => !MDY_FIELD_KINDS.includes(kind));
if (missing.length > 0) {
  throw new Error(`[scenarios] no scenario draws: ${missing.join(", ")}`);
}
if (unknown.length > 0) {
  throw new Error(`[scenarios] a scenario draws a kind the vocabulary does not declare: ${unknown.join(", ")}`);
}
