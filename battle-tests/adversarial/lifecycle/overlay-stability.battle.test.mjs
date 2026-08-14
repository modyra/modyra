/**
 * A popup holding still while the page moves under it.
 *
 * An open overlay's coordinates have to follow its anchor or it detaches. Its *shape* must not:
 * re-deciding placement, height and alignment on every scroll frame is what makes a popup flip
 * sides and resize as the page moves, and a list that jumps while a user is reaching for an option
 * is worse than one that hangs slightly off. `stabilizeOverlayPlacement` is where that is decided,
 * and it takes the decision the host is holding, the one it just measured, and the geometry now.
 *
 * The property is easy to state and easy to lose to a refactor, because the naive implementation —
 * return the fresh decision — is correct on every single frame and wrong across a sequence. So the
 * battle drives sequences: a page scrolling a pixel at a time through the point where the opened
 * side stops fitting, and an anchor jittering across that same point, which is what sub-pixel
 * scrolling and a resize observer between them produce.
 *
 * What is deliberately *not* held is `fits`. The shape is the frame it opened in; whether the
 * content still shows whole is a fact about this frame. That is the signal a host has for the case
 * this design accepts: between the threshold and the room the popup was sized for, the held
 * maxHeight is larger than the room now beneath it, and the overflow is reported rather than
 * corrected. The last assertion pins that the report is truthful, since it is the only thing
 * standing between a held shape and a list whose bottom is off-screen.
 */

import { decideOverlayPlacement, stabilizeOverlayPlacement } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A select-sized popup under an anchor at `anchorTop`, in a viewport a laptop would have. */
function geometryAt(anchorTop) {
  return {
    viewportHeight: 800,
    viewportWidth: 1000,
    anchorTop,
    anchorBottom: anchorTop + 32,
    anchorLeft: 100,
    anchorRight: 300,
    desiredHeight: 300,
    desiredWidth: 200,
    minSpace: 120,
    preferred: "below",
  };
}

/** Open at `from`, then walk the anchor through `tops`, holding the decision as a host does. */
function scrollThrough(tops) {
  let held = null;
  const seen = [];
  for (const top of tops) {
    const geometry = geometryAt(top);
    held = stabilizeOverlayPlacement(held, decideOverlayPlacement(geometry), geometry);
    seen.push({ top, ...held });
  }
  const flips = seen.filter((frame, index) => index > 0 && frame.placement !== seen[index - 1].placement);
  return { seen, flips };
}

battle(
  {
    claims: ["UI-001"],
    title: "a page scrolling under an open popup moves it once, not continuously",
    environments: ["node"],
  },
  async (ctx) => {
    const tops = [];
    for (let top = 400; top <= 700; top += 1) tops.push(top);
    const { seen, flips } = scrollThrough(tops);
    ctx.log.note("an anchor carried 300 pixels down the viewport", {
      frames: seen.length,
      flips: flips.map((frame) => ({ top: frame.top, to: frame.placement })),
    });

    // The control: the room genuinely runs out along this path, so the popup is expected to move
    // exactly once. A sequence where it never had to move would prove nothing about stability.
    expectClaim(seen[0].placement === "below" && seen[seen.length - 1].placement === "above", {
      claimIds: ["UI-001"],
      what: "the scroll path never took the popup off the side it opened on, so stability is untested here",
      detail: JSON.stringify({ first: seen[0].placement, last: seen[seen.length - 1].placement }),
    });

    expectEqual(flips.length, 1, {
      claimIds: ["UI-001"],
      what: "an open popup changed sides more than once while the page scrolled under it",
      detail: JSON.stringify(flips.map((frame) => ({ top: frame.top, to: frame.placement }))),
    });

    // And the height it was opened with is the height it keeps, rather than being recomputed for
    // each frame's room — the resize half of the same property.
    const beforeFlip = seen.slice(0, seen.findIndex((frame) => frame.placement === "above"));
    expectEqual(new Set(beforeFlip.map((frame) => frame.maxHeight)).size, 1, {
      claimIds: ["UI-001"],
      what: "the popup resized itself frame by frame while it stayed on the same side",
      detail: JSON.stringify([...new Set(beforeFlip.map((frame) => frame.maxHeight))]),
    });
  },
);

battle(
  {
    claims: ["UI-001"],
    title: "an anchor jittering across the threshold does not make the popup blink",
    environments: ["node"],
  },
  async (ctx) => {
    // A pixel back and forth is not a page scrolling — it is a resize observer and a sub-pixel
    // layout disagreeing. Re-deciding on each of these is what a user sees as flicker.
    const jitter = [];
    for (let frame = 0; frame < 60; frame += 1) jitter.push(647 + (frame % 2));
    const { seen, flips } = scrollThrough(jitter);
    ctx.log.note("an anchor moving one pixel back and forth", { frames: seen.length, flips: flips.length });

    expectEqual(flips.length, 0, {
      claimIds: ["UI-001"],
      what: "a one-pixel jitter made the popup change sides",
      detail: JSON.stringify(flips.map((frame) => ({ top: frame.top, to: frame.placement }))),
    });

    expectEqual(new Set(seen.map((frame) => `${frame.placement}:${frame.maxHeight}:${frame.alignment}`)).size, 1, {
      claimIds: ["UI-001"],
      what: "a one-pixel jitter changed the popup's shape",
      detail: JSON.stringify([...new Set(seen.map((frame) => `${frame.placement}:${frame.maxHeight}`))]),
    });
  },
);

battle(
  {
    claims: ["UI-001"],
    title: "a held shape reports honestly that it no longer fits",
    environments: ["node"],
  },
  async (ctx) => {
    // Holding the shape means the popup can end up taller than the room now under it. The design
    // accepts that up to `minSpace` and reports it through `fits`, which is a host's only signal —
    // so a held decision claiming to fit while it does not is the failure that matters here, more
    // than the overflow itself.
    let held = null;
    const frames = [];
    for (const top of [400, 500, 600, 660, 700]) {
      const geometry = geometryAt(top);
      held = stabilizeOverlayPlacement(held, decideOverlayPlacement(geometry), geometry);
      const roomBelow = geometry.viewportHeight - geometry.anchorBottom;
      frames.push({ top, placement: held.placement, maxHeight: held.maxHeight, roomBelow, fits: held.fits });
    }
    ctx.log.note("what a held decision promises against the room it now has", { frames });

    for (const frame of frames) {
      if (frame.placement !== "below") continue;
      const whole = frame.maxHeight <= frame.roomBelow;
      expectEqual(frame.fits, whole, {
        claimIds: ["UI-001"],
        what: `a popup held below with ${frame.maxHeight}px in ${frame.roomBelow}px of room reported fits=${frame.fits}`,
        detail: JSON.stringify(frame),
      });
    }

    // The control: at least one frame is the case this battle is about, or every assertion above
    // passed on a popup that always fitted.
    expectClaim(frames.some((frame) => frame.placement === "below" && frame.fits === false), {
      claimIds: ["UI-001"],
      what: "no frame held a shape that stopped fitting, so the honesty of the report is untested",
      detail: JSON.stringify(frames),
    });
  },
);
