# ADR 0178: A date a person can read aloud

Status: Accepted

## Context

One document, one day, three renderers, and three spellings. Measured with the browser's own locale
against the ISO value `2026-04-03`:

```
locale        en-US        it-IT        de-DE
plain         2026-04-03   2026-04-03   2026-04-03
lit           2026-04-03   2026-04-03   2026-04-03
angular       04/03/2026   03/04/2026   03.04.2026
```

Two questions sit on top of each other here, and separating them is what makes the decision
possible.

The first is whether each renderer is defensible on its own. Both answers on the table are:
unambiguous-everywhere, and correct-in-the-reader's-language. A browser check already refuses only
the combination that is neither — ambiguous *and* fixed across languages — and all three pass it.

The second is what an organisation running two of them shows to two people comparing screens. There
the answer is not a preference. `04/03/2026` is not one date written for an American; it is **two
dates**, and which one it is depends on who reads it. It fails silently: nobody is shown an error,
one reader takes away a different day than the one that was chosen, and is certain they read it
right.

`2026-04-03` removes the ambiguity and pays for it in familiarity — nobody says a date that way, and
a form full of them reads like a log file. Both of the options on the table are worse than a third
that was not being considered.

**By ear the gap is wider than by eye**, which is what settles it. `04/03/2026` is announced as
either a string of digits or a date, and the screen reader guesses the order the same way the eye
does, and can guess differently from the person holding the form. `2026-04-03` is unambiguous and
unpronounceable as a date: the listener has to reassemble it. Only the month by name is *said the
way a person would say it*.

## Decision

**A date is displayed with its month named, in the reader's language and order.** "3 April 2026",
"3 aprile 2026", "3. April 2026". A named month cannot be transposed, because `April` is not a
number, so the display is unambiguous without being foreign to the reader — which is what every
industry that pays for a misread date already does. No boarding pass says `04/03`; it says `03 APR`.

Three things that are separate and were being decided together:

- **the value is ISO, always.** `2026-04-03`, in the form, in the payload, in a draft. One value, N
  views — the shape the native date input has, and the shape the colour field already has here.
- **the display is the named month**, derived from the value and the reader's language. It is not a
  second value and nothing reads it back.
- **input accepts widely** where the field can be typed into: the reader's numeric order, ISO, dots
  or slashes or dashes. A person should not have to guess the format, because nearly anything works.

And the part that catches the mistake rather than describing it: **what was understood is echoed
back immediately.** Somebody types `04/03/2026` and the field shows "3 April 2026". If they meant
the fourth of March, they see it at the moment they typed it. A format hint under the field is read
once and forgotten; the echo happens every time, and it catches the error that actually occurs.

**The three renderers agree.** A difference in this between two adapters is a defect in itself,
independent of which spelling either one chose: two people comparing screens and seeing different
text for the same day will, at least once, conclude they hold different days — and under the numeric
formats they will actually have read different days.

## Consequences

Every renderer now needs a localised month name where two of them needed no formatting at all, and
`Intl.DateTimeFormat` becomes load-bearing on a path that previously could not fail. A locale the
platform does not know, or an environment without full ICU data, must fall back to the ISO value
rather than to a numeric localisation — a fallback that reintroduces ambiguity is worse than the
one it replaces.

The display grows and varies in width with the language: "3 May 2026" and "3 settembre 2026" are not
the same size, and a field sized to the shorter one truncates the longer. Visual baselines move in
every locale a screenshot is taken in.

Accepting many input formats means accepting `04/03/2026`, which is ambiguous on the way *in* as
well. The echo is what makes that safe, so the echo is not a nicety attached to the decision — it is
the half that carries it, and a renderer that accepts widely without echoing has taken the cost and
left the benefit.

This forecloses a per-field choice of spelling. A document cannot ask for the numeric form, because
the reason it is refused does not depend on which document asked.

## Alternatives rejected

**ISO everywhere, the plain and lit answer.** Unambiguous, and it was the leading candidate until
the question was asked by ear: it is the one form that cannot be pronounced as a date. It also reads
as machinery to somebody filling in a form, which is a cost paid on every field by every person, in
exchange for solving a problem the named month also solves.

**The reader's numeric locale everywhere, the Angular answer.** It is the familiar form and it is
the ambiguous one. Making all three renderers agree on it would have converged the fleet on the
single spelling that can be read as the wrong day, and the agreement would have hidden that rather
than fixed it.

**Leaving the divergence and recording it as intentional.** This was the cheapest option and the one
the browser check was already written to allow. It fails the second question: the mismatch is a
defect on its own, and no amount of per-renderer justification reaches it.

**A per-document `displayFormat` option.** One renderer already carries `"iso" | "localized"` as a
component input. Exposing it in the contract would let a document choose the ambiguous spelling,
which is the outcome this record exists to prevent, and would add a knob every adapter must
implement and 1.0 must keep stable. The smallest public surface that satisfies the constraint has no
knob at all.

## Verification

`battle-tests/browser/a-date-that-reads-as-two-dates.spec.ts` asserts the property that survives this
decision: **agreement across renderers, rather than a particular format.** It sets the locale where
the browser can see it — an earlier version varied an option on the mount that no host reads, so its
three cases were one case, and it reported the only locale-aware renderer as the broken one. A spec
that varies an input nothing reads is not measuring a variable, and the shape of its wrong answer is
indistinguishable from a real one.

That check closes when the three converge and stays meaningful afterwards. What it does not cover:
that the month is *named* rather than numeric. A check for this decision must fail a display
matching `\d{1,2}[/.-]\d{1,2}[/.-]\d{4}` in every locale, and must fail agreement on ISO — the
alternative the renderers already agreed on — so it distinguishes this decision from the state that
preceded it.

## Security and privacy

None on the display path: the date is the person's own input, already in the document, and naming
its month moves no data across a boundary.

The input path takes one obligation. Accepting many formats means parsing more shapes, and a parser
that accepts widely must still produce an ISO value or nothing — never a partially-read date. A
field that silently keeps the previous value after an unreadable entry shows a day the person did
not choose, which is the failure this record is about arriving by another road.
