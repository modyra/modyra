import { MdySelectOption, ValidatorFn } from "./types.js";
import {
  eachOneOf,
  email,
  completeRange,
  max,
  maxLength,
  min,
  minLength,
  oneOf,
  pattern,
  required,
} from "./validators.js";

/**
 * Serializable validator set for dynamic fields — safe to store as JSON in
 * a CMS or form-builder backend.
 */
export interface MdyDynamicValidators {
  readonly required?: boolean;
  readonly email?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  /** RegExp source string. */
  readonly pattern?: string;
}

interface MdyDynamicFieldBase {
  readonly name: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly initialValue?: unknown;
  readonly validators?: MdyDynamicValidators;
  /**
   * Whether this field's value may be shown in the clear by the devtools panel.
   *
   * Left unset, the panel guesses from the field's name — `password`, `token`, `iban` and a handful
   * of others are masked. A guess is right often enough to be useful and wrong often enough to
   * matter in both directions: `notes` can hold a recovery phrase, and `cardStyle` is masked for
   * containing "card". Setting this decides it, and a field that says `true` is masked whatever it
   * is called.
   */
  readonly sensitive?: boolean;
}

/** Free-text kinds. */
export interface MdyDynamicTextField extends MdyDynamicFieldBase {
  readonly kind: "text" | "textarea" | "email" | "password";
}

/** Numeric kinds. */
export interface MdyDynamicNumberField extends MdyDynamicFieldBase {
  readonly kind: "number" | "slider";
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

/** Boolean kinds. */
export interface MdyDynamicBooleanField extends MdyDynamicFieldBase {
  readonly kind: "checkbox" | "toggle";
}

/**
 * Option-based kinds. The declared options are also a whitelist:
 * {@link buildDynamicFieldValidators} automatically constrains the field
 * value to them (`oneOf` / `eachOneOf`), so a value outside the list —
 * scripted `set()`, tampered draft, LLM hallucination — fails validation.
 */
export interface MdyDynamicOptionsField extends MdyDynamicFieldBase {
  readonly kind: "select" | "radio" | "multiselect" | "segmented";
  readonly options: ReadonlyArray<MdySelectOption<unknown>>;
  /**
   * Multiselect only. `"single"` (the default) is a toggle set: an option is either chosen or not.
   * `"multi"` is a bag: the same option can be taken several times and the chip counts them.
   */
  readonly mode?: "single" | "multi";
}

/** Single-instant date/time kinds. */
export interface MdyDynamicDateField extends MdyDynamicFieldBase {
  readonly kind: "datepicker" | "timepicker";
}

/** A start/end pair. Its own interface so a `kind` switch narrows to one value shape. */
export interface MdyDynamicDaterangeField extends MdyDynamicFieldBase {
  readonly kind: "daterange";
}

/** File selection. `accept` and `multiple` mirror the native input attributes. */
export interface MdyDynamicFileField extends MdyDynamicFieldBase {
  readonly kind: "file";
  readonly accept?: string;
  readonly multiple?: boolean;
}

/** Colour selection, optionally offering a preset palette. */
export interface MdyDynamicColorsField extends MdyDynamicFieldBase {
  readonly kind: "colors";
  readonly presets?: ReadonlyArray<string>;
}

/** One field of a dynamic form — a serializable discriminated union. */
export type MdyDynamicField =
  | MdyDynamicTextField
  | MdyDynamicNumberField
  | MdyDynamicBooleanField
  | MdyDynamicOptionsField
  | MdyDynamicDateField
  | MdyDynamicDaterangeField
  | MdyDynamicFileField
  | MdyDynamicColorsField;

/** Exhaustiveness helper for kind switches. */
export function assertNeverField(field: never): never {
  throw new Error(
    `[modyra] Unknown dynamic field kind: ${JSON.stringify(field)}`,
  );
}

// ─── Runtime validation of network-borne configs ─────────────────────────────

/** Every kind the dynamic renderer knows how to draw. */
export const MDY_DYNAMIC_FIELD_KINDS = [
  "text", "textarea", "email", "password",
  "number", "slider",
  "checkbox", "toggle",
  "select", "radio", "multiselect", "segmented",
  "datepicker", "daterange", "timepicker",
  "file", "colors",
] as const;

/**
 * What separates the segments of a generated DOM id (`@modyra/widgets`' id factory builds
 * `${widgetId}__${part}`). It lives here, in the lowest layer, because both the id factory and the
 * name rules below have to agree on it and `@modyra/core` cannot import `@modyra/widgets`.
 *
 * A field name containing it collides: `part("a", "label")` and a field named `a__label` both land
 * on `a__label`, in different roles, and the browser is happy to hold two elements with one id —
 * so `getElementById`, `label[for]` and every ARIA IDREF stop being deterministic.
 */
export const MDY_ID_DELIMITER = "__";

const MDY_MAX_DYNAMIC_PATTERN_LENGTH = 256;
const MDY_FORBIDDEN_DYNAMIC_NAMES = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasValidOptions(options: unknown): options is ReadonlyArray<MdySelectOption<unknown>> {
  if (!Array.isArray(options)) return false;
  return options.every((option) => {
    if (typeof option !== "object" || option === null) return false;
    const candidate = option as Partial<MdySelectOption<unknown>>;
    if (!("value" in candidate)) return false;
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
  }
  return true;
}


/** Recursive Contract v2 node: a renderable leaf, structural group, or repeatable array. */
export interface MdyDynamicFieldNode {
  readonly node: "field";
  readonly field: Omit<MdyDynamicField, "name">;
}
export interface MdyDynamicGroupNode {
  readonly node: "group";
  readonly label?: string;
  readonly children: Readonly<Record<string, MdyDynamicNode>>;
}
export interface MdyDynamicArrayNode {
  readonly node: "array";
  readonly label?: string;
  readonly item: MdyDynamicFieldNode | MdyDynamicGroupNode;
  readonly initialValue?: ReadonlyArray<unknown>;
  readonly minItems?: number;
  readonly maxItems?: number;
}
export type MdyDynamicNode = MdyDynamicFieldNode | MdyDynamicGroupNode | MdyDynamicArrayNode;

/** Flattens a recursive schema to the dotted/indexed paths consumed by the current renderer. */
export function flattenDynamicSchema(schema: MdyDynamicGroupNode): MdyDynamicField[] {
  const out: MdyDynamicField[] = [];
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
    const rows = Array.isArray(initial) ? initial : Array.isArray(node.initialValue) ? node.initialValue : [];
    rows.forEach((row, index) => visit(node.item, `${path}.${index}`, row));
  };
  visit(schema, "", undefined);
  return out;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSafeDynamicSegment(value: string): boolean {
  return value.length > 0 && !value.includes(".") && !MDY_FORBIDDEN_DYNAMIC_NAMES.has(value);
}

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

/** The sizes a row can be authored against, mirroring `MDY_LAYOUT_BREAKPOINTS` in `@modyra/widgets`. */
export type MdyDynamicBreakpoint = "base" | "sm" | "md" | "lg";

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

/** Contract v2 adds declarative layout and conditions, never executable code. */
export interface MdyDynamicFormConfigV2 {
  readonly version: 2;
  readonly id?: string;
  readonly fields?: ReadonlyArray<MdyDynamicField>;
  readonly schema?: MdyDynamicGroupNode;
  readonly layout?: ReadonlyArray<MdyDynamicLayoutNode>;
  readonly rules?: ReadonlyArray<MdyDynamicRule>;
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
  readonly layout: ReadonlyArray<MdyDynamicLayoutNode>;
  readonly rules: ReadonlyArray<MdyDynamicRule>;
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
  return items.filter((item): item is MdyDynamicField => {
    if (typeof item !== "object" || item === null) {
      warnDev(`Dropped non-object dynamic field: ${JSON.stringify(item)}`);
      return false;
    }
    const f = item as Partial<MdyDynamicField>;
    if (typeof f.name !== "string" || f.name.length === 0) {
      warnDev(`Dropped dynamic field without a name: ${JSON.stringify(item)}`);
      return false;
    }
    if (f.name.includes(".") || MDY_FORBIDDEN_DYNAMIC_NAMES.has(f.name)) {
      warnDev(
        `Dropped dynamic field "${f.name}": name is reserved or contains forbidden path separators.`,
      );
      return false;
    }
    if (f.name.includes(MDY_ID_DELIMITER)) {
      warnDev(
        `Dropped dynamic field "${f.name}": "${MDY_ID_DELIMITER}" separates the segments of a generated id, ` +
          `so this name would collide with another field's parts.`,
      );
      return false;
    }
    if (seenNames.has(f.name)) {
      warnDev(`Dropped duplicate dynamic field name "${f.name}".`);
      return false;
    }
    seenNames.add(f.name);
    if (!(MDY_DYNAMIC_FIELD_KINDS as readonly unknown[]).includes(f.kind)) {
      warnDev(`Dropped dynamic field "${f.name}" with unknown kind "${String(f.kind)}".`);
      return false;
    }
    if (f.label !== undefined && typeof f.label !== "string") {
      warnDev(`Dropped dynamic field "${f.name}": label must be a string.`);
      return false;
    }
    if (f.sensitive !== undefined && typeof f.sensitive !== "boolean") {
      warnDev(`Dropped dynamic field "${f.name}": sensitive must be a boolean.`);
      return false;
    }
    if (f.placeholder !== undefined && typeof f.placeholder !== "string") {
      warnDev(
        `Dropped dynamic field "${f.name}": placeholder must be a string.`,
      );
      return false;
    }
    if (!hasValidValidatorConfig(f.validators, f.name)) {
      return false;
    }
    if (f.kind === "number" || f.kind === "slider") {
      const numberField = f as Partial<MdyDynamicNumberField>;
      if (numberField.min !== undefined && !isFiniteNumber(numberField.min)) {
        warnDev(`Dropped dynamic field "${f.name}": min must be a finite number.`);
        return false;
      }
      if (numberField.max !== undefined && !isFiniteNumber(numberField.max)) {
        warnDev(`Dropped dynamic field "${f.name}": max must be a finite number.`);
        return false;
      }
      if (
        numberField.min !== undefined &&
        numberField.max !== undefined &&
        numberField.min > numberField.max
      ) {
        warnDev(`Dropped dynamic field "${f.name}": min cannot exceed max.`);
        return false;
      }
      if (numberField.step !== undefined) {
        if (!isFiniteNumber(numberField.step)) {
          warnDev(`Dropped dynamic field "${f.name}": step must be a finite number.`);
          return false;
        }
        if (numberField.step <= 0) {
          warnDev(`Dropped dynamic field "${f.name}": step must be greater than zero.`);
          return false;
        }
      }
    }
    const needsOptions = ["select", "radio", "multiselect", "segmented"];
    if (needsOptions.includes(f.kind as string)) {
      const options = (f as { options?: unknown }).options;
      if (!hasValidOptions(options)) {
        warnDev(
          `Dropped dynamic field "${f.name}": kind "${String(f.kind)}" requires a valid options array.`,
        );
        return false;
      }
    }
    return true;
  });
}

let diagnosticSink: ((message: string) => void) | undefined;

function warnDev(message: string): void {
  diagnosticSink?.(message);
  console.warn(`[modyra] ${message}`);
}

function diagnosticCode(message: string): string {
  if (message.includes("Unsupported dynamic form config version")) return "MDY_DYNAMIC_UNSUPPORTED_VERSION";
  if (message.includes("duplicate dynamic field")) return "MDY_DYNAMIC_DUPLICATE_NAME";
  if (message.includes("reserved or contains forbidden")) return "MDY_DYNAMIC_UNSAFE_NAME";
  if (message.includes("unknown kind")) return "MDY_DYNAMIC_UNKNOWN_KIND";
  if (message.includes("requires a valid options")) return "MDY_DYNAMIC_OPTIONS_REQUIRED";
  if (message.includes("pattern length")) return "MDY_DYNAMIC_PATTERN_TOO_LONG";
  return "MDY_DYNAMIC_INVALID_FIELD";
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
function validLayoutNode(
  raw: unknown,
  names: ReadonlySet<string>,
  seen: Set<string>,
  depth: number,
  allowSlots: boolean,
): boolean {
  if (depth > MDY_LAYOUT_MAX_DEPTH || !isRecordValue(raw)) return false;
  const node = raw as Partial<MdyDynamicLayoutNode>;
  if (typeof node.id !== "string") return false;

  const slots: ReadonlyArray<ReadonlyArray<unknown>> =
    node.kind === "section"
      ? Array.isArray(node.children) ? [node.children] : []
      : node.kind === "columns"
        ? Array.isArray(node.columns) && node.columns.every(Array.isArray) ? (node.columns as unknown[][]) : []
        : [];
  if (!slots.length && node.kind !== "section" && node.kind !== "columns") return false;
  if (node.kind === "section" && !Array.isArray(node.children)) return false;
  if (node.kind === "columns" && (!Array.isArray(node.columns) || !node.columns.every(Array.isArray))) return false;
  // `at` is untrusted like everything else here: a track count that is not a small positive integer
  // would reach the renderer as a custom property and produce a grid nobody asked for.
  if (node.kind === "columns" && node.at !== undefined) {
    if (!isRecordValue(node.at)) return false;
    for (const [size, count] of Object.entries(node.at)) {
      if (!["base", "sm", "md", "lg"].includes(size)) return false;
      if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MDY_MAX_LAYOUT_COLUMNS) return false;
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
        if (!validFieldReference(child, names) || seen.has(child)) return false;
        seen.add(child);
      } else if (isRecordValue(child) && "ref" in child) {
        // A v3 slot. Refused outright below v3: accepting it would make this parser disagree with
        // every other reader of the same document about what the contract says.
        if (!allowSlots) return false;
        if (!validSlot(child, names, seen, trackCount)) return false;
      } else {
        if (!validLayoutNode(child, names, seen, depth + 1, allowSlots)) return false;
        // A section's `at` describes the column *this* node gives it, not its own children, so it is
        // checked here rather than inside its own validation. A nested row's `at` is a track count
        // and belongs to that row, which is why only a section is asked. Below v3 the key does not
        // exist, exactly as for a slot.
        const nested = child as Partial<MdyDynamicSection>;
        if (nested.kind === "section" && nested.at !== undefined) {
          if (!allowSlots || !validPlacement(nested.at, trackCount)) return false;
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
    if (!["base", "sm", "md", "lg"].includes(size)) return false;
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
  let count = 0;
  const visit = (raw: unknown, path: string, depth: number): void => {
    count += 1;
    if (depth > 8 || count > 500) { out.push({ code: "MDY_DYNAMIC_SCHEMA_LIMIT", severity: "error", path, message: "schema exceeds depth/node limits." }); return; }
    if (!isRecordValue(raw) || !["field", "group", "array"].includes(String(raw["node"]))) { out.push({ code: "MDY_DYNAMIC_INVALID_NODE", severity: "error", path, message: "node must be field, group, or array." }); return; }
    if (raw["node"] === "field") {
      if (!isRecordValue(raw["field"])) out.push({ code: "MDY_DYNAMIC_INVALID_FIELD", severity: "error", path: `${path}/field`, message: "field node requires a field object." });
      return;
    }
    if (raw["node"] === "group") {
      if (!isRecordValue(raw["children"])) { out.push({ code: "MDY_DYNAMIC_INVALID_GROUP", severity: "error", path, message: "group requires children." }); return; }
      for (const [key, child] of Object.entries(raw["children"])) {
        if (!isSafeDynamicSegment(key)) out.push({ code: "MDY_DYNAMIC_UNSAFE_NAME", severity: "error", path: `${path}/children/${key}`, message: "unsafe child name." });
        else visit(child, `${path}/children/${key}`, depth + 1);
      }
      return;
    }
    if (!isRecordValue(raw["item"])) out.push({ code: "MDY_DYNAMIC_INVALID_ARRAY", severity: "error", path, message: "array requires an item node." });
    else visit(raw["item"], `${path}/item`, depth + 1);
    if (raw["initialValue"] !== undefined && !Array.isArray(raw["initialValue"])) out.push({ code: "MDY_DYNAMIC_INVALID_ARRAY", severity: "error", path: `${path}/initialValue`, message: "array initialValue must be an array." });
    if (Array.isArray(raw["initialValue"]) && raw["initialValue"].length > 100) out.push({ code: "MDY_DYNAMIC_SCHEMA_LIMIT", severity: "error", path: `${path}/initialValue`, message: "array initialValue exceeds 100 rows." });
  };
  visit(input, "/schema", 0);
  return out;
}

/** Parses v1/v2 untrusted input with structured diagnostics. */
export function parseDynamicForm(
  input: unknown,
  options: { readonly mode?: MdyDynamicParseMode } = {},
): MdyDynamicFormParseResult {
  const diagnostics: MdyDynamicDiagnostic[] = [];
  const previousSink = diagnosticSink;
  diagnosticSink = (message) => diagnostics.push({
    code: diagnosticCode(message), severity: "error", path: "/fields", message,
  });
  const rawEnvelope = typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as { version?: unknown; schema?: unknown }
    : undefined;
  let fields: MdyDynamicField[];
  try {
    fields = (rawEnvelope?.version === 2 || rawEnvelope?.version === 3) && rawEnvelope.schema !== undefined
      ? []
      : parseDynamicFields(input);
  } finally { diagnosticSink = previousSink; }

  const envelope = typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as { version?: unknown; fields?: unknown; schema?: unknown; layout?: unknown; rules?: unknown }
    : undefined;
  const version: 1 | 2 | 3 | null = Array.isArray(input) || envelope?.version === 1
    ? 1 : envelope?.version === 2 ? 2 : envelope?.version === 3 ? 3 : null;
  // v3 is v2 plus per-slot placement: every envelope member is read the same way, and only the
  // layout validator is told which vocabulary the document is entitled to use.
  const structured = version === 2 || version === 3;
  if (structured && envelope?.schema !== undefined) {
    const schemaDiagnostics = validateDynamicSchema(envelope.schema);
    diagnostics.push(...schemaDiagnostics);
    if (schemaDiagnostics.length === 0) fields = flattenDynamicSchema(envelope.schema as MdyDynamicGroupNode);
  }
  const names = new Set(fields.map((field) => field.name));
  const layout: MdyDynamicLayoutNode[] = [];
  const rules: MdyDynamicRule[] = [];
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
      if (!validLayoutNode(raw, names, placed, 1, version === 3)) {
        diagnostics.push({ code: "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", severity: "error", path: `/layout/${index}`, message: "layout references an unknown or already-placed field, or has an invalid shape." });
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
  }

  const sourceCount = Array.isArray(input) ? input.length : Array.isArray(envelope?.fields) ? envelope.fields.length : fields.length;
  const rejectedCount = Math.max(0, sourceCount - fields.length) + diagnostics.filter((d) => d.path.startsWith("/layout/") || d.path.startsWith("/rules/")).length;
  const strict = options.mode === "strict";
  return {
    ok: version !== null && (!strict || diagnostics.length === 0),
    version,
    fields: strict && diagnostics.length > 0 ? [] : fields,
    layout: strict && diagnostics.length > 0 ? [] : layout,
    rules: strict && diagnostics.length > 0 ? [] : rules,
    diagnostics, acceptedCount: fields.length, rejectedCount,
  };
}

/**
 * Maps the serializable validator set to validator functions.
 * Returns the functions plus whether the set marks the field required.
 */
export function buildDynamicValidators(config: MdyDynamicValidators): {
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
  readonly marksRequired: boolean;
} {
  const out: Array<ValidatorFn<never>> = [];
  if (config.required) out.push(required());
  if (config.email) out.push(email() as ValidatorFn<never>);
  if (config.min !== undefined) out.push(min(config.min) as ValidatorFn<never>);
  if (config.max !== undefined) out.push(max(config.max) as ValidatorFn<never>);
  if (config.minLength !== undefined) {
    out.push(minLength(config.minLength) as ValidatorFn<never>);
  }
  if (config.maxLength !== undefined) {
    out.push(maxLength(config.maxLength) as ValidatorFn<never>);
  }
  if (config.pattern !== undefined) {
    if (config.pattern.length > MDY_MAX_DYNAMIC_PATTERN_LENGTH) {
      warnDev(
        `Skipped dynamic pattern validator: pattern length ${config.pattern.length} exceeds max ${MDY_MAX_DYNAMIC_PATTERN_LENGTH}.`,
      );
    } else {
      try {
        out.push(pattern(new RegExp(config.pattern)) as ValidatorFn<never>);
      } catch {
        warnDev(
          `Skipped dynamic pattern validator: invalid RegExp source "${config.pattern}".`,
        );
      }
    }
  }
  return { validators: out, marksRequired: config.required === true };
}

/**
 * Builds the full validator set for one dynamic field: the configured
 * validators ({@link buildDynamicValidators}) plus, for option-based
 * kinds, an automatic whitelist of the declared option values — the
 * client-side anti-tampering guard ("select offers one/two → three is
 * invalid"). `select`/`radio`/`segmented` get `oneOf`, `multiselect` gets
 * `eachOneOf`. Prefer this over {@link buildDynamicValidators} whenever
 * the whole field config is available.
 */
export function buildDynamicFieldValidators(field: MdyDynamicField): {
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
  readonly marksRequired: boolean;
} {
  const base = buildDynamicValidators(field.validators ?? {});
  if (
    field.kind === "select" ||
    field.kind === "radio" ||
    field.kind === "segmented"
  ) {
    const values = field.options.map((option) => option.value);
    return {
      validators: [...base.validators, oneOf(values) as ValidatorFn<never>],
      marksRequired: base.marksRequired,
    };
  }
  if (field.kind === "multiselect") {
    const values = field.options.map((option) => option.value);
    return {
      validators: [...base.validators, eachOneOf(values) as ValidatorFn<never>],
      marksRequired: base.marksRequired,
    };
  }
  // A half-set range names no interval, so it is invalid whether or not the field is required —
  // the same way an option outside the declared set is invalid above. Leaving it to `required`
  // would mean an optional range could be submitted with a start and no end.
  if (field.kind === "daterange") {
    return {
      validators: [...base.validators, completeRange() as ValidatorFn<never>],
      marksRequired: base.marksRequired,
    };
  }
  return base;
}
