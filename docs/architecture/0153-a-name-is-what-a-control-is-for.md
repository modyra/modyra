# ADR 0153: A control's accessible name is what it is for, never what it holds

Status: Accepted

## Context

Someone driving a browser by voice says the word they can see, and the command is matched against the
control's accessible name. A control whose visible words are absent from its name cannot be reached by
reading it aloud: the person is looking straight at a word the control does not answer to, with
nothing to indicate that the word is not its name.

A check written from that observation compared **everything a control shows** against its name and
required the first to be contained in the second. On a button that is right — a button's visible text
*is* its label. On a chooser it is not, and the difference had never been stated:

```
button          shows its name
chooser         shows its value
chooser, empty  shows a placeholder standing in the value's place
```

The check was therefore asking a chooser to answer to the grey word inside it. Worse, it was asking
this in the one direction that cannot detect the real defect:

| implementation                          | accessible name | the check said |
|-----------------------------------------|-----------------|----------------|
| named by its label                       | `Colour`        | **fails**      |
| named from its own contents (the defect) | `select…`       | **passes**     |

It failed the renderer that was right and passed the two that could only be caught by asking the
opposite question. That inversion is not a detail of one check: a chooser built as a `button` is
named from its own subtree unless something overrides it, which is the ordinary way this defect is
born, and nothing here was capable of seeing it.

## Decision

A control's accessible name is the **label** — what the control is for. It does not contain the
control's current value, and it does not contain the placeholder standing in the value's place.

Two statements follow, and the suite makes both:

1. what a **button** shows is contained in its name;
2. what a **chooser** shows is **not** contained in its name, and does not change when the value does.

A placeholder counts as label text in exactly one case: when there is no other visible label, because
then it is the only thing saying what the field is for. That case is a defect of its own — an
instruction that leaves the moment the field is used — and it is not the case any Modyra control is
in, since every field renders a label element.

## Consequences

A name may say more than the control shows and usually should; it may not say less, and it may not
say something else. The value is published separately, through the element's own value, so a reader
hears three facts in three positions — name, role, value — rather than the same word twice.

The cost is that the suite now needs a **choice made** before it can say anything about a chooser's
name. Two of the three renderers show nothing until one is, so a check that only inspects a freshly
mounted control can pass there without having compared anything that matters. That is a second test,
a second mount and a second reading, and it is not optional: without it the file returns to being
green for the wrong reason.

Neither statement can be checked against a control that draws no label, and every kind here draws
one. A kind that stops doing so takes the second statement out of range silently.

## Alternatives rejected

**Exempt choosers from the check.** The comfortable reading, and it loses the defect entirely: the
check would then be silent about exactly the controls where names go wrong most often.

**Put both the label and the value in the name.** Then the name changes as the field is filled in.
Choosing "Beta" would make the control answer to "Beta" and stop answering to "Colour", so the only
way back to a field one has just completed is to say aloud the answer one is trying to replace. It
also makes the name non-unique the moment two fields offer the same option.

**Compare against the placeholder only when it is visible.** Same failure in slower motion: the name
would have to change when the placeholder is replaced by a value.

## Verification

`battle-tests/browser/a-name-that-does-not-contain-what-it-says.spec.ts`, in three renderers.

The first test states the button direction and the chooser direction together. The second makes a
choice and re-reads the name, which is the assertion that distinguishes a correct implementation from
a defective one without anyone having to judge which is which by looking at it.

Both were checked against a planted defect: computing the name from the control's own contents
instead of its label takes all three of the second test's cases down. Before this record, the same
planted defect turned the file **green**.

## Security and privacy

None directly. One note that is not a security finding but sits beside one: a name that follows the
value publishes that value into the accessibility tree under a second key, so a chosen value appears
in places a value is not expected — announced on focus, and included where a name is logged or
mirrored. Keeping the value out of the name keeps it in one place.
