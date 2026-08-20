/**
 * Every kind with a popup says what opens it, and says it consistently.
 *
 * `capabilities.overlay: true` says a kind has a popup. `MDY_POPUP_OPENERS` says which of its parts a
 * person operates to open one, what that part points at, and what role it takes:
 *
 *     select       { opener: "trigger",      controls: "listbox", role: "combobox" }
 *     multiselect  { opener: "searchButton", controls: "popup",   role: "combobox" }
 *     datepicker   { opener: "control",      controls: "grid",    role: "combobox", typeable: true }
 *     timepicker   { opener: "control",      controls: "popup",   role: "combobox", typeable: true }
 *     daterange    { opener: "toggle",       controls: "popup" }
 *     colors       { opener: "toggle",       controls: "popup" }
 *
 * Three properties, and the third is the one that is easy to get wrong in the direction of looking
 * tidier. A combobox is the control that **holds the value**; a button that opens a popup must not
 * claim the role. So `role: "combobox"` belongs exactly where the opener is the field's own control,
 * and its absence on `daterange` and `colors` — whose opener is a toggle button — is the contract
 * being right rather than incomplete.
 *
 * This battle was first written asserting that every overlay kind had a part with `role: "combobox"`.
 * That assertion's only route to green was to give a `<button>` the role of the thing it opens, which
 * is the ARIA mistake the table exists to avoid. The property below is what it was reaching for.
 *
 * Green when every kind that declares an overlay declares an opener, the opener and what it controls
 * are parts the kind actually has, and a combobox role appears only on an opener that is the control.
 */

import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

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

    // The control on the measurement: the capability exists and several kinds carry it, so a run that
    // found nothing to check would not read as a pass.
    expectClaim(withOverlay.length >= 4, {
      claimIds: ["UI-010"],
      what: "no kind declares an overlay, so this battle checked nothing",
      detail: JSON.stringify(Object.keys(MDY_WIDGET_CONTRACTS)),
    });

    const undeclared = [];
    const danglingPart = [];
    const wrongRole = [];

    for (const kind of withOverlay) {
      const opener = MDY_POPUP_OPENERS[kind];
      ctx.log.note("a kind with an overlay", { kind, opener });
      if (!opener || typeof opener.opener !== "string") { undeclared.push(kind); continue; }

      // The named parts have to be parts this kind has, or the declaration points at nothing a
      // renderer could build — the failure mode a table of names has.
      const parts = MDY_WIDGET_CONTRACTS[kind].parts;
      for (const named of ["opener", "controls"]) {
        const part = opener[named];
        if (typeof part === "string" && !(part in parts) && part !== "popup") {
          danglingPart.push(`${kind}.${named} names "${part}", which is not one of its parts`);
        }
      }

      // A combobox holds a value. The opener may be the control, and then it is one; where the opener
      // is a toggle it is a button, and claiming the role would move the value's identity onto it.
      const isTheControl = opener.opener === "control" || opener.opener === "trigger" || opener.opener === "searchButton";
      if ((opener.role === "combobox") !== isTheControl) {
        wrongRole.push(`${kind}: opener "${opener.opener}", role ${JSON.stringify(opener.role ?? null)}`);
      }
    }

    expectEqual(undeclared, [], {
      claimIds: ["UI-010", "UI-009"],
      what: "a kind declares an overlay and nothing says which part a person opens it with",
      detail: JSON.stringify(MDY_POPUP_OPENERS),
    });

    expectEqual(danglingPart, [], {
      claimIds: ["UI-009"],
      what: "an opener declaration names a part the kind does not have",
    });

    expectEqual(wrongRole, [], {
      claimIds: ["UI-010"],
      what: "the combobox role is on an opener that does not hold the field's value, or missing from one that does",
    });
  },
);
