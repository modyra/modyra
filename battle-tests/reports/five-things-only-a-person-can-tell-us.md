# Five things only a person can tell us

Everything else in this directory was measured by a machine. These five cannot be: they are about
what it is like to use these controls with a screen reader, and the only instrument for that is
somebody who uses one.

**Who.** Not a developer trying one out. Someone who uses a screen reader every day, who has not
seen how these controls are built, and who is given a task rather than a script. A developer's
run finds the crashes; it does not find the twenty seconds of listening that make somebody give up.

**What you need.** NVDA is free on Windows; VoiceOver is on every Mac and iPhone. Any one of them.
Nothing needs installing on the tester's side beyond the reader they already use.

The trials are written in ordinary words on purpose, because the tester should not have to learn ours.
Where one says *the reading cursor* — the thing that walks a document, as opposed to Tab, which jumps
between controls — that is:

| reader | the reading cursor | how a control is operated |
|---|---|---|
| VoiceOver on a Mac | `VO`+left/right arrow | `VO`+space, or the arrow keys once inside |
| NVDA on Windows | the arrow keys in browse mode | `Enter` to enter forms mode, then the arrow keys |
| VoiceOver on iPhone | swipe left and right with one finger | double-tap, or swipe up and down to change a value |

**All three are worth running if they can be.** They differ in the one thing trial 1 is about — how a
reader moves through a control that also wants the arrow keys — and a strip that behaves on a Mac can
still trap somebody on Windows. Where only one is available, say which in the answers: a result from
one reader is a result about that reader.

**How long.** Twenty minutes for all five, unhurried.

**What to record.** For each: what the person tried, what they heard, what they expected to hear,
and how long it took. **Record the failures as sentences, not as bug ids** — "it read the same
thing twice and I couldn't tell if I'd done it" is worth more than a severity.

A trial that goes fine is a result. Write it down too, or the ones that fail look like the only
ones anybody tried.

---

## Getting to each trial, and the one that cannot be reached yet

Checked against the demo as it stands, because a trial whose starting state a person has to build
themselves is a trial that begins with them failing at something else.

Start a demo and open it in the reader's own browser. Any of these serves one renderer:

```sh
npm run demo:plain        # port 4307
npm run demo:lit          # port 4303
npm run demo:angular
```

| trial | where | what to do first |
|---|---|---|
| 1 — walking the strip | **Palette**, on `/lab.html` | already holds twelve; nothing to set up |
| 2 — choosing an option | **Palette**, on the front page | open it and choose one |
| 3 — removing from the middle | **Palette**, on `/lab.html` | remove one from the middle of the twelve |
| 4 — crossing twelve values | **Palette**, on `/lab.html` | already holds twelve, with ordinary names |
| 5 — holding a step key | **Servings**, on the front page | it already holds the same value twice, which is what draws a quantity |

`/lab.html` is the same server, one page along — `http://localhost:4307/lab.html` for the first
command above. Its Palette field holds twelve values from the start, which is what trial 4 needs and
what makes trial 1 worth doing: two or three names is not a shorter version of either question. What
is being measured is what happens when the crossing gets long enough to give up on, and a strip a
person crosses in two presses has nothing to say about it.

**Trial 5 stays on the front page**, because it needs a value chosen more than once — that is what
draws a quantity to step — and the lab's twelve are each chosen once.

## 1 — Walking a strip of chosen values with a virtual cursor

A field holds several chosen values, drawn as a row of small blocks. Ask the person to **read
through them with the reader's own reading cursor** — the one that walks a document — rather than
with Tab.

*What we are afraid of:* the strip is built to be driven with arrow keys as a single control, and a
reading cursor walks a document differently. The two ways of moving may disagree about where you
are, so a person reading the page hears something the control does not think is current.

**Failure looks like:** the reader announces a value that is not the one the control is treating as
current; or moving the reading cursor changes what the control thinks is selected.

## 2 — Choosing an option and hearing it once

Open the list of options, move to one, and choose it.

*What we are afraid of:* the choice is announced by two things at once — the option itself saying it
became selected, and a live region announcing the change — so it is heard twice.

**Failure looks like:** any part of the confirmation said twice. Note the exact words in order.

## 3 — Removing a chosen value, and knowing where you are afterwards

With several values chosen, remove one from the middle.

*What we are afraid of:* two things happen at the same moment — the focus moves somewhere, and a
live region announces the removal — and the order they reach the reader is not fixed. One of them
can interrupt the other.

**Failure looks like:** the announcement is cut off; or it is heard but the person cannot tell where
the focus went; or focus lands somewhere they did not expect and the reader does not say so.

## 4 — Crossing twelve values with the arrow keys

Twelve values chosen, each with a name of ordinary length. Ask the person to get from the first to
the last using the arrow keys, and **time it**.

*What we are afraid of:* every step announces the whole name, so crossing the strip means listening
to twelve names in full. Past about twenty seconds, people stop using the control.

**Failure looks like:** more than twenty seconds. Also record whether they found a faster way on
their own, and what it was — if there is one and they found it, that is the answer; if there is one
and they did not, that is a different answer.

## 5 — Holding down a key that changes a quantity

Some values carry a number that can be stepped up and down. Ask the person to hold the key down
rather than pressing it repeatedly.

*What we are afraid of:* every step announces the new number, and holding the key produces steps
faster than they can be spoken, so the reader falls behind and keeps talking after the key is
released.

**Failure looks like:** the reader still announcing numbers after the person stopped; or the final
number never announced because the queue was still draining.

---

## What happens to the answers

They come back here, as sentences, with the tester's own words kept. **A finding from this file
outranks a measurement from any other**, because everything else in this directory measures what a
page contains and this measures what a person got.

Where an answer contradicts something the automated suite reports as green, the suite is wrong about
what it was asking, not the person about what they heard.
