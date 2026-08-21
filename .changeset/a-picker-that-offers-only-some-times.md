---
"@modyra/widgets": major
---

A timepicker can offer only some of the times

A booking form takes appointments every fifteen minutes; a shift planner takes them every five
before noon and every thirty after. `MdyTimeGranularity` says so, as data rather than as a callback,
so a dynamic document can carry it and a server can send it:

```ts
granularity?: {
  minuteStep?: number;   // must divide 60
  hourStep?: number;     // must divide 24
  windows?: readonly { from: string; to: string; minuteStep: number }[];
}
```

A window's step **overrides** the field's rather than composing with it — composition has no answer
when 5 and 15 disagree — and a window runs from `from` inclusive to `to` exclusive, so adjacent
windows tile with neither a gap nor an overlap to refuse.

`validateTimeGranularity` refuses a bad declaration **by name**: a step that does not divide its unit
(`minuteStep: 7` offers 0, 7 … 56 and then jumps four minutes, which is not the rule its author
wrote), a window that covers no time, a window naming something that is not an `HH:MM`, and two
windows claiming the same minutes. `explainGranularityProblem` turns each into the sentence a person
reads.

**Nothing is ever rounded.** A value already off the step — chosen before the rule changed, or sent
by a server that does not share it — is kept and shown as it is, and reports invalid so `canSubmit`
is false (ADR 0063). Stepping off it lands on an offered value *in the direction of travel*, because
stepping is how a user leaves a value the field will not take.

Every route into the value obeys the same rule, from one source: the face draws only offered numbers,
the arrows move by the step, typing an off-step value is refused, and `timepickerDialPick` lands a
dragged pointer on a number the face actually drew rather than on arithmetic of its own — so the face
and the drag cannot disagree.

**Breaking, both additive:** `MdyTimeFieldBounds` gains a required `step`, and `MdyTimeRejection`
gains `"off-step"` beside `"not-a-number"` and `"out-of-range"`. A caller that constructs bounds or
switches exhaustively on the rejection needs the new member; a caller that reads them does not.

Absent `granularity`, every function behaves exactly as before — step 1 is every value. No renderer
passes one yet.
