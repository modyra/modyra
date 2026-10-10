# ADR 0215: A caption beside a box does not say whether it is ticked

Status: Accepted

## Context

`shellStateClasses` puts `--filled` on a field's caption when the caller says the field holds a value.
The shell declares the state on the caption for every kind (`MDY_SHELL_PART_STATES.label`), and
`valueIsPresent` counts a ticked boolean as present. Taken literally, the contract would put
`--filled` on the words beside a ticked checkbox or switch.

No renderer does. All four style the boolean caption from the error state alone. In every theme,
`--filled` is the floating-label signal: under `.mdy-floating-label` it lifts and shrinks a caption
that sits inside an empty box. On a caption beside a box, the class would move the words for no
reason. The contract is silent on the difference, so the agreement among the renderers rests on four
separate choices rather than on a declaration.

The outside view (the WAI-ARIA APG switch pattern; the Anvil, Mesa, Morningstar and UK Intelligence
Community design systems) is absolute. The words beside a checkbox or switch do not change with its
state. Only the box or the track shows the value. Disabled, error and focus may restyle the words
because they describe the whole control.

## Decision

A boolean kind's caption never carries `--filled`. On checkbox and toggle, the caption's appearance
does not depend on the value. Its states are the ones that describe the whole control: error,
disabled and readonly through the control, and focus.

`--filled` keeps its single meaning: the field's value is read inside a box whose caption floats.
DESIGN.md states the rule under State.

## Consequences

- No renderer changes: this records what all four already do.
- The contract still admits `filled` on every caption, so the rule is a declaration nothing enforces
  yet. Narrowing `MDY_SHELL_PART_STATES` so a boolean's caption cannot carry `filled`, or making the
  shell refuse the flag for a boolean, is the follow-up. Either one changes the contract snapshot and
  goes through `npm run contract:diff`.
- A theme that wants a ticked caption to look different has no hook for it, by design.

## Alternatives rejected

- **Put `--filled` on a ticked boolean's caption, as the shell would.** It moves the caption under the
  floating-label rule and makes the words a second state signal. A colour-only difference also risks
  WCAG 1.4.1.
- **Leave it unstated.** The renderers agree today only by four separate omissions. The next renderer
  that passes the shell its full state would put the class on, and nothing would flag it.

## Verification

`battle-tests/browser/a-state-class-that-never-arrives.spec.ts` asserts only that an empty field's
caption is not filled. No spec yet ticks a checkbox and asserts that its caption has no `--filled`, so
the rule is unguarded until that assertion, or the contract narrowing above, lands.

## Security and privacy

None. This concerns a presentational class. No data or trust boundary is involved.
