# ADR 0112: A radio group has nowhere to jump

Status: Accepted

## Context

`MDY_WIDGET_KEYBOARD` derives its bindings from what a kind is. Every kind in `NAVIGATES_OPTIONS`
received four:

```ts
if (NAVIGATES_OPTIONS.includes(kind)) {
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
    bindings.push({ key, ...(overlay ? { when: "open" as const } : {}), intent: "move" });
  }
}
```

`radio` and `segmented` are the only members with no overlay, so theirs are the only `Home` and `End`
that land as **closed-state** bindings — the ones a browser sweep can press without first deciding
where an open widget puts its reading position. A sweep pressed them and nothing happened, in the
renderer that answers every other key it declares.

`Home` and `End` jump to the first and last option. That is the listbox pattern and the grid pattern.
A radio group is neither: the APG gives it Tab, Space and the four arrows, and its arrows both move
and select, so there is no separate reading position for a jump to land on. Two of the three
reference renderers declare nothing at all here, and the third — the one that handles `Home` and `End`
in a calendar — does not handle them in a radio group either.

**Nothing implemented it, and that is the evidence.** `@modyra/plain`, `@modyra/lit` and
`@modyra/angular` all omit it, independently. Read as a defect it is one oversight made three times.
Read as a contract error it is one rule applied where it does not belong — which also explains why
nobody noticed: the declaration described a behaviour no one intended.

[ADR 0021](0021-a-dialog-overlay-is-not-a-combobox.md) is the same mistake at the site next door, and
it named this one on its way past: *"`NAVIGATES_OPTIONS` is the wrong question here and reads like the
right one."* It was right about the arrows and the sentence outlived its example.

## Decision

**Home and End are declared where the options are a list to jump through, and a radio group is not
one.**

```ts
const isRadioGroup = Object.values(MDY_WIDGET_CONTRACTS[kind].parts)
  .some((declared) => declared.role === "radiogroup");
```

Asked of the catalogue rather than of a second list, for the reason ADR 0021 gives: a second table
that must be kept in step with the first is the failure this repository has recorded under several
letters. `radio` and `segmented` declare a part with `role="radiogroup"`; nothing else does.

The arrows are untouched. A radio group *is* walked with them, and they are what every renderer
implements.

## Consequences

**Four bindings are withdrawn from the public contract**, which `contract:diff` classifies as major.
Nothing implemented them, so no renderer changes and no user loses a key that worked — but the
declaration was public and its removal is a break, and calling it anything softer would be deciding
by preference rather than by the tool.

**`MDY_WIDGET_CONTRACT_VERSION` does not move.** It names the anatomy — a part existing, its element,
its role — and a key binding is none of those. ADR 0021 withdrew eight bindings without moving it, and
[ADR 0084](0084-a-contract-version-names-the-anatomy.md) defines the number by what a renderer was
told to *build*. This is the precedent applied, not an exception to it.

**A consumer reading `MDY_WIDGET_KEYBOARD` to build a radio group implements two fewer keys.** That is
the point: the table is what an implementer builds from, and it was asking for work all three
reference renderers had declined.

**The catalogue's roles are now load-bearing for keyboard derivation**, as its part names already
were. A kind that stops being a radio group gains two bindings with the change. That coupling is
intended — it is to the fact that decided the rule — and it means a role change can move a keyboard
contract, which the snapshot reports.

**A user who wanted to reach the last option in one press still cannot**, and now the contract says so
rather than promising it. If that turns out to be wanted, it is a feature with a pattern to choose and
three renderers to implement it, not a line already in a table.

## Alternatives rejected

**Implement Home and End in all three renderers.** Defensible: a jump is useful in a long radio group,
and the keys are unclaimed there. Rejected as the wrong order — the contract would be leading three
implementations toward a behaviour outside the pattern the widget's role announces, and a screen
reader user who has been told "radio group" has been told which keys exist. Worth revisiting as a
deliberate extension, with the announcement question answered first.

**Test `NAVIGATES_OPTIONS` membership against a second list of "kinds with a list".** The mechanism
that produced this defect, applied again. Two tables that must agree drift, which is the whole reason
the check is asked of the catalogue.

**Test `"listbox" in parts`, as ADR 0021 does.** Nearly right and wrong at the edges: `colors` holds
its swatches in a part named `presets` with `role="listbox"`, and `multiselect`'s part named `listbox`
is declared a `group`. Keying on the part's **name** would have removed Home and End from a kind whose
options are a real listbox and kept them on one whose options are not. The role is the fact; the name
is a spelling.

## Verification

- `npx playwright test -c battle-tests/playwright.config.ts every-key-a-kind-declares` — presses every
  declared key in its declared state and requires that something a page can observe changes. Plain's
  closed-state failures go from five to one with this change.
- `npm run test:widget-contract` — 544 assertions over the catalogue and its projections.
- `npm run contract:diff` — names the four withdrawn bindings and classifies the change, which is what
  makes the break a decision rather than a side effect.

**Not guarded:** nothing fails if a renderer implements a key the table does not declare. The table is
a floor for implementers, not a ceiling.

## Security and privacy

None. A key binding is a statement about which keys a widget answers; it carries no data, crosses no
trust boundary, and an attacker gains nothing from it being wrong.

The impact is accessibility, in both directions, and it is why the decision goes this way rather than
the other: a contract that promises keys the widget's announced role does not have is a promise made
to the person least able to check it.
