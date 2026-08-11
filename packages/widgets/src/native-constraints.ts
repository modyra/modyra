/**
 * The rules a field states, as the attributes an input carries.
 *
 * A constraint declared once — `maxLength(50)` in a schema, `"maxLength": 50` in a document — should
 * reach the keyboard, not only the error list. Until now it reached neither for most of the family:
 * every renderer wrote `min`/`max` by hand for numbers and nothing wrote `maxlength` or `pattern` at
 * all, so a fifty-character field let someone type five hundred and told them afterwards.
 *
 * The translation lives here, once, because three renderers writing it separately is how they come
 * to disagree — and a fourth renderer would have to rediscover which attribute belongs to which
 * kind.
 *
 * **The boundary is the model.** These attributes constrain typing. A value arriving from anywhere
 * else — a draft, a server, `set()` — is kept whole and judged by the rules, exactly as
 * ADR 0029 requires of a widget: nothing here truncates, rounds or rewrites what a form holds.
 */
import type { MdyFieldConstraints } from "@modyra/core";
import type { MdyWidgetKind } from "./catalog.js";

/** An attribute an input carries, or `null` to leave it off. */
export type MdyNativeAttributes = Readonly<Record<string, string | null>>;

/** Kinds whose control is a text-like input, so lengths and patterns mean something. */
const TEXTUAL: ReadonlySet<string> = new Set(["text", "email", "password", "textarea"]);

/** Kinds whose control is numeric, so bounds and step mean something. */
const NUMERIC: ReadonlySet<string> = new Set(["number", "slider"]);

/**
 * What `kind` can carry of `constraints`.
 *
 * Only what the kind's own control understands: a `maxlength` on a number input is ignored by the
 * platform, and offering it would be a promise the widget does not keep. `inputType` is deliberately
 * absent — the kind decides what the input *is*, and a rule may not change it.
 */
export function nativeConstraintAttributes(
  kind: MdyWidgetKind | string,
  constraints: MdyFieldConstraints,
): MdyNativeAttributes {
  const numeric = NUMERIC.has(kind);
  const textual = TEXTUAL.has(kind);
  const attributes: Record<string, string | null> = {};

  if (numeric) {
    attributes["min"] = constraints.min === null ? null : String(constraints.min);
    attributes["max"] = constraints.max === null ? null : String(constraints.max);
    attributes["step"] = constraints.step === null ? null : String(constraints.step);
  }

  if (textual) {
    attributes["minlength"] =
      constraints.minLength === null ? null : String(constraints.minLength);
    attributes["maxlength"] =
      constraints.maxLength === null ? null : String(constraints.maxLength);
    // A textarea has no `pattern`: the platform ignores it there, and a rule that looks enforced and
    // is not is worse than one that plainly is not.
    attributes["pattern"] = kind === "textarea" ? null : constraints.pattern;
    attributes["inputmode"] = constraints.inputMode;
  }

  return attributes;
}

/**
 * Applies the attributes to an element, removing the ones that no longer apply.
 *
 * Removal matters as much as setting: a rule can be withdrawn at runtime — `removeValidators`, a
 * section coming back into play with different rules — and an attribute left behind constrains
 * typing on behalf of a rule that no longer exists.
 */
export function applyNativeConstraints(
  element: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void },
  attributes: MdyNativeAttributes,
): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
}
