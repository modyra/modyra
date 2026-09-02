/**
 * The classes a part carries, asked of the contract rather than spelled by a renderer.
 *
 * This sits between the catalog (which parts exist, what they are called, what states they may be
 * in) and the state vocabulary (how a state is spelled). Keeping it apart from both is what lets the
 * chip ask for `--selected` without the catalog having to be loaded to answer: the vocabulary
 * depends on nothing, and only this module needs to know the whole catalog.
 */
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind, type MdyWidgetPart } from "./catalog.js";
import { SHELL_CLASS_FALLBACK } from "./catalog/define.js";
import { stateClass, type MdyPartState, type MdyStateName } from "./state.js";

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
  // The same table the catalogue itself falls back to, rather than the shell's whole vocabulary by
  // name. The two disagree on one word: the shell calls `control` the **box** that holds the control
  // — `mdy-input-wrapper__inliner` — while a contract calls `control` the control. Resolving by name
  // handed a text field's input the class its container wears, so this accessor and the record it
  // reads from answered differently about the same part, and both are published.
  const shell = SHELL_CLASS_FALLBACK[part];
  return shell === undefined ? contract : { ...contract, classes: [...shell] };
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

/**
 * Escapes a name for use in a selector — a class or an id, the rule is the same.
 *
 * Exported from this module and not from the package's door: it is how a selector is built here, not
 * a question a consumer asks.
 *
 * Hand-rolled rather than `CSS.escape`, which is a browser global this package must not require:
 * this package loads and computes in a process with no DOM, and a bare `CSS.escape` reference turns
 * that into a `ReferenceError` the moment a selector is built.
 */
export function escapeForSelector(name: string): string {
  return name.replace(/[^\w-]/g, (character) => `\\${character}`);
}

/**
 * The CSS selector the contract's declared classes amount to, or `null` where it declares none.
 *
 * Moved here from the testing door, which was the only place it was published. Finding a part by its
 * classes is not a testing question — every renderer asks it, and the ones that could not import it
 * wrote the class name out as a literal instead. A selector written by hand is a copy of the
 * vocabulary no rename reaches: the class moves, the selector matches nothing, and the only symptom
 * is a part that quietly stops being found.
 *
 * `null` and not `""` for a part with no classes of its own — five controls have none. An empty
 * selector string is not "matches nothing", it is a syntax error in `querySelector`.
 *
 * `null` too for a part the kind does not have, where `partClasses` raises. A caller asking "where is
 * this part" is often sweeping every part name there is, and for that question "this kind has no such
 * part" is an answer rather than a mistake.
 */
export function partSelector<K extends MdyWidgetKind>(
  kind: K,
  part: MdyWidgetPart<K> | string,
  states: MdyPartState = {},
): string | null {
  const declared = MDY_WIDGET_CONTRACTS[kind]?.parts as Readonly<Record<string, unknown>> | undefined;
  if (declared?.[part as string] === undefined) return null;
  const classes = partClasses(kind, part as MdyWidgetPart<K>, states);
  if (classes.length === 0) return null;
  return classes.map((name) => `.${escapeForSelector(name)}`).join("");
}

/**
 * The class of one of a widget's presentation elements.
 *
 * The third door of the class contract, and the one that answers for what a widget draws that is not
 * a part: a box, a decoration, a sizer. A part carries a semantic — the contract says which element
 * it admits and refuses one with no opinion — and these carry none, which is exactly why they are
 * declared apart rather than promoted.
 *
 * Keyed rather than listed, and that is the whole of the change this accessor exists for: reached by
 * index, every entry was a position instead of a thing, and a renderer asking for one would have
 * depended on the order of a literal it did not write. A name says what the class is; an index says
 * where it happened to sit.
 */
export function presentationClass<K extends MdyWidgetKind>(kind: K, name: string): string {
  const declared = MDY_WIDGET_CONTRACTS[kind]?.presentationClasses;
  if (declared === undefined) {
    throw new RangeError(`[modyra] No widget "${kind}" — its presentation classes cannot be asked for.`);
  }
  const found = declared[name];
  if (found === undefined) {
    // Named rather than empty: a renderer asking for a presentation element the kind does not have
    // is a renderer drawing something the contract has not agreed to, and an empty string would put
    // it on the page with no class and no complaint.
    throw new RangeError(
      `[modyra] Widget "${kind}" declares no presentation element "${name}". It has: ` +
      `${Object.keys(declared).join(", ") || "none"}.`,
    );
  }
  return found;
}
