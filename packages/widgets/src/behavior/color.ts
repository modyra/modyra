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
