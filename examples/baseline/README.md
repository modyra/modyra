# What a beginner has to know

Three files, one per scenario, each carrying its specification in prose at the top. They exist to be
**measured**, not to be complete: the number they produce is *how much a person must learn to do this
thing today*, and the same prose is re-implemented after a simplification pass so the two numbers
describe the same task rather than two different files.

The rule that keeps the comparison honest: **the prose does not change.** If the after-version does
less, the number fell for the wrong reason.

Counted per file: **doors** (distinct `@modyra/*` import specifiers), **named symbols**, and
**concepts** — things a reader must understand before the file compiles, whether or not they are
imported: a returned shape they must destructure, an argument that must be passed separately, an
order that matters.

The starters under `examples/stackblitz*` are the measurement for scenario (a); they already exist
and are what a beginner is handed.
