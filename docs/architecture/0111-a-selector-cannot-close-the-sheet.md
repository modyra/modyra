# ADR 0111: A selector cannot close the sheet it is written into

Status: Accepted

## Context

`compileMdyTheme` takes three strings from its caller. Two were guarded and one was guarded against
the wrong container:

| input | `</style><script>alert(1)</script>` |
| --- | --- |
| `seed` | refused — not a parseable hex |
| `name` | refused — `/^[a-z][a-z0-9-]*$/i` |
| `selector` | **accepted, and written into the CSS character for character** |

The guard was `/[{};@]|\/\*|\*\//`, and its own comment said what it does: *"This keeps interpolated
text inside its position."* It answers one containment question — a selector must not break out of
the **CSS rule** it sits in, which is what `}`, `;`, `@` and a comment sequence each do. `</style>`
contains none of those characters.

There is a second container and nobody had asked about it. A stylesheet is frequently written into a
`<style>` block, and `</style>` ends that block wherever it appears — inside a string, inside a
comment, inside a selector. Everything after it is parsed as markup.

**The hole was in the probe before it was in the code.** An earlier reading reported the compiler as
refusing hostile input on all three strings. Every payload aimed at `selector` had happened to carry a
`}` or an `@`, so three refusals were read as a guard. They were three refusals of a different attack.
Re-measuring rather than trusting the summary is what found it.

**What it is and is not, measured.** Nothing in this repository feeds it: Studio does not call
`compileMdyTheme`, and `studio-model` has no theme selector. The value comes from whoever writes the
build. It becomes an ingress the moment an application compiles a theme per tenant or per brand from
a name a customer supplies — which is what a theme compiler is for.

## Decision

**A theme selector may not contain `<`, and `>` is not refused.**

The guard becomes `/[{};@<]|\/\*|\*\//`, and it now answers two questions rather than one: the
interpolated text stays inside its **rule**, and inside the **sheet**.

`<` is free to refuse. It is not valid anywhere in a CSS selector — it was proposed as a combinator
and abandoned — so nothing correct is being taken away, and one character closes every spelling of the
escape rather than the one that was demonstrated.

**`>` stays legal, and that is the load-bearing half.** `.a > .b` is the ordinary child combinator. A
guard that took the pair for symmetry would close the exit and the language with it, which is the
failure mode this record exists to prevent as much as the escape is.

**The guard still does not decide *which* selectors a theme should accept.** A caller compiling themes
from someone else's data owns that question. This is containment, not a policy on names.

## Consequences

**A selector containing `<` now throws where it used to compile.** No valid selector contains one, so
the only callers affected are the ones this exists to stop.

**Two containment questions live in one regular expression**, which is cheap and slightly dishonest:
they have different reasons and the same implementation. The comment carries both, and a third
container — a CSS-in-JS template, an XML wrapper — would need the same reading done again rather than
a character appended by analogy.

**Guarding the container does not guard the caller.** A build interpolating a customer's string into
anything else — a class attribute, a `<style>` block it writes itself, a JSON blob — has the same
problem one level out, and this function cannot see it.

## Alternatives rejected

**Refuse `<` and `>` together.** Symmetrical, and it breaks the child combinator, so every theme
scoping a rule to a direct child stops compiling. A guard that costs the language a construct is worse
than the escape it closes.

**Allowlist the selector grammar instead of denying characters.** Strictly better containment and a
much larger change: CSS selectors admit escapes, unicode ranges, `:not()` with a nested list, and
attribute values with arbitrary quoted content. A partial allowlist refuses valid themes, which is the
failure that makes people delete the guard.

**Escape rather than refuse.** There is no escape for `</style>` inside a stylesheet — the token is
recognised by the HTML parser before CSS ever sees it, so nothing written in CSS syntax can neutralise
it. Refusal is the only containment available at this layer.

**Leave it and document that the caller owns sanitisation.** Defensible in that the function never
promised to be an ingress guard. Rejected because it costs one character to close, and because the
signature invites exactly the use — a per-tenant theme name — that makes it one.

## Verification

- `battle-tests/adversarial/styles/a-selector-that-leaves-the-stylesheet.battle.test.mjs` — four
  escapes refused and **six ordinary selectors accepted**: `:root`, `.theme-dark`,
  `[data-theme="brand"]`, `.a > .b`, a `:not()` and a comma-separated list. The second half is what
  stops the cheapest way to pass being a guard that refuses everything.
- Falsified rather than assumed: removing `<` from the class fails that battle; restoring it passes.
- `npm run test:styles` — 32 assertions over the compiler, including that it is deterministic across
  representative seeds and that every selector shape it supports still compiles.

## Security and privacy

**This is the record's subject.** The trust boundary is the caller's: `compileMdyTheme` produces a
stylesheet from strings, and a string that leaves the sheet is script execution in whatever page the
sheet is written into. Severity comes from where the value can originate — a theme compiled from a
tenant name is attacker-controlled input reaching a `<style>` block.

Nothing is stored or transmitted, and no data is at rest. What an attacker gained before this was
arbitrary script in the origin serving the stylesheet, which is total.

**What remains unguarded is stated above and is real**: containment here says nothing about what a
caller does with the compiled text, and a build that interpolates untrusted strings elsewhere has the
same defect where this function cannot see it.
