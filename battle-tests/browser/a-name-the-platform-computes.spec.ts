/**
 * The bench's reading of an announced name, shown able to tell apart what it exists to tell apart.
 *
 * `announcedName` is about to be the single source for every question of the form "what is this
 * control called", including the exit criterion's experience pass. A reader that is wrong, or that
 * cannot distinguish two cases, would make every one of those answers wrong in the same direction at
 * once — which is worse than having no reader, because a shared wrong answer reads as agreement.
 *
 * So this asks the reader itself, not any widget. The page is built here rather than mounted from a
 * renderer: a proof of the instrument must not fail when the subject changes, or it stops being a
 * proof of the instrument.
 *
 * **Each case is a different way the reader could be blind**, and the pairs matter more than the
 * values. A reader that returns the `aria-label` attribute passes "a name is read" and fails
 * "labelledby wins". A reader that returns `""` for an unnamed control passes every equality against
 * a name and silently answers "not named" as "named nothing".
 */
import { expect, test } from "@playwright/test";

import { announcedName } from "./bench";

const PAGE = `
  <button id="plain-label" aria-label="Chiudi">x</button>
  <span id="caption">Salva tutto</span>
  <button id="both" aria-label="Perde" aria-labelledby="caption">x</button>
  <button id="from-text">Testo proprio</button>
  <button id="nameless"></button>
  <button id="unexposed" aria-label="Scritto" style="display:none">x</button>
  <button id="hidden-part">Visibile<span aria-hidden="true"> nascosto</span></button>
`;

test("the bench reads the name a platform computes, and says nothing when there is none", async ({ page }) => {
  await page.setContent(PAGE);

  // The ordinary case. If this were the only case, a reader returning the attribute would pass.
  expect(await announcedName(page.locator("#plain-label")), "an aria-label is the name")
    .toBe("Chiudi");

  // The case that separates "reads the announcement" from "reads the attribute": both are written,
  // and only one is heard.
  expect(
    await announcedName(page.locator("#both")),
    "aria-labelledby beats aria-label, and a reader that returns the attribute answers the loser",
  ).toBe("Salva tutto");

  // A name with no attribute behind it at all.
  expect(await announcedName(page.locator("#from-text")), "an element's own text names it")
    .toBe("Testo proprio");

  // Hidden text is in the markup and not in the announcement.
  expect(
    await announcedName(page.locator("#hidden-part")),
    "aria-hidden removes a contributor without changing what the markup says",
  ).toBe("Visibile");

  // **The pair this reader exists for.** Unnamed and named-empty are different facts, and a reader
  // that answers "" for the first makes them one.
  expect(
    await announcedName(page.locator("#nameless")),
    "a control with no name is null, never the empty string: a caller comparing strings cannot tell "
      + "an unnamed control from one named nothing if both arrive as \"\"",
  ).toBeNull();

  // **The two refusals, and the second is why this reader was rewritten.** A hidden element carries
  // an `aria-label` and no announcement, so a reader that answers `null` for it says "not named"
  // about a control that is behaving correctly — which is how a datepicker's hidden month and year
  // views were once reported as unnamed grids, a finding whose repair would have gone to code that
  // works. Refusing is what keeps "not exposed" and "not named" from becoming one answer.
  await expect(announcedName(page.locator("#unexposed")), "an element outside the accessibility tree "
    + "is refused, because it has no announcement to read rather than an empty one")
    .rejects.toThrow(/accessibility tree/);

  // A selector that matches nothing is the commonest way a naming probe reports "not named".
  await expect(announcedName(page.locator("#absent")), "a locator matching nothing is a fault in the "
    + "call, not a control without a name").rejects.toThrow(/matches nothing/);
});
