# ADR 0184: `ok` is false as soon as something was lost

Status: Accepted

## Context

A document that puts a condition inside the field it governs — `{ name: "taxCode", kind: "text",
when: {...} }`, which is where a person puts it the first time — parses like this:

    ok: true      rules: []      diagnostics: [MDY_DYNAMIC_UNKNOWN_MEMBER, severity "error"]

The condition is dropped, the field is kept, and the result says the parse succeeded. A consumer
that mounts on `ok` — which is what the name invites and what the type suggests — renders a
conditional field with no condition. The form then asks everyone for a tax code, including the
people the condition existed to spare.

The parser was not wrong about anything except the flag. It found the member, graded it an error,
and said so. What it also did was report success in the same breath.

The old rule was `ok: modeUnderstood && version !== null && (!strict || refusals === 0)` — in
lenient mode, `ok` answered *"was this the run you asked for"* rather than *"did it all arrive"*.
That is a statement about the call, not about the document, and no caller reads it that way. The
test that pinned it had to carry a paragraph explaining that `ok: true` does not mean ok, and named
the hazard exactly: *"a consumer reading only the first mounts nothing and believes it succeeded."*
A contract needing that footnote is the finding.

## Decision

**`ok` is false whenever any diagnostic carries `severity: "error"`, in either mode.**

    ok === !diagnostics.some((d) => d.severity === "error")

**`ok` is not a statement about usability.** A lenient parse still returns everything it could read;
`fields`, `acceptedCount` and `rejectedCount` are unchanged and still answer the finer question of
how much survived. What `ok: false` withdraws is only the claim that nothing was lost — which is
the claim that was false.

**Lenient stays the default.** Making the default strict was the other candidate and it moves more:
a strict parse of the same document returns *no fields at all*, so a beginner who has not yet
learned that modes exist gets an empty result instead of a form with a warning. With the flag honest
there is no longer a reason to take the fields away as well — lenient returns what it read, and now
says plainly that it did not read everything.

**Severity is not lowered to `warning` for this case.** A dropped `when` is not "worth knowing": it
is a declaration the author wrote and the form does not have. Calling that a warning would make
`warning` a second word for `error` and leave nothing to say about the diagnostics that really are
advisory.

## Consequences

A lenient caller that reads `ok` sees `false` for documents that previously reported `true`. That is
the point, and it is a behaviour change consumers will meet at run time rather than at compile time
— nothing in the type moved, so a build will not tell them. It is the reason this belongs in a major
release and not in a patch.

Strict-mode callers are unaffected: `ok` there already required zero refusals. `@modyra/studio`
parses in strict mode throughout, so the compiler and the live preview behave exactly as before.

A document with only advisory diagnostics still reports `ok: true`. The distinction between the two
severities is now the whole of what `ok` reads, which makes grading a diagnostic a heavier decision
than it was: anything graded an error now closes a gate somewhere.

## Alternatives rejected

**Lower the severity to `warning` when the document remains usable.** It keeps `ok` true and stops
the contradiction. But the document does not remain usable in the sense that matters — a condition
was declared and is gone — and it spends the one word that distinguishes "fix this" from "know
this".

**Make `strict` the default and leave `lenient` for those who ask.** Moves the defect to the person
who opted into permissiveness, which is the right place for it. Rejected because it also empties the
result: the beginner this protects gets nothing back and no form, where the honest flag gives them
both the form and the warning.

**Leave `ok` and document it better.** The prose already existed, in the test, and stated the hazard
precisely. It did not prevent the hazard, because the consumer who mounts on `ok` never read the
test.

The strongest evidence against this option is not an argument. It is a line of shipped code:

    // packages/angular/src/lib/dynamic/mdy-dynamic-form.component.ts
    return parsed.ok || this.parseMode() === "lenient" ? parsed.fields : [];

A consumer inside this repository had already worked around the flag, writing the correct answer
beside it rather than reading it — because in lenient mode `ok` did not answer the question that
code needed asked. It reached the same conclusion as this record, from the outside, without
anybody deciding it. A contract whose users route around it is not one that better prose fixes.

## Verification

Every reader of `ok` in the shipped packages was swept rather than assumed: three sites, all safe.
`@modyra/studio` parses strict in both of its; Angular's dynamic form defaults to strict and, in
lenient, never consulted the flag at all.

`packages/core/test/dynamic-diagnostics.test.mjs` asserts the property directly on a refused field.
The property was also exercised across three documents — a refused field, an unknown member carrying
semantics, and a clean one — and `ok === (errors === 0)` held in each.

What is **not** guarded: nothing asserts the property generically over every diagnostic the parser
can emit. There are 39 `severity: "error"` sites, and a future one that leaves `ok` true would have
to be caught by a test written for that diagnostic. A property test over the emitted set would close
this and does not exist.

## Security and privacy

None directly. The adjacent effect is a small improvement: a document arriving from a network or a
CMS whose declared conditions were dropped no longer reports success, so a field that was meant to
appear only under a condition can no longer be mounted unconditionally by a caller who checked the
flag. No data crosses a boundary and nothing is persisted.
