# ADR 0050: A document cannot make the form stop answering

Status: Accepted

## Context

`validators.pattern` in the dynamic contract is a string. It arrives from a CMS, a model, a saved
project or a POST, and the engine already treats it as needing care: a source longer than
`MDY_MAX_DYNAMIC_PATTERN_LENGTH` never reaches `RegExp`, and an unparseable one is skipped with a
diagnostic and no validator.

Syntax was checked. Cost was not:

```
(a+)+$   against thirty characters and a miss

  22 chars ->    364 ms
  26 chars ->    788 ms
  30 chars -> 12,628 ms
```

Each further character roughly quadruples the work. `^(a|a)*$` and `^(a*)*$` behave the same. A
`RegExp` match is synchronous, so this is not one slow field — it is the thread: no keystroke is
handled and nothing repaints while it runs. A document supplies the pattern and the user supplies the
input, so neither of them has to be hostile for it to happen; a pattern written carelessly and a
value typed normally are enough.

Found from outside by `battle-tests/adversarial/security/document-patterns.battle.test.mjs`, which
runs each pattern in a child process under a budget so that the suite bounds the cost rather than
hanging on it.

## Decision

**A document's pattern is refused when its shape can backtrack exponentially**, on the same terms as
one whose syntax will not parse: a diagnostic, and no validator.

Two shapes are refused, and they are the ones that turn backtracking from quadratic into exponential:

- **nested unbounded repetition** — a repeated group that itself contains unbounded repetition,
  `(a+)+`, `(a*)*`, `(([a-z])+)+`;
- **repeated alternatives that can match the same text** — `(a|a)*`, `(a|ab)+`,
  `([a-z]|[a-z])*`, `(\w|[a-z])*`, compared by *what each alternative accepts* rather than by how it
  is written: a class, a class escape, a dot and a literal are four notations for a set of
  characters, and what decides ambiguity is whether two of those sets share one.

**Structure is what is checked, not slowness.** JavaScript offers no way to bound a match's cost from
outside it — no deadline, no step limit, nothing synchronous — so the source's shape is the only
thing that can be decided before the match runs. A pattern that is slow for some other reason is not
caught, and this is the reason the claim is stated as it is rather than as "patterns are safe".

**The check is conservative, and where it cannot decide it allows.** A refusal removes a rule the
document's author wrote, and a rule that vanishes is worse than a slow one: bounded repetition is
left alone, and a branch this cannot read — one starting with a nested group, a backreference, or
something that may not be there at all — is not refused on suspicion.

Sets are compared over a sample alphabet rather than by reasoning about notations, which keeps the
line where it has to be: `([a-z]|[0-9])+` and `(.|\n)*` are **not** ambiguous — a digit is not a
letter, and `.` does not match a newline — and refusing them would delete rules that are perfectly
safe.

**The field survives the refusal.** The parser reports `MDY_DYNAMIC_PATTERN_TOO_COSTLY` and keeps the
field: one rule the engine will not run is not a reason to take an input away from the person filling
the form. This differs deliberately from the length cap, which drops the whole field — that guard is
about a document that is malformed, and this one about a rule that is unsafe to run.

## Consequences

A pattern of these shapes stops being enforced. Some are legitimate rules written by someone who did
not know the cost, and their form now accepts values it used to reject, with a diagnostic naming the
pattern as the only warning. That is the trade: a rule that is not applied against a form that stops
responding.

The heuristic is fooled by shapes it does not model — a branch beginning with a nested group or a
backreference is undecidable and therefore allowed — so this narrows the hole rather than closing it.
Nested repetition was attacked through a class, a dot, a non-capturing group, a named group, a lazy
inner quantifier, a bounded outer one and two levels of nesting, and is refused through all of them. A consumer who accepts documents from outside their own organisation should still treat pattern
authorship as a privilege.

Two places now read a pattern's shape: the parser, so the document's author is told where the
document is read, and `buildDynamicValidators`, so the rule is refused for every caller rather than
only for the parse that happened to look. The duplication is deliberate — the second is the guarantee
and the first is the message.

Typed schemas are untouched. `pattern(new RegExp(...))` written in a consumer's own module is their
code running their regex, and the engine has no business rewriting what a developer wrote.

## Amendment: what counts as structure is a variable body, not an unbounded one

The decision holds — the check refuses **structure, not slowness** — and what it read as structure was
wrong on one axis. It looked for repetition with no ceiling, `*`, `+`, `{n,}`, and left a counted
repetition alone on the reasoning that a ceiling bounds the work.

A ceiling on the *outer* repetition does not. It writes the exponent as a number instead of leaving
it as the length of the input. Measured with a killable child process, one process per measurement,
milliseconds by input length:

                      24     26     28     30      32
    ^(a+){15}b$       85    284    960   3063   >8000
    ^(a{1,10})+b$     85    339   1353   5385   >8000
    ^([a-z]+){12}!$   56    146    388    959    2330
    (.*a){20}$       408   1714   6592  >8000

About 3.2× every two characters: thirty-six characters is minutes, forty is hours. And it is the
*near miss* that costs — a string that matches immediately stays flat at 14ms whatever its length,
which is precisely what an attacker sends.

So the rule reads two things instead of one:

- a group's body is **variable** when it holds a quantifier whose minimum and maximum differ — `+`,
  `*`, `?`, `{n,}`, `{n,m}` with n≠m. `{2}` on a single character is not: it consumes two, always,
  and offers nothing to divide.
- a group is **repeated** when the quantifier after it may apply two or more times, whether that is
  written as a count or left open.

A variable body that is repeated is the exponential shape. `(\d{2}){3}` is not — its body always
consumes two characters, so there is one way to divide the input and nothing to backtrack over — and
neither is `(?:ab){3}`, once the `?` that names a group's kind is no longer read as a quantifier.

**The second half, which is not optional.** A variable body is a necessary condition for the blowup
and not a sufficient one: variability creates the *opportunity* to divide the input several ways,
ambiguity is what makes the engine try them. Refusing on variability alone deleted **ten of twenty**
patterns from a corpus of what form authors actually write — an IPv4 address, a hostname, a slug, a
grouped card number, a person's name — each measured flat against its own near miss out to two
hundred characters, beside `^(a+){15}b$` going 0.05 · 0.18 · 5 · 146 · 3106 ms over twenty
characters. Half of what `validators.pattern` is for is not a declarable cost.

What the cheap ones have is a **forced boundary**: something the stretchy part cannot stand in for
sits between one repetition and the next, so the division falls in exactly one place. So the seam is
read, in the only two shapes it has:

- the body ends stretchy — pinned unless that ending accepts everything the body's *first* element
  does, because the first element is what the next repetition starts with. `[A-Z][a-z]+ ?` is
  pinned: a space is not a capital.
- the body ends fixed — pinned unless the stretchy part before it accepts everything that ending
  does. `\d{1,3}\.` is pinned, a dot is not a digit; `.*a` is not, because a dot *is* an `a`.

Containment rather than overlap, deliberately. A boundary the stretchy part can only *sometimes*
take still pins the division wherever it cannot — an author who writes `[A-Za-z0-9]+[.-_]` has
written a class that overlaps digits and capitals by accident, and the `.` and the `_` in it remain
boundaries no letter can stand in for.

What cannot be read is still refused when it repeats: a body this cannot take apart into elements,
or an element whose character set is undecidable, counts as ambiguous. That is the conservative
direction this record's own paragraph describes, restored — it is the *known* shapes that are
allowed through, not the unknown ones.

## Alternatives rejected

**Match under a deadline.** The right fix, and JavaScript cannot express it: `RegExp.prototype.test`
runs to completion on the calling thread. A worker would make every validator asynchronous, which
changes the validation contract for every consumer to fix a subset of one validator's inputs.

**Measure the pattern at build time against generated adversarial inputs.** Catches shapes a
structural check misses, and needs the adversarial input — which is the same problem again, since
the string that triggers the blowup depends on the pattern. It also makes form construction's cost
depend on a timing measurement, which is not reproducible across machines.

**Refuse every nested quantifier, without the alternation case.** Simpler, and it misses `^(a|a)*$`,
which was measured at the same order of cost.

**Drop the field, like the length cap does.** Consistent with the neighbouring guard and worse for
the user: a form missing an input is a form nobody can complete, while a form missing one rule still
collects the answer and can still be validated on the server.

## Verification

- `packages/core/test/pattern-cost.test.mjs` — every measured exponential shape is refused; twelve
  ordinary patterns (email, IBAN, phone, URL, zip, alternation of words) are left alone; a bounded
  repetition is not treated as nesting; what the heuristic cannot read it allows.
- `packages/core/test/dynamic-diagnostics.test.mjs` — the document reports
  `MDY_DYNAMIC_PATTERN_TOO_COSTLY`, keeps its field, and the refused rule really is absent; an
  ordinary pattern still rejects what it is meant to reject.
- `battle-tests/adversarial/security/document-patterns.battle.test.mjs` — the attack that found it,
  with an ordinary pattern and an unparseable one as controls.

## Security and privacy

Closes a denial of service available to anyone who can supply a document: a pattern of a few
characters makes a browser tab stop responding while a user types, and on a server-side parse it is
the request thread. No value is disclosed and nothing crosses a trust boundary — what is lost is the
form's ability to answer at all, which is why it is registered as its own claim rather than under the
one about where a name may point.

The residual risk is stated above and is real: this refuses known shapes, not all costly patterns.
