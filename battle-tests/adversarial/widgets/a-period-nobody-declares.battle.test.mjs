/**
 * Which half of a 12-hour clock is chosen, and the contract calling it decoration.
 *
 * `mdy-timepicker-period-btn--selected` is painted by the stylesheet with `--tp-primary`, set by
 * Angular and by Lit on whichever of their two buttons matches, and **classified by the catalogue as
 * `presentation`** — the contract's own word for a class a renderer may use that carries no meaning.
 *
 * So nothing declares the state, nothing checks that a renderer marks it, and the two classes sit in
 * the coverage allowlist. Which is how the three renderers came to disagree about the anatomy itself:
 * Angular and Lit draw two buttons and select one, plain draws a single button whose text *is* the
 * period and which is never marked.
 *
 * **Whether a period is selected is the value's own display.** It is the same kind of thing as a
 * checkbox's tick, and every other one of those is a declared part with a declared state.
 *
 * Asked of the catalogue rather than of a rendered page, because the defect is that the catalogue is
 * silent — a renderer can be doing the right thing and still have nothing holding it there. The
 * browser half, that exactly one option carries the state in `12h` and none in `24h`, belongs beside
 * this once the part exists.
 *
 * Green when the contract names the option a person picks and the state that says which one is theirs.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const { MDY_WIDGET_CONTRACTS } = await import("@modyra/widgets");

const TIMEPICKER = MDY_WIDGET_CONTRACTS.timepicker;
const SELECTED_CLASS = "mdy-timepicker-period-btn--selected";
const OPTION_CLASS = "mdy-timepicker-period-btn";

battle(
  {
    claims: ["UI-009", "A11Y-001"],
    title: "the contract names the period a person picks, and the state that says which",
    environments: ["node"],
  },
  async (ctx) => {
    const parts = TIMEPICKER.parts;
    const named = Object.entries(parts).find(([, part]) => part.classes.includes(OPTION_CLASS));
    const presentation = TIMEPICKER.presentationClasses ?? [];

    ctx.log.note("what the catalogue says about the period", {
      partsMentioningTheClass: named ? named[0] : null,
      inPresentation: presentation.filter((entry) => entry.startsWith(OPTION_CLASS)),
      periodStates: parts.period?.states ?? null,
    });

    // The premise: the class is real and the sheet paints it. Without that this would be a complaint
    // about a name nobody uses.
    expectClaim(presentation.includes(OPTION_CLASS) || named !== undefined, {
      claimIds: ["UI-009"],
      what: "the catalogue has never heard of the period option at all, so this battle is about the wrong name",
      detail: JSON.stringify(presentation.filter((entry) => entry.includes("period"))),
    });

    // The option a person presses is a part, not decoration. `presentation` is the catalogue's way of
    // saying "a renderer may use this and it means nothing" — which is why three renderers were free
    // to disagree about whether there are two buttons or one.
    expectClaim(named !== undefined, {
      claimIds: ["UI-009"],
      what: "the period option is classified as presentation rather than declared as a part, so nothing holds a renderer to drawing it or to marking which one is chosen",
      detail: `"${OPTION_CLASS}" appears only in presentation: ${presentation.includes(OPTION_CLASS)}`,
    });
    if (!named) return;

    // And the state, which is the half a person actually reads: with no `selected` declared, a
    // conformance check cannot ask whether one of the two is marked.
    const [name, part] = named;
    expectClaim((part.states ?? []).includes("selected"), {
      claimIds: ["UI-009", "A11Y-001"],
      what: "the part a person picks declares no selected state, so which half of the day is chosen is a class the stylesheet paints and no check requires",
      detail: `${name}.states = ${JSON.stringify(part.states ?? null)}`,
    });

    // The modifier the sheet paints has to be the one the part derives, or a theme is styling a class
    // no renderer is obliged to produce — the shape of tonight's seven orphaned CSS rules.
    expectClaim(!presentation.includes(SELECTED_CLASS), {
      claimIds: ["UI-009"],
      what: "the selected modifier is still listed as presentation while the part declares the state, so the catalogue says both that it means something and that it means nothing",
      detail: SELECTED_CLASS,
    });
  },
);
