/**
 * Reading a document that arrived from somewhere else.
 *
 * Every function here takes `unknown` and answers with a value plus the diagnostics that explain
 * what it refused. A malformed document produces a report, never a throw and never a partially
 * built form — the caller decides whether a lenient result is good enough.
 */

import {
  expressionContextKeys,
  expressionPaths,
  validateExpression,
  type MdyExpression,
} from "../expression.js";
import {
  MDY_ID_DELIMITER,
  MDY_MAX_DYNAMIC_PATH_LENGTH,
  MDY_MAX_DYNAMIC_PATTERN_LENGTH,
  collectingDiagnostics,
  isFiniteNumber,
  isIsoDate,
  isRecordValue,
  hasInvisibleCharacters,
  isSafeDynamicName,
  isSafeDynamicSegment,
  warnDev,
} from "./guards.js";
import { MDY_DYNAMIC_MEMBERS, unknownMembers } from "./members.js";
import { dynamicPatternRefusal } from "./pattern-cost.js";
import { explainValueMismatch, type MdyValueKind } from "../value-contracts.js";
import { MDY_FIELD_KINDS } from "../field-kinds.js";
import { required } from "../validators.js";
import { mdyEmptyValueFor } from "./schema.js";
import type { MdySelectOption } from "../types.js";

import {
  MDY_DYNAMIC_FIELD_KINDS,
  type MdyDynamicCalendarOptions,
  type MdyDynamicCollection,
  type MdyDynamicFlatForm,
  type MdyDynamicField,
  type MdyDynamicNode,
  type MdyDynamicGroupNode,
  type MdyDynamicValidators,
  type MdyDynamicNumberField,
} from "./schema.js";

/**
 * Versioned envelope for storing a dynamic form config in a CMS/backend.
 * Bump `version` when the field shape changes incompatibly and migrate in
 * your own loader before calling {@link parseDynamicFields}.
 */
export interface MdyDynamicFormConfig {
  readonly version: 1;
  readonly fields: ReadonlyArray<MdyDynamicField>;
}

export type MdyDynamicRuleOperator =
  | "equals" | "notEquals" | "in" | "notIn"
  | "isEmpty" | "isNotEmpty"
  | "greaterThan" | "greaterThanOrEqual"
  | "lessThan" | "lessThanOrEqual";

export interface MdyDynamicRule {
  readonly effect: "visible" | "hidden" | "enabled" | "disabled";
  readonly target: string;
  readonly when: {
    readonly field: string;
    readonly operator: MdyDynamicRuleOperator;
    readonly value?: unknown;
  };
}

/**
 * Where a slot sits and whether it shows, at one size.
 *
 * `column` is 1-based, matching how a grid line is spoken about and how CSS numbers its tracks; a
 * value past the row's track count is refused rather than clamped, because silently moving a field
 * to a column the author did not choose is worse than saying the layout is wrong.
 */
export interface MdyDynamicSlotPlacement {
  readonly column?: number;
  readonly hidden?: boolean;
}

/**
 * Contract v3's slot: a child that says more than its name.
 *
 * A bare string still means "this field, wherever the row puts it". A slot names the same field and
 * adds where it sits and whether it shows, per size — the two things `at` on the row cannot express,
 * because a track count describes the row while these describe one child of it.
 */
export interface MdyDynamicLayoutSlot {
  readonly ref: string;
  /** Only inside a `columns` row: the column is the element a placement can act on. */
  readonly at?: Partial<Readonly<Record<MdyDynamicBreakpoint, MdyDynamicSlotPlacement>>>;
}

/**
 * A slot in a layout node: a field name, a v3 slot describing that field's placement, or a nested
 * layout node — so a two-column row can live inside a section, which is what a real form needs and
 * what every mainstream form builder expresses.
 */
export type MdyDynamicLayoutChild = string | MdyDynamicLayoutSlot | MdyDynamicLayoutNode;

export interface MdyDynamicSection {
  readonly kind: "section";
  readonly id: string;
  readonly label?: string;
  readonly children: ReadonlyArray<MdyDynamicLayoutChild>;
  /**
   * Only inside a `columns` row, and read exactly as a slot's: the column is the element a placement
   * acts on, and a section occupying one is a column like any other.
   *
   * A group compiles to a section, so without this the one thing that could not be laid out for a
   * screen size was a group — the thing most worth laying out for one.
   */
  readonly at?: Partial<Readonly<Record<MdyDynamicBreakpoint, MdyDynamicSlotPlacement>>>;
}

/**
 * The sizes a row can be authored against, as data rather than a union spelled at each site that
 * checks it.
 *
 * A document declares placements against these names and a renderer paints them, so the two sets
 * have to be the same or a document can author a size nothing draws. The set is declared here —
 * the lowest layer both reach — and the widget contract derives its breakpoints from it, which is
 * what makes adding a fourth size a compile error on the side that would otherwise stay silent.
 */
export type MdyDynamicBreakpoint = "base" | "sm" | "md" | "lg";

/**
 * A record rather than a list, so a size dropped here is a missing key and not a shorter array that
 * still type-checks. The constraint sits inside `Object.freeze` because a literal handed to a call
 * is no longer fresh, and an annotation on the binding would then accept a key the union has
 * dropped — catching a size added and missing one removed.
 *
 * The union stays spelled out because it is the published shape, and a shape read through an
 * inferred alias is one an external differ can no longer resolve.
 */
const MDY_DYNAMIC_BREAKPOINTS = Object.freeze({
  base: true,
  sm: true,
  md: true,
  lg: true,
} satisfies Readonly<Record<MdyDynamicBreakpoint, true>>);

const isBreakpoint = (size: string): boolean => Object.hasOwn(MDY_DYNAMIC_BREAKPOINTS, size);

export interface MdyDynamicColumns {
  readonly kind: "columns";
  readonly id: string;
  readonly columns: ReadonlyArray<ReadonlyArray<MdyDynamicLayoutChild>>;
  /**
   * How many tracks the row shows at each size. Omitted sizes inherit the next smaller one, and a
   * row that says nothing stacks on a phone and takes its declared tracks from `sm` up — which is
   * what every row did before this was authorable.
   */
  readonly at?: Partial<Readonly<Record<MdyDynamicBreakpoint, number>>>;
}

export type MdyDynamicLayoutNode = MdyDynamicSection | MdyDynamicColumns;

/** The most tracks a row may declare. Beyond this a row is not a layout, it is a table. */
const MDY_MAX_LAYOUT_COLUMNS = 12;

/** Depth cap for nested layout, mirroring the schema's own guard against hostile input. */
export const MDY_LAYOUT_MAX_DEPTH = 6;

/**
 * Calendar presentation coming from a config file rather than from typed code.
 *
 * The locale is checked because a malformed tag does not degrade — `Intl` throws a `RangeError`,
 * and a config that reached a renderer with `"en_US"` in it would take the form down at mount
 * rather than render an approximate calendar.
 */
function hasValidCalendarOptions(field: Partial<MdyDynamicCalendarOptions>, name: string): boolean {
  if (field.locale !== undefined) {
    let usable = typeof field.locale === "string";
    if (usable) {
      try {
        Intl.getCanonicalLocales(field.locale as string);
      } catch {
        usable = false;
      }
    }
    if (!usable) {
      warnDev(`Dropped dynamic field "${name}": locale must be a valid BCP 47 tag, e.g. "it-IT".`);
      return false;
    }
  }
  if (field.firstDayOfWeek !== undefined) {
    const day = field.firstDayOfWeek;
    if (!isFiniteNumber(day) || !Number.isInteger(day) || day < 0 || day > 6) {
      warnDev(`Dropped dynamic field "${name}": firstDayOfWeek must be an integer from 0 (Sunday) to 6.`);
      return false;
    }
  }
  for (const bound of ["minDate", "maxDate"] as const) {
    if (field[bound] !== undefined && !isIsoDate(field[bound])) {
      warnDev(`Dropped dynamic field "${name}": ${bound} must be an ISO date, e.g. "2026-08-02".`);
      return false;
    }
  }
  if (field.minDate !== undefined && field.maxDate !== undefined && field.minDate > field.maxDate) {
    warnDev(`Dropped dynamic field "${name}": minDate cannot be later than maxDate.`);
    return false;
  }
  return true;
}

/**
 * A comparable spelling of an option's value.
 *
 * A value may be a scalar or an object keyed by what it holds (ADR 0051), and two objects declaring
 * the same members are the same option however they were written — so the key is the members in a
 * fixed order rather than the reference.
 */
function optionValueKey(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? String(value);
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, held]) => `${JSON.stringify(key)}:${optionValueKey(held)}`);
  return `{${entries.join(",")}}`;
}

function hasValidOptions(options: unknown): options is ReadonlyArray<MdySelectOption<unknown>> {
  if (!Array.isArray(options)) return false;
  return options.every((option) => {
    if (typeof option !== "object" || option === null) return false;
    const candidate = option as Partial<MdySelectOption<unknown>>;
    if (!("value" in candidate)) return false;
    // The shapes the published schema allows: a scalar, or an object keyed by what it holds
    // (ADR 0051, which is why an object is a legitimate option value and not a mistake).
    //
    // `null` is refused because it is the empty value of half the kinds — an option meaning "nothing"
    // cannot be told apart from no choice at all. An array is refused because the schema an author's
    // editor checks against does not allow one, and a document the editor underlines while the
    // runtime accepts is a document whose two readers disagree.
    const value = candidate.value;
    if (value === null || Array.isArray(value)) return false;
    if (!["string", "number", "boolean", "object"].includes(typeof value)) return false;
    if (typeof candidate.label !== "string") return false;
    if (
      candidate.disabled !== undefined &&
      typeof candidate.disabled !== "boolean"
    ) {
      return false;
    }
    return true;
  });
}

/** The rules a field declares, and so the only keys its messages may name. */
const MDY_VALIDATOR_MESSAGE_KEYS: ReadonlySet<string> = new Set([
  "required", "email", "min", "max", "minLength", "maxLength", "pattern",
]);

function hasValidValidatorConfig(
  validators: unknown,
  fieldName: string,
): validators is MdyDynamicValidators {
  if (validators === undefined) return true;
  if (typeof validators !== "object" || validators === null) {
    warnDev(
      `Dropped dynamic field "${fieldName}": validators must be an object.`,
    );
    return false;
  }
  const config = validators as Partial<MdyDynamicValidators>;
  const boolKeys = ["required", "email"] as const;
  for (const key of boolKeys) {
    const value = config[key];
    if (value !== undefined && typeof value !== "boolean") {
      warnDev(
        `Dropped dynamic field "${fieldName}": validators.${key} must be a boolean.`,
      );
      return false;
    }
  }
  const numberKeys = ["min", "max", "minLength", "maxLength"] as const;
  for (const key of numberKeys) {
    const value = config[key];
    if (value !== undefined && !isFiniteNumber(value)) {
      warnDev(
        `Dropped dynamic field "${fieldName}": validators.${key} must be a finite number.`,
      );
      return false;
    }
  }
  // The words an author wrote for their own rules. Checked like everything else a document declares:
  // a message that is not a string is a sentence nobody can read, which is the thing this slot exists
  // to prevent.
  if (config.messages !== undefined) {
    if (!isRecordValue(config.messages)) {
      warnDev(`Dropped dynamic field "${fieldName}": validators.messages must be an object.`);
      return false;
    }
    for (const [key, said] of Object.entries(config.messages)) {
      if (!MDY_VALIDATOR_MESSAGE_KEYS.has(key)) {
        warnDev(
          `Dropped dynamic field "${fieldName}": validators.messages names "${key}", which is not a ` +
          "rule a field declares.",
        );
        return false;
      }
      if (typeof said !== "string" || said.trim() === "") {
        warnDev(
          `Dropped dynamic field "${fieldName}": validators.messages.${key} must be a message a ` +
          "person can read.",
        );
        return false;
      }
    }
  }
  if (
    config.minLength !== undefined &&
    config.maxLength !== undefined &&
    config.minLength > config.maxLength
  ) {
    warnDev(
      `Dropped dynamic field "${fieldName}": validators.minLength cannot exceed validators.maxLength.`,
    );
    return false;
  }
  if (config.pattern !== undefined) {
    if (typeof config.pattern !== "string") {
      warnDev(
        `Dropped dynamic field "${fieldName}": validators.pattern must be a string.`,
      );
      return false;
    }
    if (config.pattern.length > MDY_MAX_DYNAMIC_PATTERN_LENGTH) {
      warnDev(
        `Dropped dynamic field "${fieldName}": validators.pattern length exceeds max ${MDY_MAX_DYNAMIC_PATTERN_LENGTH}.`,
      );
      return false;
    }
    // Reported where the document is read, and the field stays: one rule the engine will not run is
    // not a reason to take an input away from the person filling the form. The rule itself is
    // refused where validators are built, which is the only place that can refuse it for every
    // caller rather than only for this parse.
    const refusal = dynamicPatternRefusal(config.pattern);
    if (refusal !== null) {
      warnDev(
        `Dropped validators.pattern on dynamic field "${fieldName}": the pattern has ${refusal}.`,
      );
    } else {
      // And one the platform cannot compile at all. The cost gate above answers about a pattern that
      // runs too long; `[` does not run: the validator is skipped where it is built, and a document
      // carrying it passed strict mode with nothing said — a publishing gate approving a rule that
      // will never exist.
      try {
        new RegExp(config.pattern);
      } catch {
        warnDev(
          `Dropped validators.pattern on dynamic field "${fieldName}": "${config.pattern}" is not a ` +
          "regular expression this platform can compile, so the rule never runs.",
        );
      }
    }
  }
  return true;
}

/**
 * The fields a nested schema flattens to, and the collections that flattening walked through.
 *
 * A path cannot say which it came from: `lines.0` reads as the key `"0"` whether the document
 * declared an array or a record keyed by digits. Reporting the collections alongside the fields is
 * what lets a consumer rebuild the shape the document declared instead of guessing it — and
 * guessing is the one thing that cannot be made safe, because both readings are legitimate.
 */
/**
 * How many fields a schema says it has, counted without trusting it.
 *
 * Read off the raw object over an explicit stack, because this runs on a document the validator may
 * have already refused: it must not recurse on a shape it was handed, and it must not assume any
 * node is well formed. A node that is neither a field nor a container it can descend counts as one
 * declaration — something was written there, and it did not become a field.
 */
function declaredFieldCount(schema: unknown): { count: number; complete: boolean } {
  let count = 0;
  const stack: unknown[] = [schema];
  let complete = true;
  // A bound, because the count is taken from a raw object rather than from a validated one, and a
  // walk over a shape nothing has checked must be able to stop. It is an order of magnitude above
  // the size at which a saturating count first reported a document as having lost a fifth of what it
  // lost, and when the walk does stop the counts say so rather than passing a floor off as a total.
  for (let steps = 0; stack.length > 0; steps += 1) {
    if (steps >= MDY_MAX_DECLARATION_WALK) { complete = false; break; }
    const node = stack.pop();
    if (!isRecordValue(node)) continue;
    const kind = node["node"];
    if (kind === "field") { count += 1; continue; }
    if (kind === "group") {
      const children = node["children"];
      if (isRecordValue(children)) stack.push(...Object.values(children));
      else count += 1;
      continue;
    }
    // A collection is *understood*, not lost — it is reported by path and kind in `collections` — and
    // what is inside it is not nothing: a cell is declared, and it legitimately never becomes a flat
    // field because a document cannot name rows that do not exist yet. The pair is the one place
    // that says it was declared at all, so the walk descends and the collection itself counts as
    // neither.
    if (kind === "array" || kind === "record") { stack.push(node["item"]); continue; }
    // Something was declared here and it is not a node this reader knows.
    count += 1;
  }
  return { count, complete };
}

/**
 * How many declarations the count will walk before it stops.
 *
 * A document at this size is refused for every other reason before its counts matter; the number is
 * here so that a shape nothing has validated cannot make the walk run without end.
 */
const MDY_MAX_DECLARATION_WALK = 100_000;

export function flattenDynamicForm(schema: MdyDynamicGroupNode): {
  readonly fields: MdyDynamicField[];
  readonly collections: MdyDynamicCollection[];
} {
  const fields: MdyDynamicField[] = [];
  const collections: MdyDynamicCollection[] = [];
  /**
   * The row templates, keyed by the item node.
   *
   * Keyed by node so a collection inside a row is flattened once and not once per row — the shape
   * belongs to the node, and a list of a thousand rows would otherwise pay for the same template a
   * thousand times. The queue keeps the templates a flat piece of work: a document nests as deep as
   * it likes, and a walk that descended into each item as it met it would spend the stack the
   * iterative walk below exists to protect.
   */
  const templates = new Map<MdyDynamicNode, { fields: MdyDynamicField[]; collections: MdyDynamicCollection[] }>();
  const queue: MdyDynamicNode[] = [];
  const templateOf = (item: MdyDynamicNode): MdyDynamicFlatForm => {
    const held = templates.get(item);
    if (held) return held;
    // Handed out empty and filled when the queue reaches it: a template is a row's shape, and an
    // item that reaches itself is answered rather than followed forever.
    const fresh = { fields: [] as MdyDynamicField[], collections: [] as MdyDynamicCollection[] };
    templates.set(item, fresh);
    queue.push(item);
    return fresh;
  };

  flattenNode(schema, fields, collections, templateOf);
  while (queue.length > 0) {
    const item = queue.pop()!;
    const held = templates.get(item)!;
    flattenNode(item, held.fields, held.collections, templateOf);
  }
  return { fields, collections };
}

/** The walk itself: one node's subtree into the flat pair, with row templates asked for by node. */
function flattenNode(
  root: MdyDynamicNode,
  out: MdyDynamicField[],
  collections: MdyDynamicCollection[],
  templateOf: (item: MdyDynamicNode) => MdyDynamicFlatForm,
): void {
  /**
   * An explicit stack, for the reason the validator has one: a document is untrusted and its nesting
   * has no cap, so a recursive walk lets the document decide how much stack to use. A `RangeError`
   * carries no path, cannot be caught by name and looks exactly like a bug in the caller's own code
   * — the parser's own answer for a document it cannot carry is a diagnostic.
   *
   * Children are pushed in reverse so they come off in the order the document declares them: the
   * flat list a consumer reads is in document order, and a form built from it renders in that order.
   */
  const pending: Array<{ node: MdyDynamicNode; path: string; initial: unknown }> = [
    { node: root, path: "", initial: undefined },
  ];
  while (pending.length > 0) {
    const { node, path, initial } = pending.pop()!;
    if (node.node === "field") {
      if (path.length > MDY_MAX_DYNAMIC_PATH_LENGTH) {
        warnDev(
          `Dropped a dynamic field whose path is ${path.length} characters, past the ` +
          `${MDY_MAX_DYNAMIC_PATH_LENGTH} a path may be: a path is the payload key, the draft key ` +
          "and the widget id, and every read of the value carries it.",
          "/schema",
        );
        continue;
      }
      const candidate = { ...node.field, name: path, initialValue: initial ?? node.field.initialValue } as MdyDynamicField;
      // Generated dotted/index paths are trusted structure; validate the leaf with
      // a temporary safe name, then restore the generated path.
      const parsed = parseDynamicFields([{ ...candidate, name: "leaf" }]);
      if (parsed[0]) out.push({ ...parsed[0], name: path } as MdyDynamicField);
      continue;
    }
    if (node.node === "group") {
      const value = isRecordValue(initial) ? initial : {};
      const entries = Object.entries(node.children).filter(([key]) => isSafeDynamicName(key));
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, child] = entries[index]!;
        pending.push({ node: child, path: path ? `${path}.${key}` : key, initial: value[key] });
      }
      continue;
    }
    if (node.node === "record") {
      collections.push({ path, kind: "record", item: templateOf(node.item) });
      const declared = isRecordValue(initial)
        ? initial
        : isRecordValue(node.initialValue) ? node.initialValue : {};
      // The key is a path segment like any other, and an unsafe one addresses something else. A row
      // key becomes part of a widget id here, so the whole name rule applies to it: flattened with
      // only the prototype half checked, `rows.  .cell` reached the flat builder, which refuses it —
      // and the same document built through the tree, where a row key is data and never a name.
      const rows = Object.entries(declared).filter(([key]) => isSafeDynamicName(key));
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const [key, row] = rows[index]!;
        pending.push({ node: node.item, path: path ? `${path}.${key}` : key, initial: row });
      }
      continue;
    }
    collections.push({ path, kind: "array", item: templateOf(node.item) });
    const rows = Array.isArray(initial) ? initial : Array.isArray(node.initialValue) ? node.initialValue : [];
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      pending.push({ node: node.item, path: `${path}.${index}`, initial: rows[index] });
    }
  }
}

/** The fields alone — {@link flattenDynamicForm} also reports the collections they came from. */
export function flattenDynamicSchema(schema: MdyDynamicGroupNode): MdyDynamicField[] {
  return flattenDynamicForm(schema).fields;
}


/**
 * Whether `path` names something a validation may read or attach to.
 *
 * Wider than a rule's field reference, and deliberately: a rule fires an effect on one control, so
 * it names a leaf. A validation is about a *relationship*, and the thing it is about is often a
 * group or an array — "the basket must not be empty" is a condition on `items`, which is not a leaf
 * and never appears in the flattened field list. Accepting only leaves rejected exactly the
 * cross-field rules the slot exists to carry.
 */
function validValidationPath(path: unknown, names: ReadonlySet<string>): boolean {
  if (typeof path !== "string" || path === "") return false;
  if (names.has(path)) return true;
  // A container: something in the form lives underneath it.
  const prefix = `${path}.`;
  for (const name of names) if (name.startsWith(prefix)) return true;
  return false;
}

/**
 * A cross-field rule that produces an error message.
 *
 * Separate from {@link MdyDynamicRule} rather than a fifth `effect` on it, because the two carry
 * different things: a rule fires an effect on a field it names, while a validation carries a
 * *message* and needs a tree — "shipping is required when the country is not IT and the total is
 * over 100" is one condition over three fields, which a flat field/operator/value cannot say.
 */
export interface MdyDynamicValidation {
  /** The condition under which the form is **invalid**. */
  readonly when: MdyExpression;
  /** Shown to the user. Required: a validation nobody can read is a field that will not submit for no stated reason. */
  readonly message: string;
  /**
   * Where the error attaches, as a dotted path.
   *
   * Omitted, the error is form-level. Naming a target puts it on the field the user has to fix,
   * which is almost always the better message placement.
   */
  readonly target?: string;
}

/** Contract v2 adds declarative layout and conditions, never executable code. */
export interface MdyDynamicFormConfigV2 {
  readonly version: 2;
  readonly id?: string;
  readonly fields?: ReadonlyArray<MdyDynamicField>;
  readonly schema?: MdyDynamicGroupNode;
  readonly layout?: ReadonlyArray<MdyDynamicLayoutNode>;
  readonly rules?: ReadonlyArray<MdyDynamicRule>;
  /**
   * Cross-field validation.
   *
   * Optional, and absent from every document written before it existed — which is why it is a new
   * slot rather than a change to an existing one.
   */
  readonly validations?: ReadonlyArray<MdyDynamicValidation>;
}

/**
 * Contract v3 adds per-breakpoint placement and visibility for a single slot, and nothing else.
 *
 * The row's track count stays where v2 put it — `at` on the columns node — rather than being
 * respelled as `{ columns: n }`. One property, one spelling: a second way to say the same thing
 * would leave every reader deciding which one wins, and a v2 row would have to be rewritten to say
 * what it already says. What v3 adds is the thing v2 genuinely cannot express: a slot that moves or
 * disappears at a size, which is a property of the child rather than of the row.
 *
 * Everything else — `fields`, `schema`, `layout`, `rules` — is v2's, unchanged, so a v2 document is
 * a v3 document with the version number raised.
 */
export interface MdyDynamicFormConfigV3 extends Omit<MdyDynamicFormConfigV2, "version"> {
  readonly version: 3;
}

/**
 * v4: a document can say **when**.
 *
 * v3 and everything below it condition a field through `rules`, which are form-level and name a
 * leaf — so a condition on a cell inside a collection row, the arrangement where the row is a
 * template and its key does not exist yet, was not expressible at all. A node's own `when` is, and
 * it is read against what encloses the clause.
 *
 * `requiresContext` is the other half: the facts a document expects from the host. It is an API
 * between the application and whoever authors documents for it, so it is declared rather than
 * discovered, and a condition reading a key the document did not declare is refused.
 *
 * Everything else is v3's, unchanged: a v3 document is a v4 document with the version raised.
 */
export interface MdyDynamicFormConfigV4 extends Omit<MdyDynamicFormConfigV3, "version"> {
  readonly version: 4;
  /** The context keys this document's conditions read. */
  readonly requiresContext?: readonly string[];
}

export type MdyDynamicFormDocument =
  | MdyDynamicFormConfig
  | MdyDynamicFormConfigV2
  | MdyDynamicFormConfigV3
  | MdyDynamicFormConfigV4;

export type MdyDynamicParseMode = "lenient" | "strict";

export interface MdyDynamicDiagnostic {
  readonly code: string;
  readonly severity: "warning" | "error";
  readonly path: string;
  readonly message: string;
}

export interface MdyDynamicFormParseResult {
  readonly ok: boolean;
  readonly version: 1 | 2 | 3 | 4 | null;
  readonly fields: ReadonlyArray<MdyDynamicField>;
  /**
   * The collections the document declared, by path and kind.
   *
   * `fields` names them by path — `lines.0.name` — and a path cannot say which kind it came from:
   * `lines.0` reads as the key `"0"` whether the document declared an array or a record keyed by
   * digits. A consumer that rebuilds a schema from these fields reads this to rebuild the shape the
   * document declared rather than guessing it.
   *
   * Optional on the type and always present at runtime: a stand-in built by a consumer's test keeps
   * compiling, and reading it is what a consumer actually does with a parse result.
   */
  readonly collections?: ReadonlyArray<MdyDynamicCollection>;
  readonly layout: ReadonlyArray<MdyDynamicLayoutNode>;
  readonly rules: ReadonlyArray<MdyDynamicRule>;
  readonly validations: ReadonlyArray<MdyDynamicValidation>;
  readonly diagnostics: ReadonlyArray<MdyDynamicDiagnostic>;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
}

/**
 * Validates an untrusted (network/CMS) payload into `MdyDynamicField[]`.
 * TypeScript types do not check runtime JSON — this does.
 *
 * Accepts either a bare field array or a versioned
 * {@link MdyDynamicFormConfig} envelope (unknown versions are rejected).
 * Malformed entries and unknown `kind`s are dropped with a dev-mode warning,
 * so a partially-bad config still renders its valid fields.
 */
export function parseDynamicFields(input: unknown): MdyDynamicField[] {
  let items: unknown;
  if (Array.isArray(input)) {
    items = input;
  } else if (
    typeof input === "object" &&
    input !== null &&
    "fields" in input
  ) {
    const envelope = input as { version?: unknown; fields?: unknown };
    if (
      envelope.version !== 1 && envelope.version !== 2
      && envelope.version !== 3 && envelope.version !== 4
    ) {
      warnDev(
        `Unsupported dynamic form config version ${String(envelope.version)} — expected 1, 2, 3 or 4.`,
      );
      return [];
    }
    items = envelope.fields;
  }
  if (!Array.isArray(items)) {
    warnDev("Dynamic form config is neither a field array nor a config envelope.");
    return [];
  }
  const seenNames = new Set<string>();
  /** Option lists this read shortened, by the entry they belong to. */
  const dedupedOptions = new Map<unknown, ReadonlyArray<MdySelectOption<unknown>>>();
  const accepted: MdyDynamicField[] = items.filter((item, index): item is MdyDynamicField => {
    // Where this entry is written, so a finding underlines the entry rather than the array. A
    // duplicate names the *second* occurrence: the first is legitimate until the second exists, and
    // the second is the one a reader has to change.
    const at = `/fields/${index}`;
    if (typeof item !== "object" || item === null) {
      warnDev(`Dropped non-object dynamic field: ${JSON.stringify(item)}`, at);
      return false;
    }
    const f = item as Partial<MdyDynamicField>;
    if (typeof f.name !== "string" || f.name.length === 0) {
      warnDev(`Dropped dynamic field without a name: ${JSON.stringify(item)}`, at);
      return false;
    }
    if (!isSafeDynamicSegment(f.name)) {
      warnDev(
        `Dropped dynamic field "${f.name}": name is reserved or contains forbidden path separators.`,
      at,
      );
      return false;
    }
    // A character that cannot be seen makes two different names read the same, and a name is what a
    // value is filed under — the duplicate check exists for exactly this collision and would not see
    // it. The value sanitizer removes this class for the same reason.
    if (hasInvisibleCharacters(f.name)) {
      warnDev(
        `Dropped dynamic field ${JSON.stringify(f.name)}: the name carries a character that cannot ` +
        "be seen, so two names that read the same would be two different fields.",
        at,
      );
      return false;
    }
    if (f.name.includes(MDY_ID_DELIMITER)) {
      warnDev(
        `Dropped dynamic field "${f.name}": "${MDY_ID_DELIMITER}" separates the segments of a generated id, ` +
          `so this name would collide with another field's parts.`,
      at,
      );
      return false;
    }
    // The other half of the sentence the renderer refuses on, and it was the half nobody applied. A
    // widget id is built from this name and reaches `aria-describedby`, which is a space-separated
    // list of ids — whitespace there becomes several references, each resolving to nothing. An
    // author ran the gate, was told the document was fine, saved it, and the field never appeared.
    if (/\s/.test(f.name)) {
      warnDev(
        `Dropped dynamic field "${f.name}": a widget id is built from this name, and whitespace ` +
          `splits an id reference into several, each resolving to nothing — so the control would ` +
          `have no accessible name.`,
      at,
      );
      return false;
    }
    if (seenNames.has(f.name)) {
      warnDev(`Dropped duplicate dynamic field name "${f.name}".`, at);
      return false;
    }
    seenNames.add(f.name);
    if (!(MDY_DYNAMIC_FIELD_KINDS as readonly unknown[]).includes(f.kind)) {
      warnDev(`Dropped dynamic field "${f.name}" with unknown kind "${String(f.kind)}".`, at);
      return false;
    }
    if (f.label !== undefined && typeof f.label !== "string") {
      warnDev(`Dropped dynamic field "${f.name}": label must be a string.`, at);
      return false;
    }
    if (f.sensitive !== undefined && typeof f.sensitive !== "boolean") {
      warnDev(`Dropped dynamic field "${f.name}": sensitive must be a boolean.`, at);
      return false;
    }
    if (f.placeholder !== undefined && typeof f.placeholder !== "string") {
      warnDev(
        `Dropped dynamic field "${f.name}": placeholder must be a string.`,
      at,
      );
      return false;
    }
    if (!hasValidValidatorConfig(f.validators, f.name)) {
      return false;
    }
    // Members nobody declared, on the field and on the objects it carries. The field is kept: a
    // reader may meet a document written against a contract it predates, and dropping the field
    // would turn a report into a loss. What is not kept is the silence.
    for (const [value, declared, what] of [
      [item, MDY_DYNAMIC_MEMBERS.field, `dynamic field "${f.name}"`],
      [f.validators, MDY_DYNAMIC_MEMBERS.validators, `the validators of "${f.name}"`],
    ] as const) {
      const unknown = unknownMembers(value, declared);
      if (unknown.length > 0) {
        warnDev(
          `${what} carries ${unknown.map((member) => JSON.stringify(member)).join(", ")}, which ` +
          "this contract does not declare, so nothing reads it.",
          at,
        );
      }
    }
    if (Array.isArray((f as { options?: unknown }).options)) {
      for (const [index, option] of ((f as { options: readonly unknown[] }).options).entries()) {
        const unknown = unknownMembers(option, MDY_DYNAMIC_MEMBERS.option);
        if (unknown.length > 0) {
          warnDev(
            `an option of "${f.name}" carries ${unknown.map((member) => JSON.stringify(member)).join(", ")}, ` +
            "which this contract does not declare, so nothing reads it.",
            `${at}/options/${index}`,
          );
        }
      }
    }
    if (f.kind === "number" || f.kind === "slider") {
      const numberField = f as Partial<MdyDynamicNumberField>;
      if (numberField.min !== undefined && !isFiniteNumber(numberField.min)) {
        warnDev(`Dropped dynamic field "${f.name}": min must be a finite number.`, at);
        return false;
      }
      if (numberField.max !== undefined && !isFiniteNumber(numberField.max)) {
        warnDev(`Dropped dynamic field "${f.name}": max must be a finite number.`, at);
        return false;
      }
      if (
        numberField.min !== undefined &&
        numberField.max !== undefined &&
        numberField.min > numberField.max
      ) {
        warnDev(`Dropped dynamic field "${f.name}": min cannot exceed max.`, at);
        return false;
      }
      if (numberField.step !== undefined) {
        if (!isFiniteNumber(numberField.step)) {
          warnDev(`Dropped dynamic field "${f.name}": step must be a finite number.`, at);
          return false;
        }
        if (numberField.step <= 0) {
          warnDev(`Dropped dynamic field "${f.name}": step must be greater than zero.`, at);
          return false;
        }
      }
    }
    if (f.kind === "datepicker" || f.kind === "timepicker" || f.kind === "daterange") {
      if (!hasValidCalendarOptions(f as Partial<MdyDynamicCalendarOptions>, f.name)) return false;
    }
    // The initial the document declares, against the shape the kind holds. A collection's initial is
    // measured against its own shape — a record wants an object, an array a list, each refused by
    // name — and a field's was measured against nothing: a text field declaring `42` produced a
    // document that passed in strict mode and a form that was invalid before anyone touched it, with
    // "This field holds string" on a value the user never entered.
    //
    // The knowledge was published and used one layer later. `explainValueMismatch` is the same
    // sentence the engine says about a value that arrives at runtime; a declared initial is that
    // value, arriving earlier.
    if (f.initialValue !== undefined && (MDY_FIELD_KINDS as readonly unknown[]).includes(f.kind)) {
      const mismatch = explainValueMismatch(f.kind as MdyValueKind, f.initialValue);
      if (mismatch !== null) {
        warnDev(`Dropped dynamic field "${f.name}": initialValue does not match the kind — ${mismatch}.`, at);
        return false;
      }
    }
    // A constraint written one level too high. `validators: { required: true }` is the contract's
    // spelling, and `required: true` on the field is what an author — or a model writing the
    // document — reaches for instead: it is kept, nothing reads it, and the form has no rule where
    // its author believes there is one. Not silence, because the name is one the contract itself
    // declares, so reporting it costs no forward compatibility: a document may carry members this
    // reader has never heard of, and these are not that.
    //
    // `min` and `max` are left out: they are legitimate members of a number field, describing the
    // control's range, so the same word means two things by design.
    for (const misplaced of ["required", "email", "minLength", "maxLength", "pattern"] as const) {
      if ((f as Record<string, unknown>)[misplaced] === undefined) continue;
      warnDev(
        `Dynamic field "${f.name}" declares "${misplaced}" on the field, and it belongs in "validators" — ` +
        `nothing reads it here, so the field has no such rule.`,
        at,
      );
    }
    // A constraint that cannot fail. A kind whose empty is a usable value — a slider, whose thumb is
    // always somewhere — starts at a value `required` accepts, so the rule can never refuse
    // anything. Nothing is lost and nothing leaks; what an author loses is the belief that a choice
    // is compulsory, on a form that is submitted by somebody who never touched the control.
    if (
      (f as { validators?: { required?: unknown } }).validators?.required === true
      && (MDY_FIELD_KINDS as readonly unknown[]).includes(f.kind)
      // The **kind's** empty, not this field's initial: `mdyEmptyValueFor` answers with a declared
      // initial when there is one, and a row that starts with values in it would otherwise read as a
      // field whose `required` cannot fail — which is a statement about the kind, not about a value
      // somebody put there.
      && required()(mdyEmptyValueFor({ name: f.name, kind: f.kind } as MdyDynamicField)).length === 0
    ) {
      warnDev(
        `Dynamic field "${f.name}" declares "required", and a "${String(f.kind)}" starts at a value ` +
        `that satisfies it — the rule can never refuse anything, so the field is not compulsory.`,
        at,
      );
    }
    const needsOptions = ["select", "radio", "multiselect", "segmented"];
    if (needsOptions.includes(f.kind as string)) {
      const options = (f as { options?: unknown }).options;
      if (!hasValidOptions(options)) {
        warnDev(
          `Dropped dynamic field "${f.name}": kind "${String(f.kind)}" requires a valid options array.`,
        at,
        );
        return false;
      }
      // Two options that say the same value are the same defect two fields sharing a name are: the
      // value builds an id — `s__option__pro` — so the second is unreachable, and the value itself
      // names two different things, which neither the control nor the submission can resolve. The
      // later ones are dropped, as the later of two fields with one name is.
      const seenValues = new Set<string>();
      const kept = options.filter((option) => {
        const key = optionValueKey(option.value);
        if (!seenValues.has(key)) {
          seenValues.add(key);
          return true;
        }
        warnDev(
          `Dropped a duplicate option value ${key} on "${f.name}": an option's value is its identity, ` +
          "so two options sharing one leave a value naming both and a control able to reach only the first.",
          at,
        );
        return false;
      });
      if (kept.length !== options.length) {
        // Recorded, not written back: the document belongs to the caller, and a parser that edits it
        // leaves a second read of the same object answering differently from the first.
        dedupedOptions.set(item, kept);
      }
    }
    return true;
  });
  return dedupedOptions.size === 0
    ? accepted
    : accepted.map((declared) => {
      const kept = dedupedOptions.get(declared);
      return kept === undefined ? declared : { ...declared, options: kept } as MdyDynamicField;
    });
}

/**
 * What each refusal is called, and the phrase that identifies it.
 *
 * A consumer keys on the code; the message is prose and may be reworded. Deriving one from the other
 * inverts that — an edit to an English sentence silently renames a code somebody is matching on, and
 * nothing in a build objects.
 *
 * The table is the coupling made visible rather than removed: the phrases still have to appear in the
 * messages, and `dynamic-diagnostics.test.mjs` fails when one stops appearing. Removing the coupling
 * altogether means naming a code at each of the thirty sites that refuse something, which is the
 * right shape and a different change.
 */
export const MDY_DYNAMIC_DIAGNOSTICS: ReadonlyArray<{
  readonly code: string;
  readonly phrase: string;
}> = [
  { code: "MDY_DYNAMIC_UNSUPPORTED_VERSION", phrase: "Unsupported dynamic form config version" },
  { code: "MDY_DYNAMIC_DUPLICATE_NAME", phrase: "duplicate dynamic field" },
  { code: "MDY_DYNAMIC_UNSAFE_NAME", phrase: "reserved or contains forbidden" },
  { code: "MDY_DYNAMIC_UNKNOWN_KIND", phrase: "unknown kind" },
  { code: "MDY_DYNAMIC_OPTIONS_REQUIRED", phrase: "requires a valid options" },
  { code: "MDY_DYNAMIC_DUPLICATE_OPTION", phrase: "duplicate option value" },
  { code: "MDY_DYNAMIC_MISPLACED_VALIDATOR", phrase: "belongs in \"validators\"" },
  { code: "MDY_DYNAMIC_CONSTRAINT_CANNOT_FAIL", phrase: "can never refuse anything" },
  { code: "MDY_DYNAMIC_UNKNOWN_PARSE_MODE", phrase: "is not one this reader knows" },
  { code: "MDY_DYNAMIC_INVALID_CONDITION", phrase: "expected an expression object" },
  { code: "MDY_DYNAMIC_UNDECLARED_CONTEXT", phrase: "does not declare in" },
  { code: "MDY_DYNAMIC_PATH_TOO_LONG", phrase: "a path may be" },
  { code: "MDY_DYNAMIC_PATTERN_TOO_LONG", phrase: "pattern length" },
  { code: "MDY_DYNAMIC_PATTERN_TOO_COSTLY", phrase: "backtracks exponentially" },
  { code: "MDY_DYNAMIC_COUNT_INCOMPLETE", phrase: "a floor and not a total" },
  { code: "MDY_DYNAMIC_UNKNOWN_MEMBER", phrase: "which this contract does not declare" },
  { code: "MDY_DYNAMIC_DEPRECATED_VERSION", phrase: "Version 1 is deprecated" },
];

/** What a refusal is called when none of the named ones fits. */
export const MDY_DYNAMIC_INVALID_FIELD = "MDY_DYNAMIC_INVALID_FIELD";

function diagnosticCode(message: string): string {
  return MDY_DYNAMIC_DIAGNOSTICS.find((entry) => message.includes(entry.phrase))?.code
    ?? MDY_DYNAMIC_INVALID_FIELD;
}

/**
 * Why an operator cannot read the value it was given, or nothing.
 *
 * A rule's `value` is the one member the operator consults at runtime, and a mismatch there does not
 * throw and does not warn: the condition simply answers the same thing forever. `in` against a
 * string is a membership test with no members, and a field whose rule can never fire is
 * indistinguishable from a field with no rule — except that the author believes they wrote one.
 *
 * The field's own kind is what makes the date check possible. Comparing dates is comparing strings,
 * and that is only sound while every string is the same shape: `"2026-2-01"` sorts before
 * `"2026-1-10"` because `"2"` sorts after `"1"` and the padding is what hides it.
 */
function ruleValueRefusal(operator: string, value: unknown, kind: string | undefined): string | null {
  // A unary operator reads no value, so one written beside it is ignored rather than wrong — and a
  // generator that emits the same shape for every operator writes one. Refused, it would make a
  // document invalid for a member nothing consults.
  if (operator === "isEmpty" || operator === "isNotEmpty") return null;
  if (operator === "in" || operator === "notIn") {
    return Array.isArray(value) ? null : `${operator} tests membership of a list, and "value" is ${describeRuleValue(value)}.`;
  }
  const compares = operator === "greaterThan" || operator === "greaterThanOrEqual"
    || operator === "lessThan" || operator === "lessThanOrEqual";
  if (compares) {
    if (typeof value !== "number" && typeof value !== "string") {
      return `${operator} orders two numbers or two strings, and "value" is ${describeRuleValue(value)}.`;
    }
    if (typeof value === "string" && DATE_KINDS.has(kind ?? "") && !isIsoDate(value)) {
      return `${operator} on a ${kind} compares dates as text, so "value" must be a full ISO date (yyyy-MM-dd); "${value}" would order wrongly.`;
    }
  }
  return null;
}

/** The kinds whose value is an ISO date, so a comparison against them is a date comparison. */
const DATE_KINDS: ReadonlySet<string> = new Set(["datepicker", "daterange"]);

function describeRuleValue(value: unknown): string {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `a ${typeof value}`;
}

function validFieldReference(name: unknown, names: ReadonlySet<string>): name is string {
  return typeof name === "string" && names.has(name);
}

/**
 * Validates one layout node and everything nested under it. Every leaf must name a real
 * field, and a field may only be placed once — the same field in two slots would render
 * twice and bind the same value to both, which is never what the author meant.
 * Returns false and leaves `seen` untouched-in-spirit when the subtree is unusable.
 */
/**
 * Why a layout node was refused, so the diagnostic blames the right thing.
 *
 * Every refusal used to leave here as a bare `false` and arrive at the reader as
 * `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE` — which sent an author looking for a misspelled field when
 * the document's fields were all fine and the real cause was the version it declared, or how deep it
 * nested. A refusal that names a cause the document does not have is worse than a vague one: it
 * spends the reader's time on the wrong file.
 */
type LayoutRefusal = "version" | "depth" | "shape" | "reference";

/** The reason the last refusal carried, read by the caller straight after the call. */
let layoutRefusal: LayoutRefusal = "reference";

/** Records why, and answers `false` so every existing refusal path keeps its shape. */
function refuse(reason: LayoutRefusal): false {
  layoutRefusal = reason;
  return false;
}

/** The diagnostic a refusal earns: the code names what was wrong, not what was written correctly. */
function layoutRefusalDiagnostic(
  reason: LayoutRefusal,
  path: string,
  version: 1 | 2 | 3 | 4 | null,
): MdyDynamicDiagnostic {
  if (reason === "version") {
    return {
      code: "MDY_DYNAMIC_UNSUPPORTED_VERSION",
      severity: "error",
      path,
      message: `layout uses a placement this document's version (${String(version)}) precedes; it needs version 3.`,
    };
  }
  if (reason === "depth") {
    return {
      code: "MDY_DYNAMIC_INVALID_LAYOUT",
      severity: "error",
      path,
      message: `layout nests deeper than ${MDY_LAYOUT_MAX_DEPTH} levels.`,
    };
  }
  if (reason === "shape") {
    return { code: "MDY_DYNAMIC_INVALID_LAYOUT", severity: "error", path, message: "layout node has an invalid shape." };
  }
  return {
    code: "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE",
    severity: "error",
    path,
    message: "layout references an unknown or already-placed field.",
  };
}

function validLayoutNode(
  raw: unknown,
  names: ReadonlySet<string>,
  seen: Set<string>,
  depth: number,
  allowSlots: boolean,
): boolean {
  if (depth > MDY_LAYOUT_MAX_DEPTH) return refuse("depth");
  if (!isRecordValue(raw)) return refuse("shape");
  const node = raw as Partial<MdyDynamicLayoutNode>;
  if (typeof node.id !== "string") return refuse("shape");

  const slots: ReadonlyArray<ReadonlyArray<unknown>> =
    node.kind === "section"
      ? Array.isArray(node.children) ? [node.children] : []
      : node.kind === "columns"
        ? Array.isArray(node.columns) && node.columns.every(Array.isArray) ? (node.columns as unknown[][]) : []
        : [];
  if (!slots.length && node.kind !== "section" && node.kind !== "columns") return refuse("shape");
  if (node.kind === "section" && !Array.isArray(node.children)) return refuse("shape");
  if (node.kind === "columns" && (!Array.isArray(node.columns) || !node.columns.every(Array.isArray))) return refuse("shape");
  // `at` is untrusted like everything else here: a track count that is not a small positive integer
  // would reach the renderer as a custom property and produce a grid nobody asked for.
  if (node.kind === "columns" && node.at !== undefined) {
    if (!isRecordValue(node.at)) return refuse("shape");
    for (const [size, count] of Object.entries(node.at)) {
      if (!isBreakpoint(size)) return refuse("shape");
      if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MDY_MAX_LAYOUT_COLUMNS) return refuse("shape");
    }
  }

  // How many tracks this row has, so a slot cannot be sent to a column the row does not have. A
  // nested row is checked against its own count, which is why this is read here rather than passed
  // down. `at` may widen the row at a size, so the widest declared count is the ceiling.
  // `0` marks a node that has no tracks at all: a section, where placement cannot be honoured.
  const trackCount = node.kind === "columns"
    ? Math.max(
      Array.isArray(node.columns) ? node.columns.length : 1,
      ...Object.values((node.at ?? {}) as Record<string, number>),
    )
    : 0;

  for (const slot of slots) {
    for (const child of slot) {
      if (typeof child === "string") {
        if (!validFieldReference(child, names) || seen.has(child)) return refuse("reference");
        seen.add(child);
      } else if (isRecordValue(child) && "ref" in child) {
        // A v3 slot. Refused outright below v3: accepting it would make this parser disagree with
        // every other reader of the same document about what the contract says.
        if (!allowSlots) return refuse("version");
        if (!validSlot(child, names, seen, trackCount)) return false;
      } else {
        if (!validLayoutNode(child, names, seen, depth + 1, allowSlots)) return false;
        // A section's `at` describes the column *this* node gives it, not its own children, so it is
        // checked here rather than inside its own validation. A nested row's `at` is a track count
        // and belongs to that row, which is why only a section is asked. Below v3 the key does not
        // exist, exactly as for a slot.
        const nested = child as Partial<MdyDynamicSection>;
        if (nested.kind === "section" && nested.at !== undefined) {
          if (!allowSlots) return refuse("version");
          if (!validPlacement(nested.at, trackCount)) return refuse("shape");
        }
      }
    }
  }
  return true;
}

/**
 * Validates one v3 slot: a real field, placed once, and placement that a row can honour.
 *
 * `trackCount` of 0 means the slot is not in a columns row. Placement is refused there rather than
 * accepted and ignored: `grid-column` and `display` belong to a grid item, and the column is the only
 * element the contract owns — a section's child is a field's own root, which the layout does not get
 * to restyle. A slot with no `at` is still fine anywhere; it is simply a field name written longhand.
 */
function validSlot(raw: Record<string, unknown>, names: ReadonlySet<string>, seen: Set<string>, trackCount: number): boolean {
  const slot = raw as Partial<MdyDynamicLayoutSlot>;
  if (!validFieldReference(slot.ref, names) || seen.has(slot.ref)) return false;
  if (!validPlacement(slot.at, trackCount)) return false;
  seen.add(slot.ref);
  return true;
}

/**
 * A per-size placement, whether it came from a slot or from a section occupying a column.
 *
 * One function because it is one rule: what a column may be told to do does not depend on what is
 * inside it. `trackCount` of 0 means there is no column, and placement is refused outright.
 */
function validPlacement(at: unknown, trackCount: number): boolean {
  if (at === undefined) return true;
  if (trackCount === 0) return false;
  if (!isRecordValue(at)) return false;
  for (const [size, placement] of Object.entries(at)) {
    if (!isBreakpoint(size)) return false;
    if (!isRecordValue(placement)) return false;
    const { column, hidden } = placement as MdyDynamicSlotPlacement;
    if (column !== undefined && (!Number.isInteger(column) || column < 1 || column > trackCount)) return false;
    if (hidden !== undefined && typeof hidden !== "boolean") return false;
    // A size that says nothing is a mistake worth reporting rather than a no-op to keep: it is
    // usually a typo for a size that meant something.
    if (column === undefined && hidden === undefined) return false;
  }
  return true;
}


/**
 * What is wrong with a document's tree, in two kinds.
 *
 * `structural` is about the shape the walk needs — a node that is not an object, a group with no
 * children, an item a collection does not have. Any of them and there is nothing to walk, so the
 * document is turned down whole.
 *
 * `perField` is about what one field declares: a kind nobody named, a validator of the wrong shape.
 * The walk still runs and every other field survives, which is what makes the counts mean what they
 * say — one field refused out of three is not three fields lost.
 */
function validateDynamicSchema(input: unknown): {
  readonly structural: MdyDynamicDiagnostic[];
  readonly perField: MdyDynamicDiagnostic[];
  /** The context keys the document's conditions read. */
  readonly contextRead: readonly string[];
} {
  const out: MdyDynamicDiagnostic[] = [];
  const perField: MdyDynamicDiagnostic[] = [];
  /** Every context key the document's conditions read, for the envelope's declaration to match. */
  const contextRead = new Set<string>();

  /**
   * The walk is a stack rather than recursion, and there is no depth to refuse.
   *
   * A document is untrusted input, so the thing that must not decide how deep it may go is the call
   * stack: a thousand-deep document is a document, and it is answered on its own merits. Frames are
   * pushed in reverse so the diagnostics still come out in the order the document reads.
   */
  /**
   * A frame carries the names a clause written on that node may read.
   *
   * A condition is evaluated against **what encloses the clause**, so the readable names are the
   * enclosing group's children — inside a collection's `item` that is the row's own cells, which is
   * the whole reason a template can condition one of them without naming a key that does not exist
   * yet.
   */
  const stack: Array<{ raw: unknown; path: string; scope: ReadonlySet<string> }> = [
    { raw: input, path: "/schema", scope: new Set() },
  ];
  const push = (frames: Array<{ raw: unknown; path: string; scope: ReadonlySet<string> }>): void => {
    for (let index = frames.length - 1; index >= 0; index -= 1) stack.push(frames[index]!);
  };

  while (stack.length > 0) {
    const { raw, path, scope } = stack.pop()!;

    if (!isRecordValue(raw) || !["field", "group", "array", "record"].includes(String(raw["node"]))) {
      out.push({ code: "MDY_DYNAMIC_INVALID_NODE", severity: "error", path, message: "node must be field, group, array, or record." });
      continue;
    }

    // A clause a document writes on this node. Checked here because this is where the walk knows
    // what encloses it: an expression is read against that, so the names it may use are the enclosing
    // group's children — inside a collection's `item`, the row's own cells.
    for (const slot of ["when", "asyncWhen"] as const) {
      const clause = (raw as Record<string, unknown>)[slot];
      if (clause === undefined) continue;
      const problems = validateExpression(clause, `${path}/${slot}`);
      if (problems.length > 0) {
        out.push({
          code: "MDY_DYNAMIC_INVALID_CONDITION",
          severity: "error",
          path: `${path}/${slot}`,
          message: problems.join("; "),
        });
        continue;
      }
      const unreadable = expressionPaths(clause as MdyExpression)
        .filter((read) => !scope.has(read.split(".")[0] ?? read));
      if (unreadable.length > 0) {
        out.push({
          code: "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE",
          severity: "error",
          path: `${path}/${slot}`,
          message:
            `condition reads ${unreadable.map((read) => `"${read}"`).join(", ")}, which nothing ` +
            "encloses this clause declares — a condition is read against what encloses it, and " +
            '{ "root": true } is how it reaches the whole form.',
        });
      }
      for (const key of expressionContextKeys(clause as MdyExpression)) contextRead.add(key);
    }

    if (raw["node"] === "field") {
      if (!isRecordValue(raw["field"])) {
        out.push({ code: "MDY_DYNAMIC_INVALID_FIELD", severity: "error", path: `${path}/field`, message: "field node requires a field object." });
        continue;
      }
      // Every check a field gets in a flat list, applied wherever the field is. The walk knew a
      // node's *shape* and left what the field declares to the flat reader, which never sees a cell
      // inside a collection: a `kind` nobody declared, or a `validators.pattern` that is a number,
      // parsed clean at any depth below a row and then met the engine — where a person is already
      // waiting — or produced a control nobody asked for.
      // Named by the key its parent gave it. A field in a tree carries no `name` of its own — the
      // key is the name — so every finding below one read `Dynamic field "leaf"`, and a document
      // with two bad fields produced two identical sentences distinguished only by their path.
      const named = path.slice(path.lastIndexOf("/") + 1);
      collectingDiagnostics(
        (message) => perField.push({
          code: diagnosticCode(message),
          severity: "error",
          path: `${path}/field`,
          message,
        }),
        () => parseDynamicFields([{ ...(raw["field"] as object), name: named } as MdyDynamicField]),
      );
      // The initial the document declares, against the shape the kind holds. A record's initial is
      // measured against its own shape and an array's against its own; a field's was measured
      // against nothing, so a text field declaring `42` passed in the strictest mode there is and
      // produced a form that was invalid before anybody touched it — "This field holds string", on
      // a value the user never entered.
      const declared = raw["field"] as { kind?: unknown; initialValue?: unknown };
      if (
        declared.initialValue !== undefined
        && (MDY_FIELD_KINDS as readonly unknown[]).includes(declared.kind)
      ) {
        const mismatch = explainValueMismatch(declared.kind as MdyValueKind, declared.initialValue);
        if (mismatch !== null) {
          out.push({
            code: "MDY_DYNAMIC_INVALID_FIELD",
            severity: "error",
            path: `${path}/field/initialValue`,
            message: `field initialValue does not match the kind — ${mismatch}.`,
          });
        }
      }
      continue;
    }

    if (raw["node"] === "group") {
      if (!isRecordValue(raw["children"])) { out.push({ code: "MDY_DYNAMIC_INVALID_GROUP", severity: "error", path, message: "group requires children." }); continue; }
      const children: Array<{ raw: unknown; path: string; scope: ReadonlySet<string> }> = [];
      const here = new Set(Object.keys(raw["children"]));
      for (const [key, child] of Object.entries(raw["children"])) {
        if (!isSafeDynamicName(key)) out.push({ code: "MDY_DYNAMIC_UNSAFE_NAME", severity: "error", path: `${path}/children/${key}`, message: "unsafe child name." });
        else children.push({ raw: child, path: `${path}/children/${key}`, scope: here });
      }
      push(children);
      continue;
    }

    if (raw["node"] === "record") {
      if (!isRecordValue(raw["item"])) out.push({ code: "MDY_DYNAMIC_INVALID_RECORD", severity: "error", path, message: "record requires an item node." });
      else push([{ raw: raw["item"], path: `${path}/item`, scope: new Set() }]);
      const initial = raw["initialValue"];
      if (initial !== undefined && !isRecordValue(initial)) out.push({ code: "MDY_DYNAMIC_INVALID_RECORD", severity: "error", path: `${path}/initialValue`, message: "record initialValue must be an object keyed by row key." });
      else if (isRecordValue(initial)) {
        for (const key of Object.keys(initial)) {
          // A key that cannot be a path segment names a row nothing can address.
          if (!isSafeDynamicName(key)) out.push({ code: "MDY_DYNAMIC_UNSAFE_NAME", severity: "error", path: `${path}/initialValue/${key}`, message: "unsafe row key." });
        }
      }
      continue;
    }

    if (!isRecordValue(raw["item"])) out.push({ code: "MDY_DYNAMIC_INVALID_ARRAY", severity: "error", path, message: "array requires an item node." });
    else push([{ raw: raw["item"], path: `${path}/item`, scope: new Set() }]);
    if (raw["initialValue"] !== undefined && !Array.isArray(raw["initialValue"])) out.push({ code: "MDY_DYNAMIC_INVALID_ARRAY", severity: "error", path: `${path}/initialValue`, message: "array initialValue must be an array." });
  }

  return { structural: out, perField, contextRead: [...contextRead] };
}

/** Parses v1/v2 untrusted input with structured diagnostics. */
export function parseDynamicForm(
  input: unknown,
  options: { readonly mode?: MdyDynamicParseMode } = {},
): MdyDynamicFormParseResult {
  const diagnostics: MdyDynamicDiagnostic[] = [];
  /**
   * A member nobody declared, reported where it is written.
   *
   * The published JSON Schema closes every one of these objects and an editor says so while the
   * document is being typed. A document from a CMS, a model or a server met neither the type nor the
   * editor, and the parser — the only check it does meet — passed the same member without a word.
   */
  const reportUnknownMembers = (value: unknown, at: string, what: string): void => {
    const members = at.startsWith("/layout")
      // A slot is the third shape a layout position can take, beside the two node kinds: it names a
      // field and says where it sits. `ref` is what separates it from a node, which always has a
      // `kind`.
      ? (value as { kind?: unknown }).kind === "columns"
        ? MDY_DYNAMIC_MEMBERS.layoutColumns
        : (value as { kind?: unknown }).kind === undefined && isRecordValue(value) && "ref" in value
          ? MDY_DYNAMIC_MEMBERS.layoutSlot
          : MDY_DYNAMIC_MEMBERS.layoutSection
      : at.startsWith("/rules")
        ? MDY_DYNAMIC_MEMBERS.rule
        : MDY_DYNAMIC_MEMBERS.validation;
    const unknown = unknownMembers(value, members);
    if (unknown.length === 0) return;
    diagnostics.push({
      code: "MDY_DYNAMIC_UNKNOWN_MEMBER",
      severity: "error",
      path: at,
      message:
        `${what} carries ${unknown.map((member) => JSON.stringify(member)).join(", ")}, which this ` +
        "contract does not declare, so nothing reads it.",
    });
  };
  /**
   * Every layout node and every slot under one, each held to its own published list.
   *
   * Reported at every depth, not only at the top: a document's layout nests, and a member outside
   * the list is a member nothing reads wherever it is written. A slot is where it costs the most —
   * `at` is how a field says which column it takes at which size, so `att` is a placement that never
   * happens, and the node parses clean with the misspelling kept and handed to whatever draws it.
   *
   * Over a stack rather than by recursion: the depth here is the document's own, and a document is
   * untrusted input. The traversal is bounded by the same depth the validator enforces, so a layout
   * deeper than the contract allows is refused there rather than walked here.
   */
  const reportLayoutMembers = (root: unknown, rootPath: string): void => {
    const pending: Array<{ node: unknown; at: string; depth: number }> = [{ node: root, at: rootPath, depth: 1 }];
    while (pending.length > 0) {
      const { node, at, depth } = pending.pop()!;
      if (!isRecordValue(node) || depth > MDY_LAYOUT_MAX_DEPTH) continue;
      reportUnknownMembers(node, at, "kind" in node ? "a layout node" : "a layout slot");
      // Read structurally: the two node kinds have incompatible `kind` literals, so the intersection
      // of their declared types is uninhabited, and what this walk needs is only where children sit.
      const shape = node as { children?: unknown; columns?: unknown };
      if (Array.isArray(shape.children)) {
        shape.children.forEach((child: unknown, index: number) => {
          pending.push({ node: child, at: `${at}/children/${index}`, depth: depth + 1 });
        });
        continue;
      }
      if (!Array.isArray(shape.columns)) continue;
      shape.columns.forEach((column: unknown, track: number) => {
        if (!Array.isArray(column)) return;
        column.forEach((child: unknown, index: number) => {
          pending.push({ node: child, at: `${at}/columns/${track}/${index}`, depth: depth + 1 });
        });
      });
    }
  };
  // A mode nobody declared is not lenient. `strict` is what a publishing gate asks for, and the
  // answer to a typo in it — or to the options object being a bare string, or `null` — was a lenient
  // parse reported as a success, so a contract nobody checked went out with `ok: true` beside it.
  //
  // Reported rather than thrown: this parser's whole design is a report. The report is what makes
  // `ok` false, which is the half that closes the gate.
  // Read only from where the signature puts it. A bare `"strict"` in the options position is a
  // caller's mistake, and honouring it would invent a second spelling of the argument — one nobody
  // documented and every later reader would have to know about. It is reported, which is the half
  // that matters: what must not happen is a lenient parse answering `ok: true` to a caller who asked
  // for a gate.
  const asked = typeof options === "object" && options !== null
    ? (options as { mode?: unknown }).mode
    : options === undefined ? undefined : options;
  const optionsAreAnObject = options === undefined
    || (typeof options === "object" && options !== null && !Array.isArray(options));
  const modeUnderstood = optionsAreAnObject
    && (asked === undefined || asked === "strict" || asked === "lenient");
  if (!modeUnderstood) {
    diagnostics.push({
      code: "MDY_DYNAMIC_UNKNOWN_PARSE_MODE",
      severity: "error",
      path: "/options/mode",
      message:
        `parse mode ${JSON.stringify(asked)} is not one this reader knows — it is "strict" or ` +
        `"lenient". The document was read leniently, which is not what was asked for.`,
    });
  }
  const rawEnvelope = typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as { version?: unknown; schema?: unknown }
    : undefined;
  /**
   * A version this reader does not have, answered as a version.
   *
   * The document is refused either way — nothing a newer publisher wrote is read as if it were this
   * contract — but which refusal it gets decides where the host looks: read as a malformed field
   * list, a document from a publisher one version ahead sent its reader hunting for the broken
   * field, when the answer is that this reader does not have that version at all.
   */
  const versionDeclared = rawEnvelope !== undefined && "version" in rawEnvelope
    ? rawEnvelope.version
    : undefined;
  const versionUnderstood = versionDeclared === undefined
    || versionDeclared === 1 || versionDeclared === 2 || versionDeclared === 3 || versionDeclared === 4;
  if (!versionUnderstood) {
    return {
      ok: false,
      version: null,
      fields: [],
      collections: [],
      layout: [],
      rules: [],
      validations: [],
      acceptedCount: 0,
      rejectedCount: 0,
      diagnostics: [{
        code: "MDY_DYNAMIC_UNSUPPORTED_VERSION",
        severity: "error",
        path: "/version",
        message:
          `Unsupported dynamic form config version ${JSON.stringify(versionDeclared)} — this reader ` +
          "has versions 1, 2, 3 and 4. The document is from a publisher this reader does not know, " +
          "and nothing in it was read.",
      }],
    };
  }
  let collections: MdyDynamicCollection[] = [];
  /** How many fields a tree document declared, kept or not — `undefined` until a tree is walked. */
  let declaredLeaves: number | undefined;
  /**
   * How many of those the parser turned down.
   *
   * Counted from what was *reported*, not from the difference between declared and kept: a
   * collection's cells are declared and never become flat fields, so the difference would call every
   * one of them a rejection and a correct document would read as having lost everything.
   */
  let treeRejected = 0;
  let fields: MdyDynamicField[] = collectingDiagnostics(
    // `/fields` only when the reporter did not say which entry: an envelope-level refusal is about
    // the list, and a field's own is about the field.
    (message, path) => diagnostics.push({
      code: diagnosticCode(message), severity: "error", path: path ?? "/fields", message,
    }),
    () => (rawEnvelope?.version === 2 || rawEnvelope?.version === 3 || rawEnvelope?.version === 4)
      && rawEnvelope.schema !== undefined
      ? []
      : parseDynamicFields(input),
  );

  const envelope = typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as {
      version?: unknown;
      fields?: unknown;
      schema?: unknown;
      layout?: unknown;
      rules?: unknown;
      validations?: unknown;
      requiresContext?: unknown;
    }
    : undefined;
  const version: 1 | 2 | 3 | 4 | null = Array.isArray(input) || envelope?.version === 1
    ? 1 : envelope?.version === 2 ? 2 : envelope?.version === 3 ? 3 : envelope?.version === 4 ? 4 : null;
  // v3 is v2 plus per-slot placement: every envelope member is read the same way, and only the
  // layout validator is told which vocabulary the document is entitled to use.
  const structured = version === 2 || version === 3 || version === 4;
  if (structured && envelope?.schema !== undefined) {
    const { structural, perField, contextRead } = validateDynamicSchema(envelope.schema);
    diagnostics.push(...structural, ...perField);
    // What the document said it had, counted before anything is refused. A schema the validator
    // turns down wholesale never reaches the walk, so without this a document declaring three
    // children reported none accepted and none rejected — three entered and nothing came out, with
    // the counts saying nothing happened.
    const declaration = declaredFieldCount(envelope.schema);
    declaredLeaves = declaration.count;
    if (!declaration.complete) {
      diagnostics.push({
        code: "MDY_DYNAMIC_COUNT_INCOMPLETE",
        severity: "warning",
        path: "/schema",
        message:
          `The document declares more than the ${MDY_MAX_DECLARATION_WALK} declarations this reader ` +
          "counts, so what it accepted and what it turned down are a floor and not a total.",
      });
    }
    // A schema refused whole never reaches the walk, so everything it declared was turned down.
    // What the document says it needs from the host, against what its conditions read. The
    // declaration is an API between the application and whoever authors documents for it, so a key
    // read and not declared is a promise the document did not make and the host cannot keep.
    const declared = new Set(
      Array.isArray(envelope.requiresContext)
        ? (envelope.requiresContext as readonly unknown[]).filter((key): key is string => typeof key === "string")
        : [],
    );
    const undeclared = contextRead.filter((key) => !declared.has(key));
    if (undeclared.length > 0) {
      diagnostics.push({
        code: "MDY_DYNAMIC_UNDECLARED_CONTEXT",
        severity: "error",
        path: "/requiresContext",
        message:
          `conditions read context ${undeclared.map((key) => `"${key}"`).join(", ")}, which this ` +
          "document does not declare in \"requiresContext\" — a host cannot supply what it is not told about.",
      });
    }
    // A shape the walk cannot enter turns the document down whole; a field that declares something
    // nobody can render is one field, and the count says so.
    treeRejected = structural.length > 0 ? declaredLeaves : perField.length;
    if (structural.length === 0) {
      // The walk reports the way the flat list does. Without this it ran outside the collector, so a
      // leaf `parseDynamicFields` refused was dropped and nothing said it — the same defect written
      // as a tree instead of a list received silence where the list received a diagnostic, and a
      // tree is the shape a CMS sends. `declaredLeaves` is what a document said it had, so the
      // counts a consumer reports with are about the document and not about what survived it.
      const before = diagnostics.length;
      const walked = collectingDiagnostics(
        (message, path) => diagnostics.push({
          code: diagnosticCode(message), severity: "error", path: path ?? "/schema", message,
        }),
        () => flattenDynamicForm(envelope.schema as MdyDynamicGroupNode),
      );
      fields = walked.fields;
      collections = walked.collections;
      treeRejected = diagnostics.length - before;
      declaredLeaves = Math.max(declaredLeaves ?? 0, walked.fields.length + treeRejected);
    }
  }
  const names = new Set(fields.map((field) => field.name));
  /** What each declared field holds, so a rule's value can be judged against the field it reads. */
  const kindOf = new Map(fields.map((field) => [field.name, field.kind]));
  const layout: MdyDynamicLayoutNode[] = [];
  const rules: MdyDynamicRule[] = [];
  const validations: MdyDynamicValidation[] = [];
  /** Fields already placed by an accepted layout node — a field belongs in exactly one slot. */
  const placed = new Set<string>();

  // A v1 envelope carrying a member its version predates. The slot is read by nothing here — v1 is
  // fields and nothing else — so it was dropped in silence: an author who wrote rules against the
  // wrong version number got a document the parser called clean, a lint that had nothing to report,
  // and a form where the rules simply were not there. Reported rather than accepted, because the
  // three ways they could have learned are the three that said nothing.
  // Version 1 is still read, and it is the oldest shape there is: no published schema describes it,
  // no fixture measures it, and the two other runtimes of this contract do not have it. A document
  // written against it is told, once, in the one place that reads it. A bare field array is not that
  // document: it declares no version at all, and it is the shape most callers pass.
  if (envelope?.version === 1) {
    diagnostics.push({
      code: "MDY_DYNAMIC_DEPRECATED_VERSION",
      severity: "warning",
      path: "/version",
      message:
        "Version 1 is deprecated: it declares fields and nothing else, no published schema " +
        "describes it, and the Rust and Java readers of this contract do not have it. Raise the " +
        'document to "version": 2, which reads the same fields.',
    });
  }
  // A member no version of this contract has. A document reaching for something the contract does
  // not do — a computation, a slot an author expected to exist — parsed clean and rendered a form
  // that quietly did not do it.
  if (envelope !== undefined) {
    const unknown = unknownMembers(envelope, MDY_DYNAMIC_MEMBERS.document);
    if (unknown.length > 0) {
      diagnostics.push({
        code: "MDY_DYNAMIC_UNKNOWN_MEMBER",
        severity: "error",
        path: "/",
        message:
          `the document carries ${unknown.map((member) => JSON.stringify(member)).join(", ")}, which ` +
          "this contract does not declare, so nothing reads it.",
      });
    }
  }
  // A member the document's version predates, on the envelope. `requiresContext` arrived with v4 and
  // is read by the builder, so a v2 or v3 document carrying it declares a need nothing acts on.
  if (envelope?.requiresContext !== undefined && version !== null && version < 4) {
    diagnostics.push({
      code: "MDY_DYNAMIC_UNSUPPORTED_VERSION",
      severity: "error",
      path: "/requiresContext",
      message:
        `Unsupported dynamic form config version for "requiresContext": it arrived with version 4, ` +
        `and this document says ${version}. Set "version": 4 to use it.`,
    });
  }
  if (!structured && envelope) {
    for (const slot of ["layout", "rules", "validations"] as const) {
      if (envelope[slot] === undefined) continue;
      diagnostics.push({
        code: "MDY_DYNAMIC_UNSUPPORTED_VERSION",
        severity: "error",
        path: `/${slot}`,
        // The registry's phrase for this code has to appear in the sentence: a consumer keys on the
        // code, and `dynamic-diagnostics.test.mjs` is what keeps the two from drifting apart.
        message: `Unsupported dynamic form config version for "${slot}": version 1 declares fields and nothing else. Set "version": 2 to use it.`,
      });
    }
  }

  if (structured && envelope) {
    if (envelope.layout !== undefined && !Array.isArray(envelope.layout)) {
      diagnostics.push({ code: "MDY_DYNAMIC_INVALID_LAYOUT", severity: "error", path: "/layout", message: "layout must be an array." });
    } else for (const [index, raw] of (envelope.layout ?? []).entries()) {
      if (typeof raw !== "object" || raw === null) {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_LAYOUT", severity: "error", path: `/layout/${index}`, message: "layout node must be an object." });
        continue;
      }
      // A node at the top of the layout sits in no column, so it has nothing to be placed in — the
      // same reason a slot's `at` is refused outside a row, checked here because this is the one
      // place a layout node is visited without a parent.
      if ((raw as Partial<MdyDynamicSection>).at !== undefined && (raw as Partial<MdyDynamicLayoutNode>).kind === "section") {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_LAYOUT", severity: "error", path: `/layout/${index}`, message: "a section at the top of the layout occupies no column and cannot be placed." });
        continue;
      }
      reportLayoutMembers(raw, `/layout/${index}`);
      layoutRefusal = "reference";
      if (!validLayoutNode(raw, names, placed, 1, version === 3 || version === 4)) {
        diagnostics.push(layoutRefusalDiagnostic(layoutRefusal, `/layout/${index}`, version));
        continue;
      }
      layout.push(raw as MdyDynamicLayoutNode);
    }
    if (envelope.rules !== undefined && !Array.isArray(envelope.rules)) {
      diagnostics.push({ code: "MDY_DYNAMIC_INVALID_RULE", severity: "error", path: "/rules", message: "rules must be an array." });
    } else for (const [index, raw] of (envelope.rules ?? []).entries()) {
      if (typeof raw !== "object" || raw === null) {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_RULE", severity: "error", path: `/rules/${index}`, message: "rule must be an object." });
        continue;
      }
      reportUnknownMembers(raw, `/rules/${index}`, "a rule");
      const rule = raw as Partial<MdyDynamicRule>;
      const effects = ["visible", "hidden", "enabled", "disabled"];
      const operators = ["equals", "notEquals", "in", "notIn", "isEmpty", "isNotEmpty", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"];
      if (!effects.includes(rule.effect ?? "") || !validFieldReference(rule.target, names) || !rule.when || !validFieldReference(rule.when.field, names) || !operators.includes(rule.when.operator)) {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_RULE", severity: "error", path: `/rules/${index}`, message: "rule has an unsupported effect/operator or references an unknown field." });
        continue;
      }
      // The part the operator actually reads. Four of a rule's five members were guarded and this
      // one was not, so `greaterThan` against an object and `in` against a string parsed clean in
      // strict mode and then answered `false` forever — a rule that cannot fire, reported as a rule.
      const valueRefusal = ruleValueRefusal(rule.when.operator, rule.when.value, kindOf.get(rule.when.field));
      if (valueRefusal) {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_RULE", severity: "error", path: `/rules/${index}/when/value`, message: valueRefusal });
        continue;
      }
      rules.push(raw as MdyDynamicRule);
    }
    if (envelope.validations !== undefined && !Array.isArray(envelope.validations)) {
      diagnostics.push({ code: "MDY_DYNAMIC_INVALID_VALIDATION", severity: "error", path: "/validations", message: "validations must be an array." });
    } else for (const [index, raw] of (envelope.validations ?? []).entries()) {
      const at = `/validations/${index}`;
      if (typeof raw !== "object" || raw === null) {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_VALIDATION", severity: "error", path: at, message: "validation must be an object." });
        continue;
      }
      reportUnknownMembers(raw, at, "a validation");
      const validation = raw as Partial<MdyDynamicValidation>;
      if (typeof validation.message !== "string" || validation.message.trim() === "") {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_VALIDATION", severity: "error", path: at, message: "validation needs a non-empty message." });
        continue;
      }
      // A target names a field, the same way a rule's does. An unknown one would attach the error to
      // nothing and the user would never see why the form will not submit.
      if (validation.target !== undefined && !validValidationPath(validation.target, names)) {
        diagnostics.push({ code: "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", severity: "error", path: at, message: "validation target references an unknown field." });
        continue;
      }
      const problems = validateExpression(validation.when, `${at}.when`);
      if (problems.length > 0) {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_VALIDATION", severity: "error", path: at, message: problems.join("; ") });
        continue;
      }
      // Every path the condition reads must exist, for the same reason: a condition asking about a
      // field that is not in the form is a rule that can never be satisfied, and it fails silently.
      // The empty path is the whole form value, and a rule's `field` has never accepted it — so the
      // same condition was a condition in one half of the document format and not in the other, and
      // the half that took it produced a check that can never fire: comparing the form object to a
      // scalar is false for every value the form can be driven to. `{ root: true }` is the operand
      // that reads the whole form, and it says so.
      const unknown = expressionPaths(validation.when as MdyExpression).filter((path) => !validValidationPath(path, names));
      if (unknown.length > 0) {
        diagnostics.push({
          code: "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE",
          severity: "error",
          path: at,
          message:
            `validation condition references unknown field(s): ${unknown.map((path) => `"${path}"`).join(", ")}` +
            `${unknown.includes("") ? ' — the whole form value is { "root": true }' : ""}.`,
        });
        continue;
      }
      validations.push(raw as MdyDynamicValidation);
    }
  }

  const sourceCount = Array.isArray(input)
    ? input.length
    : Array.isArray(envelope?.fields)
      ? envelope.fields.length
      : declaredLeaves ?? fields.length;
  const elsewhere = diagnostics.filter((d) => d.path.startsWith("/layout/") || d.path.startsWith("/rules/") || d.path.startsWith("/validations/")).length;
  const rejectedCount = (declaredLeaves === undefined
    ? Math.max(0, sourceCount - fields.length)
    : treeRejected) + elsewhere;
  const strict = modeUnderstood && asked === "strict";
  // What strict mode refuses on. A warning is published as the severity a consumer reads to tell
  // what must be fixed from what is worth knowing, so refusing the whole document for one turns the
  // distinction into a second word for "error" — and the document it refused had nothing malformed
  // in it, only more declarations than the reader counts.
  const refusals = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  return {
    // A mode nobody knows is not a document that parsed: `ok` is what a publishing gate reads, and
    // answering `true` for a run that was never the run the caller asked for is the whole finding.
    ok: modeUnderstood && version !== null && (!strict || refusals === 0),
    version,
    fields: strict && refusals > 0 ? [] : fields,
    layout: strict && refusals > 0 ? [] : layout,
    rules: strict && refusals > 0 ? [] : rules,
    validations: strict && refusals > 0 ? [] : validations,
    collections,
    diagnostics,
    // What the document declared and the parser understood. For a tree that is every field node it
    // declares, collections included, minus what was refused — `fields` cannot answer it, because a
    // collection's cells are not flat fields until rows exist.
    acceptedCount: declaredLeaves === undefined
      ? fields.length
      : Math.max(0, declaredLeaves - rejectedCount),
    rejectedCount,
  };
}


