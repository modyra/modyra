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

/** Case-insensitive comparison for equivalent HEX spellings. */
export function colorValueEquals(left: string | null, right: string): boolean {
  return (left ?? "").toLowerCase() === right.toLowerCase();
}
