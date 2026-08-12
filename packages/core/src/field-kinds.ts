/**
 * The kinds a field can be, and nothing else.
 *
 * A leaf, deliberately. The list used to live inside the dynamic-form parser, and everything that
 * needed the vocabulary — the value contracts above all — reached into a thirteen-hundred-line
 * module to get it, which made the canonical type of this library the property of a JSON parser and
 * closed a cycle between three modules that only compiled because the build erases type-only edges.
 *
 * A kind is what a field *is*. Where it came from — a typed schema, a document over a network — is
 * somebody else's question.
 */
export const MDY_FIELD_KINDS = [
  "text", "textarea", "email", "password",
  "number", "slider",
  "checkbox", "toggle",
  "select", "radio", "multiselect", "segmented",
  "datepicker", "daterange", "timepicker",
  "file", "colors",
] as const;

/** Every kind the library describes a value, a contract and a widget for. */
export type MdyFieldKind = (typeof MDY_FIELD_KINDS)[number];
