# ADR 0174: A key means what the part under it means

Status: Accepted

## Context

The space bar was claimed by two renderers in an open panel — a calendar and a list of choices — and
declared by the catalogue for neither. The question looked like "does Space commit", and answering it
per kind would have produced two rules with no principle between them.

Asked outside the repository, the answer inverted the question: **what Space does is decided by where
focus is**, not by which widget is open.

```
focus in a text box                Space is a character. Always. No panel takes it.
focus on a thing with a highlight  Space is "this one"
focus on a button                  Space activates it, as it does on every platform
```

The fear that prompted the question — a person typing in a filter box cannot type a space — is not a
case to weigh against the others. It is the first line of the rule.

The distinction the two keys carry, which is why they are not one binding even where they act alike:
**Enter means done, Space means this one.** They collapse on a single-choice control, because
choosing *is* being done. They come apart on a range picker, where Space marks one end and the person
keeps moving, and on a multiple-choice list, where Space toggles and the list stays open so the next
pick is one keystroke away.

## Decision

**A key's meaning is a function of the part it lands on.** The keyboard catalogue already has the
column for it — `on` — and Space is declared there rather than per kind:

```
on gridcell   (a day in a month)      commit
on option     (a choice in a list)    toggle where the field holds several, commit where it holds one
on the opener (a button, not typeable) open — already declared
in a text box                          nothing: the platform keeps the key
```

Whether an option toggles or commits is read from the value contract's own shape — a field holding
`option[]` can hold several — rather than from a list of kinds, so a kind that changes shape moves
this with it.

**No binding claims a key over a text box.** That is expressed by declaring nothing, which is the
only way to say "the platform's". A renderer that swallows the key there is wrong against this record
even though no binding contradicts it.

## Consequences

Two keys now describe the same act on the kinds where the acts coincide, and that is deliberate: the
pair is not redundancy but two meanings that happen to agree today. A reader of the table who sees
only `select` will find `Enter → commit` and `Space → commit` on the same part and should not merge
them.

`Space` on a `gridcell` commits and closes on a single-date picker. On a range this record does not
settle what "commit" means at the first end — the intent vocabulary has one word and the range's two
ends are a distinction inside it. That is left where it is rather than invented here, and it is the
strongest argument against calling this record complete.

## Alternatives rejected

**Declare Space per kind.** It is what the renderers did, and it produced a key that means one thing
in a calendar and another in a list with no statement of why. The parts already carry the difference.

**Leave Space undeclared and let Enter do the work.** A person whose hand is on the space bar over a
highlighted option is not doing something exotic; the listbox and grid patterns both give Space a job,
and a control that ignores it is the one control on the page that does.

**Give Space to the panel unconditionally.** It takes the space bar from anybody typing a filter or a
date, which is the case the outside view put first.

## Verification

`MDY_WIDGET_KEYBOARD` is derived, so the declaration is checkable by kind and part; the keyboard
conformance sweep presses what the table declares and reports what it cannot reach.

Not verified here: that each renderer answers the new bindings. They were claimed by two renderers
before this record and the third answered nothing, so at least one is expected to be short until the
sweep is run against it — this record declares the rule and does not claim the implementations match
it yet.

## Security and privacy

No impact. A key gains a declared meaning on a control a person is already operating; nothing crosses
a boundary and no act becomes reachable that was not.
