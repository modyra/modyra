/**
 * Whether a rectangle of the page has anything drawn in it.
 *
 * Every reading this suite takes from the DOM — text content, a bounding box, a computed style — is
 * taken *before* the browser decides what a person sees. Whitespace collapses, a box sits where its
 * ink does not, a smaller digit reads as a separate token. Three findings were overturned inside that
 * gap in one day, and each was a claim about perception measured with an instrument for structure.
 *
 * So a claim whose verb belongs to a person — *reads*, *sees*, *distinguishes*, *notices* — is settled
 * here instead: on the pixels, which are what the person actually gets.
 *
 * **What this file answers, and what it does not.** `paintedFraction` asks one question: *is anything
 * painted here that differs from the local background*. That is the right question for "is this
 * control drawn at all", because a mark in the background colour and no mark are the same thing to a
 * person.
 *
 * It is the wrong question for anything about **contrast**, and it will answer confidently and
 * uselessly: a focus ring at 1.05:1 paints a healthy non-zero fraction and is invisible. *Painted is
 * not perceivable.* A claim about a focus indicator surviving forced colours, a swatch boundary
 * against its panel, or a selected state being distinguishable needs `contrastOf`, which measures the
 * ratio between the mark and what it sits on rather than counting pixels that differ.
 *
 * Playwright writes 8-bit PNGs, non-interlaced, with or without an alpha channel depending on whether
 * the shot has any transparency — so the decode is short enough to keep rather than to depend on:
 * concatenate the `IDAT` chunks, inflate, and undo the per-scanline filter. Anything else — a palette,
 * 16 bits, interlacing — is refused loudly rather than guessed at, because a decoder that quietly
 * returns the wrong pixels is the same failure this file exists to prevent.
 */

import { inflateSync } from "node:zlib";

/** @returns {{ width: number, height: number, pixels: Uint8Array }} */
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("[battle] not a PNG");
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  let interlace = 0;
  const parts = [];

  for (let at = 8; at < buffer.length;) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString("ascii", at + 4, at + 8);
    const body = buffer.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colour = body[9];
      interlace = body[12];
    } else if (type === "IDAT") parts.push(body);
    else if (type === "IEND") break;
    at += length + 12;
  }

  // 2 is RGB, 6 is RGBA. Playwright emits whichever the shot needs.
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
  if (depth !== 8 || channels === 0 || interlace !== 0) {
    throw new Error(`[battle] this decoder reads 8-bit RGB or RGBA only; got depth ${depth}, colour type ${colour}, interlace ${interlace}`);
  }

  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const pixels = new Uint8Array(height * stride);

  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, row * (stride + 1) + 1 + stride);
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? pixels[row * stride + index - channels] : 0;
      const up = row > 0 ? pixels[(row - 1) * stride + index] : 0;
      const upLeft = row > 0 && index >= channels ? pixels[(row - 1) * stride + index - channels] : 0;
      let value = line[index];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const dl = Math.abs(p - left);
        const du = Math.abs(p - up);
        const dul = Math.abs(p - upLeft);
        value += dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      } else if (filter !== 0) throw new Error(`[battle] unknown PNG row filter ${filter}`);
      pixels[row * stride + index] = value & 0xff;
    }
  }

  return { width, height, pixels, channels };
}

/**
 * How much of a region differs from its own most common colour.
 *
 * The background is taken from the image rather than named by the caller: a region's own dominant
 * colour is what a mark has to stand out from, whatever the theme made it. `tolerance` is per channel,
 * so anti-aliasing at the edge of a glyph does not read as a mark on its own — but a glyph's body does.
 */
export function paintedFraction(png, tolerance = 12) {
  const { width, height, pixels, channels } = png;
  const counts = new Map();
  for (let at = 0; at < pixels.length; at += channels) {
    const key = `${pixels[at]},${pixels[at + 1]},${pixels[at + 2]},${channels === 4 ? pixels[at + 3] : 255}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let background = "";
  let most = -1;
  for (const [key, count] of counts) if (count > most) { most = count; background = key; }
  const [br, bg, bb, ba] = background.split(",").map(Number);

  let different = 0;
  for (let at = 0; at < pixels.length; at += channels) {
    const alpha = channels === 4 ? pixels[at + 3] : 255;
    if (Math.abs(pixels[at] - br) > tolerance
      || Math.abs(pixels[at + 1] - bg) > tolerance
      || Math.abs(pixels[at + 2] - bb) > tolerance
      || Math.abs(alpha - ba) > tolerance) different += 1;
  }
  const total = width * height;
  return { fraction: total === 0 ? 0 : different / total, different, total, background };
}

/** Relative luminance, as WCAG defines it. */
function luminance(r, g, b) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * The contrast between what is painted in a region and the background it is painted on.
 *
 * The background is the region's own dominant colour, as above. The mark is the colour furthest from
 * it in luminance — not the average, because averaging a thin dark glyph across a pale field returns
 * the field. A ratio is what a person's eye is sensitive to and a count of differing pixels is not:
 * a mark can cover a third of a region and be invisible.
 *
 * Anti-aliased edges sit between the two and would drag an average toward the middle; taking the
 * extreme reports the contrast of the mark's own body, which is the part that has to be seen.
 *
 * Returns `null` when nothing is painted at all — no mark means no ratio, and reporting 1:1 would
 * read as a contrast failure rather than as an absence.
 *
 * **Unvalidated on thin strokes, and do not file from it until it is.** Its first run gave a minus
 * sign 2.98:1 and a plus sign 6.78:1 in the same control, in the same colour — a difference that is
 * far more likely to be the thinner stroke having no fully-opaque pixel than two different inks. On a
 * thin mark the furthest pixel may still be a blend, so the ratio reads low and a conforming control
 * looks like a 1.4.11 failure. Validate against a mark of known colour and known weight before any
 * finding rests on it.
 */
export function contrastOf(png, tolerance = 12) {
  const { pixels, channels } = png;
  const { background } = paintedFraction(png, tolerance);
  const [br, bg, bb] = background.split(",").map(Number);
  const backLuminance = luminance(br, bg, bb);

  let mark = null;
  let furthest = -1;
  for (let at = 0; at < pixels.length; at += channels) {
    if (Math.abs(pixels[at] - br) <= tolerance
      && Math.abs(pixels[at + 1] - bg) <= tolerance
      && Math.abs(pixels[at + 2] - bb) <= tolerance) continue;
    const value = luminance(pixels[at], pixels[at + 1], pixels[at + 2]);
    const distance = Math.abs(value - backLuminance);
    if (distance > furthest) {
      furthest = distance;
      mark = { r: pixels[at], g: pixels[at + 1], b: pixels[at + 2], luminance: value };
    }
  }
  if (mark === null) return null;

  const lighter = Math.max(mark.luminance, backLuminance);
  const darker = Math.min(mark.luminance, backLuminance);
  return {
    ratio: Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2)),
    mark: `${mark.r},${mark.g},${mark.b}`,
    background,
  };
}
