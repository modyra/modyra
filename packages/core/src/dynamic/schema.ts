/**
 * What a form document declares: the shape of a field, the tree it sits in, and the flattening
 * that turns that tree into the list an engine can be built from.
 *
 * Declaration only. Nothing here reads untrusted input — that is `./parse.ts` — and nothing here
 * builds a form — that is `./compile.ts`.
 */

import { MDY_FIELD_KINDS } from "../field-kinds.js";
import type { MdyExpression } from "../expression.js";
import { explainValueMismatch, type MdyValueKind } from "../value-contracts.js";
import { warnDev } from "./guards.js";
import type { MdySelectOption } from "../types.js";
import type { MdyTimeFormat } from "../time-utils.js";

/**
 * Serializable validator set for dynamic fields — safe to store as JSON in
 * a CMS or form-builder backend.
 */
/**
 * What a document may say instead of the framework's own sentence, per rule.
 *
 * The cross-field slot has carried a **mandatory** `message` since it existed, with the reason
 * written beside it: *a validation nobody can read is a field that will not submit for no stated
 * reason*. A field's own rules had no such slot, so the only sentence a person must read to get any
 * further was the one an author could not write — and a document is the surface written by people
 * who do not write code.
 *
 * Optional here rather than mandatory: the framework has a sentence for every one of these, in the
 * form's own language, which the cross-field slot cannot have because only the author knows what the
 * relationship means.
 */
export interface MdyDynamicValidatorMessages {
  readonly required?: string;
  readonly email?: string;
  readonly min?: string;
  readonly max?: string;
  readonly minLength?: string;
  readonly maxLength?: string;
  readonly pattern?: string;
}

export interface MdyDynamicValidators {
  readonly required?: boolean;
  readonly email?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  /** RegExp source string. */
  readonly pattern?: string;
  /** What each rule says when it refuses, in the author's own words. */
  readonly messages?: MdyDynamicValidatorMessages;
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
  /**
   * The line under the control: a format, a limit, why the field is there.
   *
   * Every renderer already draws this slot and names it with `aria-describedby`, and until now
   * nothing could put words in it — so a screen reader following the reference arrived at an empty
   * element, which is worse than no reference at all. The slot was the promise; this is the half
   * that lets it be kept.
   *
   * Not an error. An error is a verdict on the value and comes and goes with it; this is a property
   * of the field and does not change when the value does.
   */
  readonly supportingText?: string;
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
   * Whether a person may rearrange what they chose — `multiselect` only. Absent means they may not.
   *
   * Off by default because most lists have an order nobody chose: a set of filters, a set of tags.
   * Where the order *is* the value — priorities, a playlist, the columns of a report — the field
   * says so, and both doors open: the keys `MDY_WIDGET_KEYBOARD` declares on a focused chip, and
   * dragging that same chip. A control whose only way to reorder is a pointer is one a keyboard
   * cannot reorder at all.
   */
  readonly reorderable?: boolean;
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
  /**
   * Which times this field offers, when it does not offer all of them — `timepicker` only.
   *
   * Data rather than a predicate, so a document can carry it and a server can send it. A step that
   * does not divide its unit, a window that covers no time, or two windows claiming the same
   * minutes are refused where the document declares them rather than behaving oddly later.
   */
  readonly granularity?: MdyTimeGranularity;
  /**
   * Which clock this field draws and reads — `timepicker` only. Absent is the 24-hour clock.
   *
   * The document carries it because the format is the field's own property and not the host's
   * taste: a form that means half past two in the afternoon means it in every renderer, and a
   * slot only a hand-written host can fill leaves a document-driven form with one clock available.
   * The stored value is the same either way; this decides what is drawn and what typing is read as.
   */
  readonly format?: MdyTimeFormat;
  /**
   * Which of the two views the picker opens in — `timepicker` only. Absent opens on the dial.
   *
   * Restored rather than seeded: closing the picker returns it here, so this is the view the field
   * *has* rather than the one it started with. A form collecting an exact time wants the number
   * boxes in front; one collecting an approximate time wants the face.
   */
  readonly viewMode?: MdyTimepickerViewMode;
  /**
   * Whether the dial's hand moves rather than jumps — `timepicker` only. Absent is a hand that
   * jumps, which is today's behaviour and the one that never shows a value where it is not.
   */
  readonly animateHand?: boolean;
  /**
   * Whether the dial shows which stretches of its ring carry no selectable time — `timepicker` only.
   *
   * Named for what it shows rather than for how it looks: a theme may express it as a dimmed arc or
   * as something else. Absent draws a ring that looks the same all the way round, which is what a
   * face with no declared granularity honestly is.
   */
  readonly showUnavailable?: boolean;
}

/**
 * The clock face, or the pair of number fields.
 *
 * Declared here rather than in the widget contract because a **document** names it, and a document
 * is parsed before anything renders it. The renderers read this one; a second copy beside them would
 * be a second answer to which views exist.
 */
export type MdyTimepickerViewMode = "dial" | "input";

/** A stretch of the day with a minute step of its own. Half-open: `from` inclusive, `to` exclusive. */
export interface MdyTimeWindow {
  readonly from: string;
  readonly to: string;
  readonly minuteStep: number;
}

/**
 * Which times a timepicker offers. Absent members mean every one.
 *
 * Declared here rather than imported, because the document schema is the lowest layer and must not
 * depend on what renders it. `@modyra/widgets` reads the same shape.
 */
export interface MdyTimeGranularity {
  /** Minutes between offered times. Must divide 60. */
  readonly minuteStep?: number;
  /** Hours between offered hours. Must divide 24. */
  readonly hourStep?: number;
  /** Stretches of the day whose minute step differs from the field's. */
  readonly windows?: readonly MdyTimeWindow[];
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

/**
 * One colour a palette offers, and what it is called.
 *
 * A hexadecimal is not a name. Read out, `#4361ee` is six characters somebody has to hold in their
 * head to compare with the next one — so a panel of ten is, to anyone who cannot see it, ten strings
 * that differ in the middle.
 *
 * The label is optional and this library supplies none for its own defaults, deliberately: a generic
 * palette naming `#4361ee` would be guessing, and an approximated colour name is worse than the
 * hexadecimal because it claims a meaning it does not have while the hexadecimal claims none. The
 * knowledge lives where the palette does — a team's colours have names, and this is where they say
 * them.
 */
export interface MdyColorPreset {
  readonly value: string;
  readonly label?: string;
}

/** Colour selection, optionally offering a preset palette. */
export interface MdyDynamicColorsField extends MdyDynamicFieldBase {
  readonly kind: "colors";
  readonly presets?: ReadonlyArray<string | MdyColorPreset>;
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

/**
 * When a node is in play, as data.
 *
 * A typed schema says this with a function and a document could not say it at all: what it had was
 * `rules`, which are form-level and name a leaf, so a condition on a cell of a row — the arrangement
 * where a row is a template and the key does not exist yet — was not expressible. An expression is,
 * because it is evaluated against **what encloses the clause**: inside a row that is the row, and
 * `{ root: true }` is how a row-level condition reaches back out to the form.
 *
 * A field out of play keeps its value, is not validated and is not submitted — the same state
 * `MdyFieldOptions.when` produces, because it *is* that state: the compiler turns this into one.
 */
export type MdyDynamicCondition = MdyExpression;

/*
 * Declared on a field and on a group, and not on a collection: the typed descriptors a document
 * compiles into carry a condition at those two levels, and a collection that must come and go is a
 * collection inside a group that says when. One spelling rather than two that mean the same.
 */

/** Recursive Contract v2 node: a renderable leaf, structural group, or repeatable array. */
export interface MdyDynamicFieldNode {
  readonly node: "field";
  readonly field: Omit<MdyDynamicField, "name">;
  /** Whether this field is in play. Contract v4. */
  readonly when?: MdyDynamicCondition;
  /**
   * Whether this field's asynchronous checks run at all. Contract v4.
   *
   * Read against the same thing `when` is, which inside a row is the row — so a check declared once
   * for a template asks about its own row rather than about the first one.
   */
  readonly asyncWhen?: MdyDynamicCondition;
}
export interface MdyDynamicGroupNode {
  readonly node: "group";
  readonly label?: string;
  readonly children: Readonly<Record<string, MdyDynamicNode>>;
  /** Whether the whole section is in play — it takes what it contains with it. Contract v4. */
  readonly when?: MdyDynamicCondition;
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
  /**
   * One row's shape, flattened with names relative to the row.
   *
   * The flat fields describe the rows a document *has*; a collection declared with none has nothing
   * in the field list, and a form rebuilt from the pair alone then had no shape to make a row from —
   * it accepted a row and held an empty object, saying the row was there and that it was not at the
   * same moment. The template is that shape, so the rebuild answers the same as the tree.
   *
   * A row that is itself a leaf is the single field named `""`; a row that is itself a collection is
   * the single collection at path `""`.
   */
  readonly item?: MdyDynamicFlatForm;
}

/** A document taken apart: the flat fields a renderer consumes and the collections they came from. */
export interface MdyDynamicFlatForm {
  readonly fields: readonly MdyDynamicField[];
  readonly collections: readonly MdyDynamicCollection[];
}
