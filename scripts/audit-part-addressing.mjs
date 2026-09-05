/**
 * A part class is not an address, and for one family of parts it has to be.
 *
 * A probe that wants "the opener `daterange` declares" builds its selector the only way the contract
 * offers: `MDY_WIDGET_CONTRACTS.daterange.parts.toggle.classes`. That yields
 * `.mdy-datepicker__toggle` — which is also what `datepicker.toggle` declares. On a page carrying
 * both, the selector has two matches, `.first()` returns whichever the DOM lists first, and a probe
 * presses one widget's button while looking for the other's panel. It then reports the second widget
 * as broken. That happened, and it cost a false cross-renderer finding.
 *
 * **Sharing a class is not the defect.** Shared anatomy is the point of `.mdy-renderer`, `.mdy-label`
 * and `.mdy-popup`; seventeen kinds declare `.mdy-label__required` and should. A probe that wants one
 * widget's label scopes to that widget's root first, and inside a root the sharing costs nothing.
 *
 * **The exception is the popup family, and the reason is architectural.** ADR 0131 leaves a panel's
 * placement in the DOM to the renderer: a popup may be drawn outside the field it belongs to, to
 * escape a scrolling ancestor. So for a panel — and for the opener a probe must find to compare
 * against it — **scoping to the widget root is not available**. The page-wide query is the only one
 * there is, and a page-wide query needs an address that identifies one kind.
 *
 * So this asks a narrow question with a real answer: **for every kind that declares a popup, is each
 * declared door and panel addressable by class alone?** Where two kinds collide, the audit names the
 * pair, because the fix is a distinguishing class in the contract and the precedent is already in the
 * house — `daterange.popup` carries `mdy-datepicker__popup--range` and is separable for exactly this
 * reason. It is the openers that never got one.
 *
 * **What it does not judge, said out loud.** Every non-popup part is out of scope: sharing there is
 * legitimate and this audit has nothing to say about it. It also counts the sharing it is ignoring,
 * so a reader can see the perimeter rather than assume it is empty — a guard silent about its own
 * scope is indistinguishable from a guard that passes.
 *
 * **Not in `test:contracts` yet, and that is deliberate.** The four addresses it names today can only
 * be repaired in the contract, by a session that owns `packages/widgets`. A gate wired in now would
 * refuse every commit for a defect its author cannot fix from where they are standing, and the way
 * around a refusal is `--no-verify`, which costs the check its credibility for everything else it
 * might say. `audit-visual-debt` reached the same conclusion for the same reason. It joins the chain
 * on the day its list is empty, and `--check` is here so a reviewer can ask for the exit code now.
 *
 * Usage:
 *   node scripts/audit-part-addressing.mjs            # report
 *   node scripts/audit-part-addressing.mjs --check    # and exit 1 on an ambiguous door or panel
 */
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "../packages/widgets/dist/index.js";

const CHECK = process.argv.includes("--check");

const partsOf = (kind) => MDY_WIDGET_CONTRACTS[kind]?.parts ?? {};
const classesOf = (kind, part) => partsOf(kind)[part]?.classes ?? [];

/** Every kind that declares a part whose classes are a superset of this set — the ones a query hits. */
function alsoMatched(classes, self) {
  if (classes.length === 0) return [];
  const hit = [];
  for (const [kind, contract] of Object.entries(MDY_WIDGET_CONTRACTS)) {
    if (kind === self) continue;
    for (const [part, def] of Object.entries(contract.parts ?? {})) {
      if (classes.every((c) => (def.classes ?? []).includes(c))) hit.push(`${kind}.${part}`);
    }
  }
  return hit;
}

const findings = [];
const rows = [];

for (const [kind, decl] of Object.entries(MDY_POPUP_OPENERS)) {
  // The doors a probe presses, and the panel it then looks for. `controls` is included because a
  // panel found by class is how a probe decides the press worked.
  for (const [role, part] of [["opener", decl.opener], ["also-opens-from", decl.alsoOpensFrom], ["panel", decl.controls]]) {
    if (part === undefined || part === null) continue;
    const classes = classesOf(kind, part);
    if (classes.length === 0) {
      rows.push(`  ${kind}.${part} (${role}) — the contract gives it no class; a probe cannot address it at all`);
      findings.push(`${kind}.${part} (${role}) has no class, so it cannot be addressed by class`);
      continue;
    }
    const clash = alsoMatched(classes, kind);
    rows.push(`  ${kind}.${part} (${role}) [${classes.join(" ")}]`
      + (clash.length === 0 ? "  unique" : `  ALSO MATCHES ${clash.join(", ")}`));
    if (clash.length > 0) {
      findings.push(`${kind}.${part} (${role}) is not addressable: [${classes.join(" ")}] also matches ${clash.join(", ")}`);
    }
  }
}

// The perimeter: how much sharing exists outside the family this audit judges.
const owners = new Map();
for (const [kind, contract] of Object.entries(MDY_WIDGET_CONTRACTS)) {
  for (const def of Object.values(contract.parts ?? {})) {
    for (const cls of def.classes ?? []) {
      if (!owners.has(cls)) owners.set(cls, new Set());
      owners.get(cls).add(kind);
    }
  }
}
const sharedElsewhere = [...owners.values()].filter((s) => s.size > 1).length;

console.log("# Part addressing\n");
console.log("Popup doors and panels, which ADR 0131 makes page-wide queries:\n");
console.log(rows.join("\n"));
console.log(`\nNot judged here: ${sharedElsewhere} class(es) are shared across kinds outside the popup`
  + " family. Sharing there is legitimate — a probe scopes to the widget's root first.");

if (findings.length === 0) {
  console.log("\nEVERY DECLARED DOOR AND PANEL IS ADDRESSABLE.");
} else {
  console.log(`\nAMBIGUOUS ADDRESSES — ${findings.length}\n`);
  for (const f of findings) console.log(`  - ${f}`);
  console.log(
    "\n  The repair is a distinguishing class in the contract, not a cleverer selector in the probe:"
    + "\n  a probe cannot separate what the contract spells the same way. The precedent is in the"
    + "\n  house — `daterange.popup` carries `mdy-datepicker__popup--range` and is separable because"
    + "\n  of it. Give the colliding door the same treatment.",
  );
  if (CHECK) process.exit(1);
}
