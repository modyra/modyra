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
- **repeated alternatives that can match the same text** — `(a|a)*`, `(a|ab)+`, compared by the
  characters each alternative can start with.

**Structure is what is checked, not slowness.** JavaScript offers no way to bound a match's cost from
outside it — no deadline, no step limit, nothing synchronous — so the source's shape is the only
thing that can be decided before the match runs. A pattern that is slow for some other reason is not
caught, and this is the reason the claim is stated as it is rather than as "patterns are safe".

**The check is conservative, and where it cannot decide it allows.** A refusal removes a rule the
document's author wrote, and a rule that vanishes is worse than a slow one: bounded repetition is
left alone, and alternatives whose first characters cannot be read cheaply — a class, a dot, a nested
group — are not refused on suspicion.

**The field survives the refusal.** The parser reports `MDY_DYNAMIC_PATTERN_TOO_COSTLY` and keeps the
field: one rule the engine will not run is not a reason to take an input away from the person filling
the form. This differs deliberately from the length cap, which drops the whole field — that guard is
about a document that is malformed, and this one about a rule that is unsafe to run.

## Consequences

A pattern of these shapes stops being enforced. Some are legitimate rules written by someone who did
not know the cost, and their form now accepts values it used to reject, with a diagnostic naming the
pattern as the only warning. That is the trade: a rule that is not applied against a form that stops
responding.

The heuristic is fooled by shapes it does not model — a nested quantifier reached through a
backreference, alternation over classes that overlap — so this narrows the hole rather than closing
it. A consumer who accepts documents from outside their own organisation should still treat pattern
authorship as a privilege.

Two places now read a pattern's shape: the parser, so the document's author is told where the
document is read, and `buildDynamicValidators`, so the rule is refused for every caller rather than
only for the parse that happened to look. The duplication is deliberate — the second is the guarantee
and the first is the message.

Typed schemas are untouched. `pattern(new RegExp(...))` written in a consumer's own module is their
code running their regex, and the engine has no business rewriting what a developer wrote.

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
