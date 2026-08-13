/**
 * Values worth writing into a field.
 *
 * Weighted towards the ones that have somewhere to go wrong — the empty string that decides whether
 * a required field is filled, a string of digits into a text field, whitespace that looks like
 * content, a value long enough to meet a length cap.
 */

export function generateTextValue(rng) {
  return rng.weighted([
    ["", 3],
    [" ", 1],
    ["A1", 3],
    [String(rng.int(1000)), 2],
    [`row-${rng.int(100)}`, 2],
    ["  padded  ", 1],
    ["x".repeat(64), 1],
    ["ünïcøde", 1],
  ]);
}

export function generateRowValue(rng, cells) {
  return Object.fromEntries(cells.map((cell) => [cell, generateTextValue(rng)]));
}

/** A partial row — what a patch carries when only some cells are known. */
export function generatePartialRow(rng, cells) {
  const chosen = cells.filter(() => rng.bool(0.5));
  const used = chosen.length > 0 ? chosen : [rng.pick(cells)];
  return Object.fromEntries(used.map((cell) => [cell, generateTextValue(rng)]));
}
