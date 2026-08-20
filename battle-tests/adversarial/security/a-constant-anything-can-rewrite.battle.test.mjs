/**
 * The published tables a decision is read from, and which of them can be rewritten.
 *
 * Twenty-two of the thirty-six exported `MDY_` object constants are frozen. Fourteen are not, and five
 * more are frozen only at the top level. Two of the loose ones carry decisions:
 *
 * **The parser's allowlist.** `MDY_DYNAMIC_FIELD_KINDS` is the set of kinds an untrusted document may
 * declare, and the parser reads the exported array itself:
 *
 *     before   parseDynamicForm(kind: "totallyMadeUp")   accepted 0, MDY_DYNAMIC_UNKNOWN_KIND
 *     push     MDY_DYNAMIC_FIELD_KINDS.push("totallyMadeUp")
 *     after    parseDynamicForm(kind: "totallyMadeUp")   accepted 1, no diagnostic
 *
 * **Markup.** `mdyIcon` in `@modyra/plain` assigns `MDY_ICONS[name].content` to `innerHTML`, and says
 * why that is safe: *"the registry holds markup, and it is the package's own constant rather than
 * anything a caller supplies — there is no untrusted string on this path."* That sentence is an
 * invariant, and nothing holds it: the registry takes a new entry, and takes a replacement for an
 * existing one.
 *
 * What this is and is not. It is not an escalation: whoever rewrites a constant is already running
 * script in the page. It is a **stated invariant that the code does not keep**, and the cheap half of
 * defence in depth — a Modyra host rendering a document it does not control relies on the kind list to
 * bound what that document can be, and a third-party analytics snippet, a compromised dependency or an
 * extension shares the realm with it.
 *
 * The documented way to change the UI strings is `provideModyraLocale(locale, { overrides })` or
 * supplying an `MDY_I18N_MESSAGES` object of your own — not writing into the exported table — so
 * freezing takes nothing away that is documented.
 *
 * Green when every exported `MDY_` constant that is an object is frozen all the way down.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Frozen, and everything reachable through it frozen too — a frozen array of live objects is not. */
function deeplyFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((each) => deeplyFrozen(each, seen));
}

battle(
  {
    claims: ["SEC-007"],
    title: "a published constant cannot be rewritten by whatever else is on the page",
    environments: ["node"],
  },
  async (ctx) => {
    const packages = {
      "@modyra/core": await import("@modyra/core"),
      "@modyra/widgets": await import("@modyra/widgets"),
    };

    const loose = [];
    let checked = 0;

    for (const [name, module] of Object.entries(packages)) {
      for (const [exported, value] of Object.entries(module)) {
        // The constants, by the naming this workspace uses for them. A function or a class is a
        // different question — what is at stake here is a table something reads a decision out of.
        if (!/^MDY_[A-Z0-9_]+$/.test(exported)) continue;
        if (value === null || typeof value !== "object") continue;
        checked += 1;
        if (!deeplyFrozen(value)) {
          loose.push(`${name} ${exported}${Object.isFrozen(value) ? " (frozen, but holds something that is not)" : ""}`);
        }
      }
    }

    ctx.log.note("exported constants examined", { checked, loose: loose.length });

    // The control: the two packages have to have yielded constants at all. A rename of the prefix
    // would otherwise turn this battle into a check of nothing that reports as a pass.
    expectClaim(checked >= 20, {
      claimIds: ["SEC-007"],
      what: "the packages exported almost no MDY_ constants, so this battle checked nothing",
      detail: `${checked} examined`,
    });

    expectEqual(loose.sort(), [], {
      claimIds: ["SEC-007"],
      what: "an exported constant can be rewritten by anything sharing the page",
    });
  },
);
