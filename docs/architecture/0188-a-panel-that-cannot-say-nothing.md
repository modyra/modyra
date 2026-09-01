# ADR 0188: A panel that cannot say nothing

Status: Accepted

## Context

The question that has cost the most hours in this repository is not *what does the page have* but
**did the measurement I just took happen at all**. Every instance recorded here failed in the same
direction — towards the answer that confirms:

- a conformance section that passed because the renderer emitted no ids, so nothing could collide;
- a check that returned early and reported as a passing test, fifteen greens over fourteen answers;
- a version literal used as a sentinel for "unsupported", which went quiet the day that version
  arrived;
- a probe that read the wrong half of a result and reported an absence that was a presence
  elsewhere.

An inspection panel built without a defence against this species industrialises it. A blank cell
reads as *empty*, and empty is a claim: it says the value is absent rather than that nobody looked.
The two are different findings with different repairs, and a panel that cannot tell them apart sends
its reader to the wrong one.

Much of what such a panel needs already exists and is decided elsewhere. This record says what is
inherited and what is new, because the drafting of it began by proposing three things of which two
were already built.

## Decision

**Nothing in the panel draws a bare value. Every datum is a `Reading<T>`:**

    { read: true;  value: T; source: string; at: string; method: string }
    { read: false; reason: "unsupported" | "absent-probe" | "threw" | "not-attempted"; at: string; detail?: string }

**The layer that draws accepts `Reading<T>` and never `T`.** That is the whole mechanism: an empty
cell is not reachable without passing through the branch that carries a reason, so "nobody looked"
cannot be rendered as "nothing is there". A panel that could still draw a bare value would rely on
its authors remembering, which is the thing being replaced.

**A collector is a function from an element to a `Reading<T>` that does not know who called it.**
The panel and the conformance bench import the same collectors — one instrument, two consumers.
Two probes for one question is how two readings of the same thing came to disagree, twice, on
different days.

**The computed column declares its method.** Where a browser exposes its accessibility tree the
reading says so; where it does not, `method: "own-implementation"` — never presented as the
browser's answer. A panel that borrows authority it does not have is worse than one that abstains.

### What this record does not decide, because it is already decided

- **Masking.** ADR 0048 governs it: a masked field's value appears nowhere in its snapshot, and its
  error messages are kept and redacted rather than dropped. The panel inherits that whole.
- **What counts as secret.** ADR 0089's per-field `sensitive` is the declaration a panel honours.
  ADR 0099's `concealed` is a property of the *kind*, true before any form exists, and is a
  different statement — the panel must not conflate them, and a repair that made the snapshot read
  `concealed` was proposed during this drafting and withdrawn for exactly that reason.
- **Whether a part is owed.** `partIsOwed(node, { holds, offers })` already answers it, evaluated
  when it is asked rather than baked in — a part excused by a closed overlay becomes owed again the
  moment the overlay opens.

The reading layer also reports **which of the two decided a mask**: `masked: "declared"` for a field
the schema named, `masked: "guessed"` for one a name pattern caught. That distinction is security
information in itself — `guessed` tells a reader that nothing but a regular expression is protecting
that value — and it is why the flat `reason: "concealed"` first drafted here was rejected in favour
of what the code already did.

## Consequences

Every probe costs a declaration. A collector cannot return `undefined` and let the caller decide what
that meant; it has to say which of the four reasons applies, and picking between `absent-probe` and
`not-attempted` is a judgement the author has to make at the moment they write it. That is the cost,
and it is charged on every reading rather than on the ones that turn out to matter.

The panel is a development tool that will be judged by the rules this project applies to its own
controls — it has an interface, and an interface that cannot be reached by keyboard is not exempt for
being internal.

The computed column stays best-effort inside the page. The conformance bench remains the authority,
and a reader who takes the panel's word on an accessible name where the bench disagrees has taken the
weaker of two available answers.

## Alternatives rejected

**Draw bare values with "n/a" where a probe found nothing.** The obvious panel, and the one that
cannot distinguish the two findings this record exists to separate. Everything else here follows
from refusing it.

**Extend Angular DevTools.** Ties a contract-level instrument to one adapter, and makes the
comparison across renderers — the thing worth having — impossible from a single page.

**A recording format, so two runs can be compared.** Three costs, and the sharp one is guaranteeing
that two recordings describe the same document. That error has been made here once already and
withdrawn.

**Let the panel keep its own probes, separate from the bench's.** Cheaper to write and it recreates
the defect: two instruments for one question, agreeing until the day they do not.

## Verification

The mechanism is checkable by planting rather than by reading: a collector that returns `undefined`
must produce a cell reading *(not read)* and never a blank; one that throws must produce the same
with `threw`. **If that mutation is not red, the instrument is not worth building** — the panel would
have the same blind spot as what it replaces, with a nicer surface.

`holdsNow` is checked by opening the overlay: an absence excused while closed must become a finding
while open, in the same run.

What stays unguarded: nothing compares the panel's computed column against the bench, so the two can
disagree without either saying so. That is named here rather than closed, because closing it means
running the bench from inside the page, which this record does not propose.

## Security and privacy

**The reading layer cannot read a value a field declares sensitive.** The constraint lives in the
collector, not in the panel: a mask applied at the drawing layer leaves the value in every structure
behind it — an announcement log, an export, a comparison between renderers — and each of those is a
place a password can come to rest. ADR 0048 already requires this of the snapshot; stating it at the
collector is what keeps a second consumer from re-deriving it wrongly.

The announcement log is the sharpest case: a validation message that quotes the offending value would
be retained verbatim. ADR 0048's redaction covers it, and the panel must not build a second path that
bypasses it.

Nothing leaves the page. The panel reads and draws; it does not transmit, and no reading is persisted
beyond the session.
