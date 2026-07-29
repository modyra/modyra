/**
 * The classes a part carries, asked of the contract rather than spelled by a renderer.
 *
 * This sits between the catalog (which parts exist, what they are called, what states they may be
 * in) and the state vocabulary (how a state is spelled). Keeping it apart from both is what lets the
 * chip ask for `--selected` without the catalog having to be loaded to answer: the vocabulary
 * depends on nothing, and only this module needs to know the whole catalog.
 */
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind, type MdyWidgetPart } from "./catalog.js";
import { stateClass, type MdyPartState, type MdyStateName } from "./state.js";
import { MDY_FIELD_SHELL_CLASSES } from "./structure.js";

interface ResolvedPart {
  readonly classes: readonly string[];
  readonly states?: readonly MdyStateName[];
}

/**
 * A part's classes as it will actually appear, shell fallback included.
 *
 * A widget only names the parts it makes its own — a select's trigger, a calendar's cell. The rest
 * of a field is the shell every field shares, and its classes live in `MDY_FIELD_SHELL_CLASSES`
 * rather than being restated seventeen times in the catalog. A state on `inputWrapper` still has to
 * land on `mdy-input-wrapper`, so resolving the two together is what makes "the classes this part
 * carries" a question with one answer.
 */
function resolvePart(kind: MdyWidgetKind, part: string): ResolvedPart {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const contract = (definition.parts as Readonly<Record<string, ResolvedPart | undefined>>)[part];
  if (!contract) throw new RangeError(`Widget "${kind}" has no part "${part}".`);
  if (contract.classes.length > 0) return contract;
  const shell = (MDY_FIELD_SHELL_CLASSES as Readonly<Record<string, string | undefined>>)[part];
  return shell === undefined ? contract : { ...contract, classes: [shell] };
}

/**
 * The classes a part carries right now: what it is, then what it is doing.
 *
 * Throws when asked for a state the part does not declare. That is a contract violation rather than
 * a styling accident — a renderer reaching for `--focused` on a part whose theme rule is `--active`
 * has invented vocabulary, and the point of naming states was to stop exactly that from being
 * possible to do quietly.
 */
export function partClasses<K extends MdyWidgetKind>(
  kind: K,
  part: MdyWidgetPart<K>,
  states: MdyPartState = {},
): readonly string[] {
  const contract = resolvePart(kind, String(part));
  const classes = [...contract.classes];
  const base = classes[0];
  const declared = contract.states ?? [];
  for (const [name, on] of Object.entries(states) as ReadonlyArray<[MdyStateName, boolean | undefined]>) {
    if (!on) continue;
    if (!declared.includes(name)) {
      throw new RangeError(`Part "${String(part)}" of widget "${kind}" does not declare the state "${name}".`);
    }
    // A part with no class of its own has nothing to hang a modifier on. Declaring a state on such a
    // part is the mistake; saying so is more useful than emitting `undefined--selected`.
    if (base === undefined) throw new RangeError(`Part "${String(part)}" of widget "${kind}" has no class to carry the state "${name}".`);
    classes.push(stateClass(base, name));
  }
  return Object.freeze(classes);
}

/** The states a part declares, for a conformance runner or an audit. */
export function partStates<K extends MdyWidgetKind>(kind: K, part: MdyWidgetPart<K>): readonly MdyStateName[] {
  return resolvePart(kind, String(part)).states ?? [];
}

/**
 * Every class the contract can produce for a widget: its parts, and every state each part declares.
 *
 * This is what an audit compares the shipped CSS against — a theme rule for a class this set does
 * not contain is a rule matching nothing, and a renderer emitting one is a renderer off contract.
 */
export function widgetStateClasses(kind: MdyWidgetKind): readonly string[] {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const out = new Set<string>(definition.rootClasses);
  for (const name of Object.keys(definition.parts)) {
    const contract = resolvePart(kind, name);
    for (const className of contract.classes) out.add(className);
    const base = contract.classes[0];
    if (base === undefined) continue;
    for (const state of contract.states ?? []) out.add(stateClass(base, state));
  }
  return Object.freeze([...out].sort());
}
