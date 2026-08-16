/**
 * What a form document declares: the shape of a field, the tree it sits in, and the flattening
 * that turns that tree into the list an engine can be built from.
 *
 * Declaration only. Nothing here reads untrusted input — that is `./parse.ts` — and nothing here
 * builds a form — that is `./compile.ts`.
 */

import { MDY_FIELD_KINDS } from "../field-kinds.js";
import { explainValueMismatch, type MdyValueKind } from "../value-contracts.js";
import { warnDev } from "./guards.js";
import type { MdySelectOption } from "../types.js";

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
  /**
   * The control's name when nothing visible carries it — a cell in a table, a control in a toolbar
   * whose column or icon says what it is to someone who can see it.
   *
   * Only read when `label` is empty. A visible label already names the control natively, and a
   * second name over the top of it is what makes a spoken name disagree with a written one — the
   * user asks for "Item" and the machine is listening for something else.
   */
  readonly ariaLabel?: string;
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
  /**
   * Short content set against the control — a currency mark, a unit, a domain.
   *
   * Rendered only when supplied: an always-present empty box is padding with nothing in it. Declared
   * on the kinds whose anatomy has the parts, which is the free-text family.
   */
  readonly prefix?: string;
  readonly suffix?: string;
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
 * How a multiselect chooses: the two shapes it has, and the only two it will have.
 *
 * A closed union rather than a string, because this name is the key the widget contract's variant
 * anatomy is declared under. Left open, a consumer could name a mode nothing describes and get a
 * widget checked against no anatomy at all — which is the gap the variants were added to close,
 * reintroduced through the front door.
 */
export type MdyMultiselectMode = "single" | "multi";

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
  readonly mode?: MdyMultiselectMode;
  /**
   * Select and multiselect only. Whether the list filters as the user types.
   *
   * It decides which of two interaction models the widget is, and they are genuinely different
   * controls to anyone not using a pointer:
   *
   * - **`false` (the default) is a listbox.** Focus stays on the trigger, typing accumulates into a
   *   typeahead buffer that jumps to the first matching option, and no filter box is drawn.
   * - **`true` is a combobox.** Focus moves into the search input on open and typing filters the
   *   list.
   *
   * Both drive the list with `aria-activedescendant` rather than moving focus into it.
   *
   * Contract data rather than a renderer input, because a renderer that cannot read it cannot honour
   * it — which is exactly how three adapters ended up with three behaviours for one widget.
   */
  readonly searchable?: boolean;
  /**
   * The options are being fetched. Select and multiselect show it on the control, so a field waiting
   * on its list says so without being opened.
   *
   * Distinct from the field's `pending`, which is asynchronous *validation* of a value the user has
   * already given.
   */
  readonly loading?: boolean;
}

/**
 * How a calendar is presented, independent of what it holds.
 *
 * Without these a form cannot ask for a locale other than the browser's, and a renderer has nothing
 * to consult but `navigator.language` — which is the visitor's preference, not the form's. A
 * booking form for an Italian office shows an Italian calendar to a visitor whose browser is in
 * English, and only the form knows that.
 */
export interface MdyDynamicCalendarOptions {
  /** BCP 47 tag. Unset follows the browser. Month and weekday names and the week's first day follow it. */
  readonly locale?: string;
  /**
   * 0 = Sunday … 6 = Saturday. Unset follows {@link MdyDynamicCalendarOptions.locale}, which is
   * almost always what a user expects; set it only to override the locale deliberately.
   */
  readonly firstDayOfWeek?: number;
  /** Earliest selectable date, ISO `yyyy-MM-dd`. Presentation only — bounds are enforced by validators. */
  readonly minDate?: string;
  /** Latest selectable date, ISO `yyyy-MM-dd`. */
  readonly maxDate?: string;
}

/** Single-instant date/time kinds. */
export interface MdyDynamicDateField extends MdyDynamicFieldBase, MdyDynamicCalendarOptions {
  readonly kind: "datepicker" | "timepicker";
}

/** A start/end pair. Its own interface so a `kind` switch narrows to one value shape. */
export interface MdyDynamicDaterangeField extends MdyDynamicFieldBase, MdyDynamicCalendarOptions {
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

/**
 * What a field of this kind holds when it holds nothing.
 *
 * One table, in the lowest layer, because "empty" is a property of the kind rather than of whoever
 * renders it: two adapters answering separately is how the same form validates differently in each.
 *
 * A kind whose empty value is a *usable* value cannot be required. `number` is `null` and not `0`
 * for exactly that reason — zero is a number the user may well mean, so a field defaulted to it is
 * one `required` can never fail. `slider` is the deliberate exception: a thumb is always somewhere,
 * so an untouched slider sits at its minimum and reads as filled.
 */
export function mdyEmptyValueFor(field: MdyDynamicField): unknown {
  if (field.initialValue !== undefined) {
    // An initial a kind cannot hold is refused where it is declared, rather than becoming the value
    // the form starts from. `parseDynamicForm` now says so about a document; this is the same
    // sentence for a tree written in code, which is a defect to report rather than input to survive.
    // Kept, it made a form that was invalid before anybody touched it — the field reporting "holds
    // string" about a value the user never entered and cannot see how to correct.
    const mismatch = (MDY_FIELD_KINDS as readonly unknown[]).includes(field.kind)
      ? explainValueMismatch(field.kind as MdyValueKind, field.initialValue)
      : null;
    if (mismatch !== null) {
      // Dropped rather than thrown, and named while it is dropped. A form is the thing a person is
      // looking at: refusing to build one over a declared initial takes the whole page away, while
      // keeping it made a form that was invalid before anybody touched it — reporting "holds string"
      // about a value the user never entered and cannot see how to correct. The kind's own empty
      // value is what the field would have started from had the document said nothing.
      warnDev(
        `Field "${field.name}" declares an initialValue its kind cannot hold (${mismatch}); ` +
        "the field starts empty instead.",
      );
      return emptyForKind(field);
    }
    return field.initialValue;
  }
  return emptyForKind(field);
}

/** What a field of this kind starts from when its document says nothing usable. */
function emptyForKind(field: MdyDynamicField): unknown {
  switch (field.kind) {
    case "number":
      return null;
    // Its own minimum, not zero: a slider bounded 10–20 that starts at 0 sits outside the range it
    // declares, and the first drag is the only thing that would ever bring it back in.
    case "slider":
      return field.min ?? 0;
    case "checkbox":
    case "toggle":
      return false;
    case "multiselect":
    case "file":
      return [];
    case "daterange":
      return { start: null, end: null };
    case "select":
    case "radio":
    case "segmented":
    case "datepicker":
    case "timepicker":
      return null;
    case "text":
    case "textarea":
    case "email":
    case "password":
    case "colors":
      return "";
    default:
      return assertNeverField(field);
  }
}

/** Exhaustiveness helper for kind switches. */
export function assertNeverField(field: never): never {
  throw new Error(
    `[modyra] Unknown dynamic field kind: ${JSON.stringify(field)}`,
  );
}

// ─── Runtime validation of network-borne configs ─────────────────────────────

/**
 * Every kind the dynamic renderer knows how to draw.
 *
 * The vocabulary itself is a leaf module: a kind is what a field is, not something a document
 * format owns. Re-exported here because a document names one.
 */
export const MDY_DYNAMIC_FIELD_KINDS = MDY_FIELD_KINDS;

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
  /**
   * A row's shape, a collection of either kind included: a row's descendants are addressed below
   * this collection's index, and a second positional level names its own rows the same way.
   */
  readonly item: MdyDynamicNode;
  readonly initialValue?: ReadonlyArray<unknown>;
  readonly minItems?: number;
  readonly maxItems?: number;
}
/**
 * A collection whose keys are data rather than positions — an entity id, a provisional key, a slug.
 *
 * A document declares the shape of a row and, where it has them, the rows it starts with. Which rows
 * exist afterwards is the application's word: `upsert` and `remove` on the handle. A document cannot
 * express that, and should not — it describes a form, not a session.
 */
export interface MdyDynamicRecordNode {
  readonly node: "record";
  readonly label?: string;
  /** A row's shape, a collection of either kind included — keys address it, so nothing moves. */
  readonly item: MdyDynamicNode;
  readonly initialValue?: Readonly<Record<string, unknown>>;
}
export type MdyDynamicNode =
  | MdyDynamicFieldNode
  | MdyDynamicGroupNode
  | MdyDynamicArrayNode
  | MdyDynamicRecordNode;

/** Flattens a recursive schema to the dotted/indexed paths consumed by the current renderer. */
/** A collection the schema declared, and which of the two kinds it is. */
export interface MdyDynamicCollection {
  readonly path: string;
  readonly kind: "array" | "record";
}
