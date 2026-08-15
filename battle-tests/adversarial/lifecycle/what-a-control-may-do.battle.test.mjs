/**
 * The two questions every control asks before it does anything.
 *
 * `blocksValueChange` and `blocksFocus` are how a widget turns the engine's interactivity into
 * behaviour: the first guards input, toggling, stepping, clearing and confirming a picker; the
 * second guards the tab order and the native `disabled` attribute. Every control in the package
 * calls them, and neither had a battle.
 *
 * They are two questions rather than one because the two states differ in exactly one place. A
 * read-only control keeps its place in the tab order and lets its text be selected and copied — a
 * value you may read but not rewrite is useless if you cannot reach it — while a disabled one is out
 * of reach entirely. Collapsing them would either make read-only text unselectable or put disabled
 * controls back in the tab order, and both are the kind of change that looks like a simplification.
 *
 * The last case is the one worth keeping: an interactivity neither function recognises is treated as
 * "no writes, but reachable". A default that ever flipped the other way would make an unknown state
 * editable, and nothing about the control would look different.
 */

import { createForm, vanillaReactivity } from "@modyra/core";
import { blocksFocus, blocksValueChange } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { buildSchema } from "../../models/schemas.mjs";

const SPEC = Object.freeze({ version: 1, fields: Object.freeze({ a: Object.freeze({ kind: "text" }) }) });

battle(
  {
    claims: ["VAL-002", "A11Y-002"],
    title: "a control asks the engine what it may do and gets the two answers apart",
    environments: ["node"],
  },
  async (ctx) => {
    const reactivity = vanillaReactivity();
    const form = createForm(buildSchema(SPEC).schema, { reactivity, devWarnings: false });
    const cell = form.getField("a");
    const read = () => {
      const state = cell();
      const interactivity = state.interactivity();
      return {
        interactivity,
        disabled: state.disabled(),
        readonly: state.readonly(),
        blocksValueChange: blocksValueChange(interactivity),
        blocksFocus: blocksFocus(interactivity),
      };
    };

    const enabled = read();
    ctx.log.note("a control nobody has restricted", enabled);
    expectEqual([enabled.blocksValueChange, enabled.blocksFocus], [false, false], {
      claimIds: ["VAL-002"],
      what: "a control nobody restricted was told it may not be written to or reached",
    });

    form.setReadonly("a", () => true);
    const readonly = read();
    ctx.log.note("a read-only control", readonly);

    // The half they share, and the half they do not: read-only keeps the control reachable.
    expectEqual([readonly.blocksValueChange, readonly.blocksFocus], [true, false], {
      claimIds: ["VAL-002", "A11Y-002"],
      what: "a read-only control was either writable or taken out of reach",
    });

    form.setDisabled("a", () => true);
    const both = read();
    ctx.log.note("a control that is both", both);

    // Disabled subsumes read-only rather than combining with it: the strongest state is what the
    // control is asked about, and a widget reading `readonly` alone must not conclude it may be
    // reached.
    expectEqual(both.interactivity, "disabled", {
      claimIds: ["VAL-002"],
      what: "a control that is disabled and read-only at once reports as something else",
    });
    expectEqual([both.blocksValueChange, both.blocksFocus], [true, true], {
      claimIds: ["VAL-002", "A11Y-002"],
      what: "a disabled control was left writable or reachable",
    });

    form.setReadonly("a", () => false);
    const disabled = read();
    expectEqual([disabled.blocksValueChange, disabled.blocksFocus], [true, true], {
      claimIds: ["VAL-002"],
      what: "lifting read-only from a disabled control made it writable or reachable",
    });

    form.setDisabled("a", () => false);
    expectEqual([read().blocksValueChange, read().blocksFocus], [false, false], {
      claimIds: ["VAL-002"],
      what: "a control did not come back when both restrictions were lifted",
    });

    form.destroy();
  },
);

battle(
  {
    claims: ["VAL-002", "A11Y-002"],
    title: "an interactivity nobody declared is treated as the state that writes nothing",
    environments: ["node"],
  },
  async (ctx) => {
    // Nothing in the engine produces these. What matters is which way the answer falls if something
    // ever does — a value that is not one of the three must not become a control the user can type
    // into, and it must not disappear from the tab order either.
    for (const unknown of [undefined, null, "wormhole", "", 0, 1, {}]) {
      const writes = blocksValueChange(unknown);
      const focus = blocksFocus(unknown);
      ctx.log.note("an interactivity nobody declared", { unknown: String(unknown), writes, focus });

      expectClaim(writes === true, {
        claimIds: ["VAL-002"],
        what: `an interactivity of ${String(unknown)} left the control writable`,
      });

      expectClaim(focus === false, {
        claimIds: ["A11Y-002"],
        what: `an interactivity of ${String(unknown)} took the control out of reach, which hides it from a keyboard`,
      });
    }
  },
);
