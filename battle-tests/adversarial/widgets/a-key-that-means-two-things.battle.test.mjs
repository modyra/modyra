/**
 * A key means one thing at a time, or a person cannot know what they pressed.
 *
 * `MDY_WIDGET_KEYBOARD` declares each binding with a `when` — the state the widget must be in — and
 * an `on` — the part that answers it. Those two are what let one key mean different things safely:
 * `Escape` on an open popup and `Escape` on a grabbed chip are different keys as far as a person is
 * concerned, because a control cannot be in both states.
 *
 * When the conditions **overlap**, it stops being safe. Two bindings on the same part, live in the
 * same state, sharing a key, means one physical press has two published meanings and the reader has
 * no way to know which they got — nor does a renderer reading the table to decide what to bind.
 *
 * This exists because three such collisions were designed in one morning and each was caught by a
 * person rather than by a check:
 *
 *   - a chip that was a `spinbutton` gave `Home` and `End` two meanings, the row's ends and the
 *     value's minimum and maximum;
 *   - a grab-to-reorder on `Enter` collided with a grid cell's interaction mode, also `Enter`;
 *   - `Escape` closes a popup, and would also cancel a grab — safe only because a grab cannot begin
 *     while the popup is open, which was **assumed** and turned out to be measurable and true only
 *     under a condition nobody had written down.
 *
 * Each was found by reading. None of them would have been found by pressing keys, because a
 * collision is not a key that does nothing — it is a key that does one of two right things.
 *
 * `requires` deliberately does **not** separate two bindings. It names a capability the field opted
 * into, and a field may opt into several, so two keys gated on different capabilities are both live
 * on the same control at once. Treating it as a discriminator would let the table declare exactly
 * the ambiguity this refuses.
 */
import { MDY_WIDGET_KEYBOARD, matchesKeyGesture } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

/** Two conditions overlap when neither excludes the other. An absent one excludes nothing. */
const overlaps = (a, b) => a === undefined || a === null || b === undefined || b === null || a === b;

battle(
  {
    claims: ["A11Y-001"],
    title: "a key that means two things in one reachable state",
    environments: ["node"],
  },
  async (ctx) => {
    const byKind = Object.entries(MDY_WIDGET_KEYBOARD).filter(([, list]) => Array.isArray(list));

    // The premise: there is a table to read. A rename that emptied it would pass everything below
    // while comparing nothing.
    expectEqual(byKind.length > 0, true, {
      claimIds: ["A11Y-001"],
      what: "no kind declares any binding, so this battle is comparing nothing",
      detail: JSON.stringify(Object.keys(MDY_WIDGET_KEYBOARD)),
    });

    // The gestures a keyboard can produce for one key, as this contract distinguishes them: pressed
    // alone, or pressed with the primary modifier. `modifier: "any"` accepts both, which is why a
    // binding declaring it collides with either of the others rather than with neither.
    const GESTURES = [
      { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },
      { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
    ];

    const collisions = [];
    for (const [kind, list] of byKind) {
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i];
          const b = list[j];
          // Asked of the rule that resolves a press, not of the key's name.
          //
          // Comparing `a.key !== b.key` reads `modifier` nowhere, so `ArrowUp` bare and `ArrowUp`
          // with the primary modifier looked like one key meaning two things — and the datepicker's
          // view binding, which is correct, was failed for it. What a person performs is a gesture,
          // and `matchesKeyGesture` is what decides which binding a gesture reaches: two bindings
          // collide when some gesture reaches both, and not otherwise.
          if (!GESTURES.some((gesture) => matchesKeyGesture(a, { ...gesture, key: a.key })
            && matchesKeyGesture(b, { ...gesture, key: a.key }))) continue;
          if (!overlaps(a.when, b.when)) continue;
          if (!overlaps(a.on, b.on)) continue;
          collisions.push(
            `${kind} "${a.key}": ${a.intent} and ${b.intent} are both live ` +
              `on ${a.on ?? b.on ?? "any part"} when=${a.when ?? b.when ?? "any state"}`,
          );
        }
      }
    }

    ctx.log.note("bindings read", { kinds: byKind.length, total: byKind.reduce((n, [, l]) => n + l.length, 0) });

    expectEqual(collisions, [], {
      claimIds: ["A11Y-001"],
      what: "one key has two published meanings in a state a person can reach, so pressing it does one of two right things and nothing says which",
      detail: JSON.stringify(collisions, null, 1),
    });
  },
);
