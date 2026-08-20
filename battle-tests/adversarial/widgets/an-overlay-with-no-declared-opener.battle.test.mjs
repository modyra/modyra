/**
 * Six kinds declare an overlay. Four say what opens it.
 *
 * `MDY_WIDGET_CONTRACTS[kind].capabilities.overlay` is how a kind says it has a popup, and it is the
 * whole of what the contract says about opening one. What *carries* the popup relationship — the part
 * that owns `aria-expanded` and `aria-haspopup`, and announces itself as a combobox — is said only
 * indirectly, by a part declaring `role: "combobox"`. For two kinds nothing does:
 *
 *     kind         the part the contract gives a combobox role   what the plain renderer opens with
 *     select       trigger                                       button.mdy-select__trigger, combobox
 *     multiselect  searchButton                                  button.mdy-multiselect__search-btn, combobox
 *     datepicker   control                                       input.mdy-datepicker__input, combobox
 *     timepicker   control                                       input.mdy-timepicker__input, combobox
 *     daterange    —                                             button.mdy-datepicker__toggle, no role
 *     colors       —                                             button.mdy-colors__toggle-area, no role
 *
 * Measured in the browser tier, on the six mounted together. The two without a declaration are the
 * two whose renderer answers differently, which is what makes this a hole in the contract rather than
 * a preference: `@modyra/widgets` is published so a renderer nobody here has written can be held to
 * it, and that renderer has nothing to read.
 *
 * It is not an accessibility break today. Both openers are real `<button>` elements carrying
 * `aria-expanded` and `aria-haspopup="grid"`, so a person is told the popup exists — by this
 * repository's renderer, which knows what the contract does not say.
 *
 * A daterange has two text inputs and no single control, so `control: combobox` is not the answer for
 * it. That is the reason the hole exists and not a reason to leave it: the contract can name the
 * toggle as the opener as easily as it names a trigger.
 *
 * Green when every kind declaring an overlay also declares which of its parts opens it. Two answers:
 * a part carrying the combobox role for those two kinds, or an explicit statement on the capability
 * naming the opening part — which would also let `select` stop implying it through a role.
 */

import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The parts of a kind that say they are the thing a user operates to open the overlay. */
const openersDeclaredBy = (contract) =>
  Object.entries(contract.parts)
    .filter(([, part]) => part.role === "combobox")
    .map(([name]) => name);

battle(
  {
    claims: ["UI-010", "UI-009"],
    title: "a kind that declares an overlay declares what opens it",
    environments: ["node"],
  },
  async (ctx) => {
    const withOverlay = Object.entries(MDY_WIDGET_CONTRACTS)
      .filter(([, contract]) => contract.capabilities?.overlay === true)
      .map(([kind]) => kind)
      .sort();

    // The control on the measurement: the capability exists and several kinds carry it, so a run
    // that found nothing to check would not read as a pass.
    expectClaim(withOverlay.length >= 4, {
      claimIds: ["UI-010"],
      what: "no kind declares an overlay, so this battle checked nothing",
      detail: JSON.stringify(Object.keys(MDY_WIDGET_CONTRACTS)),
    });

    const silent = [];
    for (const kind of withOverlay) {
      const openers = openersDeclaredBy(MDY_WIDGET_CONTRACTS[kind]);
      ctx.log.note("a kind with an overlay", { kind, openers });
      if (openers.length === 0) silent.push(kind);
    }

    expectEqual(silent, [], {
      claimIds: ["UI-010", "UI-009"],
      what: "a kind declares an overlay and no part of it says which one a person opens it with",
      detail: JSON.stringify(withOverlay.map((kind) => [kind, openersDeclaredBy(MDY_WIDGET_CONTRACTS[kind])])),
    });
  },
);
