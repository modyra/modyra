/**
 * The colours a field offers when a document names none.
 *
 * Three renderers each carried a list of their own — eight colours in one, ten in another, fourteen
 * in the third — so the same document drew a different palette depending on which adapter rendered
 * it, and none of the three could be pointed at as the one the library suggests.
 *
 * Eight hues around the wheel and two neutrals: enough to cover what a person reaches for without a
 * grid nobody scans, and no relation to the theme's own tokens, because a suggestion is not a
 * decision about the page.
 */
export const MDY_COLOR_PRESETS: readonly string[] = Object.freeze([
  "#4361ee", "#4895ef", "#4cc9f0", "#10b981",
  "#f59e0b", "#e63946", "#f72585", "#7209b7",
  "#18181b", "#ffffff",
]);

/** A HEX value, and the one rule that matters: a partial spelling is not a colour and is not an error either. */
export type MdyColorValueIntent =
  | { readonly type: "native"; readonly value: string }
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "preset"; readonly value: string };

export interface MdyColorValueTransition {
  readonly value: string | undefined;
  readonly close: boolean;
  readonly touched: boolean;
}

/** Canonical HEX transition. Invalid partial text preserves the committed value. */
export function colorValueTransition(intent: MdyColorValueIntent): MdyColorValueTransition {
  const raw = intent.value.trim();
  const candidate = raw.startsWith("#") ? raw : `#${raw}`;
  const valid = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(candidate);
  return {
    value: valid ? candidate : undefined,
    close: intent.type === "preset" && valid,
    touched: intent.type === "preset" && valid,
  };
}

/**
 * Case-insensitive comparison for equivalent HEX spellings.
 *
 * Either side may be absent. A colour field holds a string by contract, but this function is
 * published and decides whether the swatch redraws, whether the field is dirty and whether a draft
 * is written — so a caller holding a colour nobody has chosen yet asks the question on both sides.
 * Two absences are the same colour; one absence is not the colour on the other side.
 */
export function colorValueEquals(left: string | null | undefined, right: string | null | undefined): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return (left ?? null) === (right ?? null);
  }
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * A palette as pairs of value and name, however a document spelled it.
 *
 * A document may write a colour as a string or as a value with a label, and every renderer needs the
 * same two facts from either shape — the colour to paint and the words to announce. Normalised in
 * one place so three renderers do not each decide what an unlabelled entry is called.
 *
 * An entry with no label is announced by its value. That is poor and it is honest: nobody has named
 * `#4361ee`, and a name invented here would claim a meaning it does not have.
 */
export function colorPresetsOf(
  presets: ReadonlyArray<string | { readonly value: string; readonly label?: string }> | undefined,
): ReadonlyArray<{ readonly value: string; readonly label: string }> {
  const given = presets !== undefined && presets.length > 0 ? presets : MDY_COLOR_PRESETS;
  return Object.freeze(given.map((entry) => {
    const value = typeof entry === "string" ? entry : entry.value;
    const label = typeof entry === "string" ? undefined : entry.label;
    return Object.freeze({ value, label: label === undefined || label === "" ? value : label });
  }));
}
