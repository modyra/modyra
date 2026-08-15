/**
 * Reading a document that arrived from somewhere else.
 *
 * Every function here takes `unknown` and answers with a value plus the diagnostics that explain
 * what it refused. A malformed document produces a report, never a throw and never a partially
 * built form — the caller decides whether a lenient result is good enough.
 */

import { expressionPaths, validateExpression, type MdyExpression } from "../expression.js";
import {
  MDY_ID_DELIMITER,
  MDY_MAX_DYNAMIC_PATTERN_LENGTH,
  collectingDiagnostics,
  isFiniteNumber,
  isIsoDate,
  isRecordValue,
  isSafeDynamicSegment,
  warnDev,
} from "./guards.js";
import { dynamicPatternRefusal } from "./pattern-cost.js";
import type { MdySelectOption } from "../types.js";

import {
  MDY_DYNAMIC_FIELD_KINDS,
  type MdyDynamicCalendarOptions,
  type MdyDynamicCollection,
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
function declaredFieldCount(schema: unknown): number {
  let count = 0;
  const stack: unknown[] = [schema];
  // A bound, because the count is taken before the depth and size checks have run.
  for (let steps = 0; stack.length > 0 && steps < 10_000; steps += 1) {
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
  return count;
}

export function flattenDynamicForm(schema: MdyDynamicGroupNode): {
  readonly fields: MdyDynamicField[];
  readonly collections: MdyDynamicCollection[];
} {
  const out: MdyDynamicField[] = [];
  const collections: MdyDynamicCollection[] = [];
  const visit = (node: MdyDynamicNode, path: string, initial: unknown): void => {
    if (node.node === "field") {
      const candidate = { ...node.field, name: path, initialValue: initial ?? node.field.initialValue } as MdyDynamicField;
      // Generated dotted/index paths are trusted structure; validate the leaf with
      // a temporary safe name, then restore the generated path.
      const parsed = parseDynamicFields([{ ...candidate, name: "leaf" }]);
      if (parsed[0]) out.push({ ...parsed[0], name: path } as MdyDynamicField);
      return;
    }
    if (node.node === "group") {
      const value = isRecordValue(initial) ? initial : {};
      for (const [key, child] of Object.entries(node.children)) {
        if (!isSafeDynamicSegment(key)) continue;
        visit(child, path ? `${path}.${key}` : key, value[key]);
      }
      return;
    }
    if (node.node === "record") {
      collections.push({ path, kind: "record" });
      const declared = isRecordValue(initial)
        ? initial
        : isRecordValue(node.initialValue) ? node.initialValue : {};
      for (const [key, row] of Object.entries(declared)) {
        // The key is a path segment like any other, and an unsafe one addresses something else.
        if (!isSafeDynamicSegment(key)) continue;
        visit(node.item, path ? `${path}.${key}` : key, row);
      }
      return;
    }
    collections.push({ path, kind: "array" });
    const rows = Array.isArray(initial) ? initial : Array.isArray(node.initialValue) ? node.initialValue : [];
    rows.forEach((row, index) => visit(node.item, `${path}.${index}`, row));
  };
  visit(schema, "", undefined);
  return { fields: out, collections };
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

export type MdyDynamicFormDocument =
  | MdyDynamicFormConfig
  | MdyDynamicFormConfigV2
  | MdyDynamicFormConfigV3;

export type MdyDynamicParseMode = "lenient" | "strict";

export interface MdyDynamicDiagnostic {
  readonly code: string;
  readonly severity: "warning" | "error";
  readonly path: string;
  readonly message: string;
}

export interface MdyDynamicFormParseResult {
  readonly ok: boolean;
  readonly version: 1 | 2 | 3 | null;
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
    if (envelope.version !== 1 && envelope.version !== 2 && envelope.version !== 3) {
      warnDev(
        `Unsupported dynamic form config version ${String(envelope.version)} — expected 1, 2 or 3.`,
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
  return items.filter((item, index): item is MdyDynamicField => {
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
    }
    return true;
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
  { code: "MDY_DYNAMIC_PATTERN_TOO_LONG", phrase: "pattern length" },
  { code: "MDY_DYNAMIC_PATTERN_TOO_COSTLY", phrase: "backtracks exponentially" },
];

/** What a refusal is called when none of the named ones fits. */
export const MDY_DYNAMIC_INVALID_FIELD = "MDY_DYNAMIC_INVALID_FIELD";

function diagnosticCode(message: string): string {
  return MDY_DYNAMIC_DIAGNOSTICS.find((entry) => message.includes(entry.phrase))?.code
    ?? MDY_DYNAMIC_INVALID_FIELD;
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
  version: 1 | 2 | 3 | null,
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


function validateDynamicSchema(input: unknown): MdyDynamicDiagnostic[] {
  const out: MdyDynamicDiagnostic[] = [];

  /**
   * The walk is a stack rather than recursion, and there is no depth to refuse.
   *
   * A document is untrusted input, so the thing that must not decide how deep it may go is the call
   * stack: a thousand-deep document is a document, and it is answered on its own merits. Frames are
   * pushed in reverse so the diagnostics still come out in the order the document reads.
   */
  const stack: Array<{ raw: unknown; path: string }> = [{ raw: input, path: "/schema" }];
  const push = (frames: Array<{ raw: unknown; path: string }>): void => {
    for (let index = frames.length - 1; index >= 0; index -= 1) stack.push(frames[index]!);
  };

  while (stack.length > 0) {
    const { raw, path } = stack.pop()!;

    if (!isRecordValue(raw) || !["field", "group", "array", "record"].includes(String(raw["node"]))) {
      out.push({ code: "MDY_DYNAMIC_INVALID_NODE", severity: "error", path, message: "node must be field, group, array, or record." });
      continue;
    }

    if (raw["node"] === "field") {
      if (!isRecordValue(raw["field"])) out.push({ code: "MDY_DYNAMIC_INVALID_FIELD", severity: "error", path: `${path}/field`, message: "field node requires a field object." });
      continue;
    }

    if (raw["node"] === "group") {
      if (!isRecordValue(raw["children"])) { out.push({ code: "MDY_DYNAMIC_INVALID_GROUP", severity: "error", path, message: "group requires children." }); continue; }
      const children: Array<{ raw: unknown; path: string }> = [];
      for (const [key, child] of Object.entries(raw["children"])) {
        if (!isSafeDynamicSegment(key)) out.push({ code: "MDY_DYNAMIC_UNSAFE_NAME", severity: "error", path: `${path}/children/${key}`, message: "unsafe child name." });
        else children.push({ raw: child, path: `${path}/children/${key}` });
      }
      push(children);
      continue;
    }

    if (raw["node"] === "record") {
      if (!isRecordValue(raw["item"])) out.push({ code: "MDY_DYNAMIC_INVALID_RECORD", severity: "error", path, message: "record requires an item node." });
      else push([{ raw: raw["item"], path: `${path}/item` }]);
      const initial = raw["initialValue"];
      if (initial !== undefined && !isRecordValue(initial)) out.push({ code: "MDY_DYNAMIC_INVALID_RECORD", severity: "error", path: `${path}/initialValue`, message: "record initialValue must be an object keyed by row key." });
      else if (isRecordValue(initial)) {
        for (const key of Object.keys(initial)) {
          // A key that cannot be a path segment names a row nothing can address.
          if (!isSafeDynamicSegment(key)) out.push({ code: "MDY_DYNAMIC_UNSAFE_NAME", severity: "error", path: `${path}/initialValue/${key}`, message: "unsafe row key." });
        }
      }
      continue;
    }

    if (!isRecordValue(raw["item"])) out.push({ code: "MDY_DYNAMIC_INVALID_ARRAY", severity: "error", path, message: "array requires an item node." });
    else push([{ raw: raw["item"], path: `${path}/item` }]);
    if (raw["initialValue"] !== undefined && !Array.isArray(raw["initialValue"])) out.push({ code: "MDY_DYNAMIC_INVALID_ARRAY", severity: "error", path: `${path}/initialValue`, message: "array initialValue must be an array." });
  }

  return out;
}

/** Parses v1/v2 untrusted input with structured diagnostics. */
export function parseDynamicForm(
  input: unknown,
  options: { readonly mode?: MdyDynamicParseMode } = {},
): MdyDynamicFormParseResult {
  const diagnostics: MdyDynamicDiagnostic[] = [];
  const rawEnvelope = typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as { version?: unknown; schema?: unknown }
    : undefined;
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
    () => (rawEnvelope?.version === 2 || rawEnvelope?.version === 3) && rawEnvelope.schema !== undefined
      ? []
      : parseDynamicFields(input),
  );

  const envelope = typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as { version?: unknown; fields?: unknown; schema?: unknown; layout?: unknown; rules?: unknown; validations?: unknown }
    : undefined;
  const version: 1 | 2 | 3 | null = Array.isArray(input) || envelope?.version === 1
    ? 1 : envelope?.version === 2 ? 2 : envelope?.version === 3 ? 3 : null;
  // v3 is v2 plus per-slot placement: every envelope member is read the same way, and only the
  // layout validator is told which vocabulary the document is entitled to use.
  const structured = version === 2 || version === 3;
  if (structured && envelope?.schema !== undefined) {
    const schemaDiagnostics = validateDynamicSchema(envelope.schema);
    diagnostics.push(...schemaDiagnostics);
    // What the document said it had, counted before anything is refused. A schema the validator
    // turns down wholesale never reaches the walk, so without this a document declaring three
    // children reported none accepted and none rejected — three entered and nothing came out, with
    // the counts saying nothing happened.
    declaredLeaves = declaredFieldCount(envelope.schema);
    // A schema refused whole never reaches the walk, so everything it declared was turned down.
    treeRejected = schemaDiagnostics.length > 0 ? declaredLeaves : 0;
    if (schemaDiagnostics.length === 0) {
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
  const layout: MdyDynamicLayoutNode[] = [];
  const rules: MdyDynamicRule[] = [];
  const validations: MdyDynamicValidation[] = [];
  /** Fields already placed by an accepted layout node — a field belongs in exactly one slot. */
  const placed = new Set<string>();

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
      layoutRefusal = "reference";
      if (!validLayoutNode(raw, names, placed, 1, version === 3)) {
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
      const rule = raw as Partial<MdyDynamicRule>;
      const effects = ["visible", "hidden", "enabled", "disabled"];
      const operators = ["equals", "notEquals", "in", "notIn", "isEmpty", "isNotEmpty", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"];
      if (!effects.includes(rule.effect ?? "") || !validFieldReference(rule.target, names) || !rule.when || !validFieldReference(rule.when.field, names) || !operators.includes(rule.when.operator)) {
        diagnostics.push({ code: "MDY_DYNAMIC_INVALID_RULE", severity: "error", path: `/rules/${index}`, message: "rule has an unsupported effect/operator or references an unknown field." });
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
      const unknown = expressionPaths(validation.when as MdyExpression).filter((path) => path !== "" && !validValidationPath(path, names));
      if (unknown.length > 0) {
        diagnostics.push({ code: "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", severity: "error", path: at, message: `validation condition references unknown field(s): ${unknown.join(", ")}.` });
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
  const strict = options.mode === "strict";
  return {
    ok: version !== null && (!strict || diagnostics.length === 0),
    version,
    fields: strict && diagnostics.length > 0 ? [] : fields,
    layout: strict && diagnostics.length > 0 ? [] : layout,
    rules: strict && diagnostics.length > 0 ? [] : rules,
    validations: strict && diagnostics.length > 0 ? [] : validations,
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


