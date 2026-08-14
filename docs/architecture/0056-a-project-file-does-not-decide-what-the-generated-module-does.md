# ADR 0056: A project file does not decide what the generated module does

Status: Accepted

## Context

`compileExpressionToJs` turns a Studio form validator's condition into a JavaScript expression that a
generated module carries. It is compile-to-source and never `eval` — which is the property the whole
codegen path is built on.

A literal operand was printed as `typeof operand === "string" ? printString(operand) : String(operand)`.
The string branch is right: a string becomes a properly escaped string literal, so
`"1; globalThis.taken = 1"` stays text. The other branch put whatever it was given into the emitted
expression **unquoted**, and `StudioOperand` describes a node reference, a string, a number, a
boolean, null or a nested expression — nothing constrains what a *file on disk* actually holds:

```js
// project.json → formValidators[0].condition.operands[1] = ["globalThis.taken = 1"]
value["a"] === globalThis.taken = 1
```

`String(["globalThis.taken = 1"])` is the array's own join. An assignment, in a module a consumer
compiles, decided by a project file. `["fetch('//elsewhere')"]` arrives the same way; an object gives
`[object Object]`, which is the same defect failing loudly.

Measured through the whole chain rather than the printer alone: **`loadProject` accepted the project
and reported zero diagnostics**, so nothing between the file and the generated code said a word.

Found by `battle-tests/adversarial/studio/`.

## Decision

**An operand is printed by its kind, and a value outside the type is refused rather than coerced.**
`compileOperand` prints a string as a string literal, a finite number and a boolean as themselves,
and raises for anything else — including `NaN` and `Infinity`, which have a number's type and are not
values a condition can hold. Guessing produces source nobody wrote.

**The project reports it where the project is read.** `loadProject` diagnoses
`BAD_CONDITION_OPERAND`, reported rather than thrown, like every other finding there: a project that
cannot be opened cannot be repaired in the editor that reports this.

Both, deliberately. They are different consumers — the editor holds a file someone can fix, and the
compiler is reached by targets and by tooling that never loads a project through the model. A refusal
at one end only is a refusal the other end's callers do not get.

## Consequences

A project carrying an operand outside the type now shows an error in the editor and fails a build
that compiles it, where it previously produced a module that compiled and did something nobody asked
for.

The four kinds a condition holds compile exactly as before. That is the boundary and it is pinned:
reaching further would rewrite conditions that were always correct.

The compiler's refusal is an exception rather than a diagnostic because it has no diagnostic channel
and its existing bound — `MAX_EXPRESSION_DEPTH` — already raises. Two refusal shapes in one function
would be worse than one shape used twice.

## Alternatives rejected

**Print with `JSON.stringify` instead of `String`.** Every value becomes *something* and the generated
module compiles, so an array operand silently becomes an array literal and a condition means
something the author never wrote. Making bad input compile is what produced this.

**Refuse in the compiler only.** Its callers are targets and tooling; the person who can fix the file
is looking at the editor, which would say nothing.

**Refuse in `loadProject` only.** Every target reaches the compiler directly, and a project can be
assembled in memory by a tool that never calls `loadProject`.

**Widen `StudioOperand` to accept arrays.** It would need a meaning — a set for `in`, a tuple for
`between` — and neither is a thing the expression vocabulary has. Inventing one to make a defect
legal is the wrong direction.

## Verification

- `packages/studio-codegen/test/expression-compiler.test.mjs` — an array, an object, a function, a
  symbol, `NaN` and `Infinity` are refused; the four legal kinds compile byte for byte as before.
- `packages/studio-model/test/model.test.mjs` — the project reports `BAD_CONDITION_OPERAND`, and
  every legal operand is accepted in silence.
- `battle-tests/adversarial/studio/` — the attack that found it, driving file → `loadProject` →
  generated module.

## Security and privacy

This is the injection boundary of the code generator. A project file is data — it arrives from a
repository, a template, an export, a colleague — and it decided the *source* of a module a consumer
compiles and ships. What an attacker gained was arbitrary code in someone else's build output, with
no `eval` anywhere and nothing in the pipeline objecting.

The fix closes the coercion that carried it, at both ends. It does not make project files trusted:
the guarantee is that an operand either is one of the kinds the vocabulary describes, or it does not
reach the printer.
