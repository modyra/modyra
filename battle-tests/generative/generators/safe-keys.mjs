/**
 * Keys a real system produces.
 *
 * Not random strings: the keys that break things are the ones that look like something else. An
 * entity id that is all digits, a provisional key with a colon, a leading zero that survives only if
 * nothing coerces it, a key long enough to be truncated somewhere.
 */

export const SAFE_KEY_SHAPES = Object.freeze([
  "digits",
  "leading-zero",
  "provisional",
  "uuid-ish",
  "slug",
  "unicode",
  "long",
]);

export function generateSafeKey(rng, { taken = [] } = {}) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const key = keyOfShape(rng, rng.pick(SAFE_KEY_SHAPES));
    if (!taken.includes(key)) return key;
  }
  // Uniqueness matters more than shape variety once the space is crowded.
  return `k${rng.int(1_000_000)}`;
}

function keyOfShape(rng, shape) {
  switch (shape) {
    case "digits":
      return String(rng.int(50));
    case "leading-zero":
      return `0${rng.int(20)}`;
    case "provisional":
      return `tmp:${rng.int(20)}`;
    case "uuid-ish":
      return `${hex(rng, 8)}-${hex(rng, 4)}`;
    case "slug":
      return `${rng.pick(["row", "line", "item"])}-${rng.int(40)}`;
    case "unicode":
      return `${rng.pick(["café", "naïve", "日本", "Ω"])}${rng.int(9)}`;
    case "long":
      return `${"segment".repeat(6)}${rng.int(9)}`;
    default:
      return String(rng.int(1000));
  }
}

function hex(rng, length) {
  return Array.from({ length }, () => "0123456789abcdef"[rng.int(16)]).join("");
}
