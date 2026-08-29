# ADR 0175: The caption names the group, each control names itself

Status: Accepted

## Context

A date range is one field with two boxes under one caption. Each box was told two things about its
name: it pointed at the caption *and* carried a name of its own — "Start date", "End date".

Only one of the two can win. `aria-labelledby` beats `aria-label`, so **both boxes announced the
field's caption and neither said which end it was**. The names meant to tell them apart were never
spoken. A check asserted the second box's name by reading the attribute rather than by resolving what
a reader hears, so the defect passed a green suite for as long as it existed — an attribute that
loses the name computation is not a name.

Two records disagreed about the repair. One said the first box must not carry a name because the
caption already points at it; the projection said both boxes must carry one. Neither is right: the
first leaves the pair asymmetric — "Stay" and "End date", with nothing saying the first is the start
— and the second is what produced the collision.

## Decision

**When several controls share one caption, the caption is the name of a *group*, and each control has
a name of its own that says its role within the group.**

```
group  "Stay"          ← the caption's words, said once on entry
  box  "Start date"    ← its own name
  box  "End date"      ← its own name
```

A reader arriving on the first box hears *"Stay, group — Start date, edit text"*, and on the second
*"End date"*: the group is not repeated because the person has not left it. That is the reading a
sighted person gets from the layout, and it is the structural version of "Stay, start date" rather
than the concatenated one — concatenation says "Stay" on every box.

**The group carries the caption's words rather than a reference to it.** A reference is one more
thing that can point at nothing: a caption a document did not write is never drawn, and the reference
then resolves to no element. A reader hears the same sentence either way.

**The author names the thing; the library names the parts.** "Stay" is the thing. Start and end are
parts of a range, and the kind knows its own parts — so the role names are the library's, localised
with the rest of its messages, and an author who writes one word ships a field that is already right.
An author may override them, for the case where the roles have domain words: "Check-in" and
"Check-out" beat "Start date" and "End date" for a stay.

**The test for whether this rule applies at all**: *can a person meaningfully fill in one and leave
the other empty?* A start without an end — yes, so they are two controls and this rule applies. A day
without a month — no, so those are segments of one control, the caption names the control, and each
segment's name describes its role rather than standing as a sibling. That is why the timepicker's
hour and minute are untouched by this record.

## Consequences

The rule generalises past dates: a lowest and a highest price are a group named "Price" holding
"Minimum" and "Maximum"; a first and last name are a group named "Name". The shape is the same
wherever one caption sits over more than one control, and the library owes the role names in each
case.

This supersedes, in prose, a decision that the first box should carry no name of its own. That record
was correct that *two answers to one question* was the defect and wrong about which answer to drop.

The strongest argument against this record: `role="group"` adds an announcement a person hears on
entry, and a form of many two-part fields is a form of many group announcements. The alternative is
boxes that cannot be told apart, which is worse, but the cost is real and lands on exactly the people
this is for.

## Verification

`packages/lit/test/what-names-the-second-of-two.test.mjs` asserts both halves — each box's own name,
the absence of a caption reference on the box, and the group carrying the caption's words. It was
rewritten with this record: the version it replaces asserted the opposite rule.

Not verified here: what a screen reader actually announces. The check reads the tree the platform
computes from, which is the nearest thing this suite can reach, and the sentence in the Decision above
is the published pattern's rather than a measurement of any one reader.

## Security and privacy

No impact. Naming only; no data crosses a boundary and no control gains an act.
