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
 * The track a slider is drawn on, given what bounds it and what it holds.
 *
 * A slider has to span something to be drawn at all, and where nothing states a range it takes the
 * one a bare `<input type="range">` assumes. That default is the kind's, not a rule — and a default
 * is not a licence to misrepresent: a form holding `150` with no bound declared drew a track ending
 * at `100` and put the thumb there, so the page showed a number the form did not hold, with nothing
 * said. Both renderers had invented the same `?? 100` separately, which is how they came to agree
 * about a lie.
 *
 * **Widened only where nothing was declared.** A document that *did* declare `max: 50` keeps it:
 * the attribute is the native guard, it must not promise less than the rules it came from
 * (`VAL-004`), and since [ADR 0066](../../../docs/architecture/0066-a-bound-beside-the-field-is-a-rule.md)
 * a value past it is refused with a message — so the page explains the difference instead of hiding
 * it. Where nothing was declared there is no rule to explain anything, and showing the value is the
 * only honest answer left.
 *
 * **`step` is dropped where it would move the thumb.** The platform snaps a range input to a
 * multiple, so a value of `7` with `step: 5` was drawn at `5`. There is no step rule to appeal to —
 * the validator vocabulary has none — so the affordance gives way to the value.
 */
export function sliderTrack(
  constraints: Pick<MdyFieldConstraints, "min" | "max" | "step">,
  value: number | null,
): { readonly min: number; readonly max: number; readonly step: number | null } {
  const declaredMin = constraints.min;
  const declaredMax = constraints.max;
  let min = declaredMin ?? 0;
  let max = declaredMax ?? 100;
  const held = typeof value === "number" && Number.isFinite(value) ? value : null;
  if (held !== null && declaredMin === null && held < min) min = held;
  if (held !== null && declaredMax === null && held > max) max = held;
  const step = constraints.step;
  const onAStep =
    step === null || step <= 0 || held === null || Number.isInteger((held - min) / step);
  return { min, max, step: onAStep ? step : null };
}

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
  /** What the field holds, where the kind draws it — a slider's track spans it. */
  value?: number | null,
): MdyNativeAttributes {
  const numeric = NUMERIC.has(kind);
  const textual = TEXTUAL.has(kind);
  const attributes: Record<string, string | null> = {};

  if (numeric) {
    // A slider spans a track whether or not anything declared one — see {@link sliderTrack}, which
    // is where that default lives and where it is widened to hold what the field holds.
    const spans = kind === "slider";
    const track = spans ? sliderTrack(constraints, value ?? null) : null;
    const low = track ? track.min : constraints.min;
    const high = track ? track.max : constraints.max;
    const step = track ? track.step : constraints.step;
    attributes["min"] = low === null ? null : String(low);
    attributes["max"] = high === null ? null : String(high);
    attributes["step"] = step === null ? null : String(step);
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
 * What a control offers: the field's rules, narrowed by what the control itself asks for.
 *
 * A control may ask for **less** than the field accepts — a slider drawn over part of its range, a
 * number input a caller capped — and never for more: the rules are the authority, and offering
 * beyond them would invite a value the form is going to refuse. So each end takes whichever is
 * tighter, which is the same rule two validators already follow between themselves.
 */
/**
 * Strings a pattern comparison is tried against.
 *
 * Fixed and small on purpose: what this buys is a **counterexample**, and one is enough. Absence of
 * one is not a proof that a control's pattern is tighter — it is the honest limit of comparing two
 * regular expressions without deciding language containment, which is not something a render path
 * can afford to attempt.
 */
const PATTERN_PROBES: readonly string[] = Object.freeze([
  "", " ", "a", "ab", "abc", "abcd", "abcdefgh", "ABCD", "0", "01234", "a b", "xax", "-", "a-b", "é",
]);

/**
 * The pattern a control ends up offering.
 *
 * A control may ask for **less** than the field accepts and never for more, and a pattern is the one
 * constraint with no order between two of them: there is no expression that means "both" without
 * writing it. So the control's own is taken unless it can be *shown* to loosen — a probe the rules
 * refuse and the control's pattern accepts is that proof, and `^.*$` over `^[a-z]{4,}$` produces one
 * on the first string.
 *
 * Where no counterexample turns up, the control's pattern is taken: a control asking for a stricter
 * spelling of the same rule is the ordinary reason to narrow at all.
 */
function narrowedPattern(rules: string | null, offered: string | null): string | null {
  if (offered === null) return rules;
  if (rules === null || rules === offered) return offered;
  let ruled: RegExp;
  let control: RegExp;
  try {
    ruled = new RegExp(rules);
    control = new RegExp(offered);
  } catch {
    // One of them is not a pattern the platform can read; the rules are the authority.
    return rules;
  }
  const loosens = PATTERN_PROBES.some((probe) => control.test(probe) && !ruled.test(probe));
  return loosens ? rules : offered;
}

export function narrowConstraints(
  rules: MdyFieldConstraints,
  narrowing: Partial<MdyFieldConstraints> | undefined,
): MdyFieldConstraints {
  if (!narrowing) return rules;
  const higher = (a: number | null, b: number | null | undefined) =>
    a === null ? b ?? null : b === null || b === undefined ? a : Math.max(a, b);
  const lower = (a: number | null, b: number | null | undefined) =>
    a === null ? b ?? null : b === null || b === undefined ? a : Math.min(a, b);

  return {
    min: higher(rules.min, narrowing.min),
    max: lower(rules.max, narrowing.max),
    step: higher(rules.step, narrowing.step),
    minLength: higher(rules.minLength, narrowing.minLength),
    maxLength: lower(rules.maxLength, narrowing.maxLength),
    pattern: narrowedPattern(rules.pattern, narrowing.pattern ?? null),
    inputMode: narrowing.inputMode ?? rules.inputMode,
  };
}
