---
"@modyra/widgets": minor
---

`MDY_FIELD_STATE_CLASSES` names the classes that are really on screen.

It declared `mdy-field--invalid`, `mdy-control--open` and eight more like them. **No theme styled a
single one, and no renderer emitted them** — one renderer's source already carried a comment saying
so and quietly emitting `mdy-renderer--touched` instead. A renderer built from the contract alone
would have produced classes nothing paints, which is the one failure mode a shared class vocabulary
exists to prevent.

Measured and corrected to what three renderers emit and three or four themes style:

| declared before | styled by | now |
| --- | --- | --- |
| `mdy-field` + 7 states | 0 themes | `mdy-renderer` + `touched`, `open` |
| `mdy-control` + 3 states | 0 themes | `mdy-input-wrapper` + `disabled`, `error` |
| — | 3 themes | `mdy-label` + `filled`, `has-error` — added, it was never declared |

Four projections built the dead names, two of them as hand-written literals. The select's trigger
also carried `mdy-control--open`, `--disabled` and `--invalid` alongside its own
`mdy-select__trigger--*` modifiers; none of the six is styled, and only the trigger's own are
declared, so the twins are gone.

**Breaking.** A theme or renderer selecting on `mdy-field--*` or `mdy-control--*` matched nothing
before and matches nothing now, but the contract no longer tells anyone to emit them. Read the state
from `mdy-renderer--touched`, `mdy-input-wrapper--error` and `mdy-label--has-error`. A boolean's
checked state has no class at all: the themes style `:checked` on the input, which is where it lives.
