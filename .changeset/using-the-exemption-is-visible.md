---
"@modyra/widgets": major
---

The class-rule exemption reports itself, and a field can say whether it can fail

**`MdyDomContractIssueCode` gains `EXEMPTION_ACTIVE`.** A consumer switching exhaustively over issue
codes must handle it.

Passing `adapterPrefix` to the DOM conformance kit suspends the rule that fails on classes the
contract does not declare. It did so silently, and a result that does not say a rule was suspended
reads exactly like one where the rule held — while the person who passes the option and the person
who later reads the green are not the same person. Five undeclared classes lived for months behind
this, in a repository whose conformance check fails on undeclared classes.

The option stays, because a renderer outside this repository may rely on it. What it no longer does
is stay quiet: either the class is reported as invented, or the exemption is reported as active.
There is no combination that reports nothing. An exemption that skips nothing still reports nothing —
otherwise every caller carries a permanent finding for a rule that never fired.

**`fieldCanBeInvalid` is exported**: whether a field can fail a rule, and so whether its error
container is reserved at rest. One predicate rather than three renderers each deciding.

The reservation is not for the field that is failing — it is for the field *below* it. Someone
leaving a field is moving toward the next one, and that is what drops when a message appears under
the field they just left. It does not stop every movement and must not be believed to: a two-line
message moves things anyway, and a validation arriving while focus is elsewhere defeats it. It closes
the frequent case, which is validate-on-blur.

Read from the field, never from its kind — an optional note with a length limit can fail a rule. And
it depends on the field's rules, never on its errors: the container stays reserved once a message
clears, because taking the space back is the same jump, upward, under the same thumb.

**No renderer reserves the container yet.** Doing so collides with a rule the renderers hold — the
control's description names the error list only when the list is rendered — and that collision needs
its own decision. The predicate lands first so the decision has one place to be applied.
