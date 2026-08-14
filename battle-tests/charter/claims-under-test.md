# Claims under test

The registry lives in [`../models/claims.mjs`](../models/claims.mjs) — this page is the prose half:
what each promise means, and what would count as breaking it.

Every battle cites at least one id. Citing an unregistered id is an error.

## Collections

| Id | Promise | A break looks like |
| --- | --- | --- |
| `COL-001` | Rendering never creates or removes a record row. | A claimed cell declares a key; an unmount removes one. |
| `COL-002` | Record identity is the domain key, not presentation order. | Sorting the presentation moves values between rows. |
| `COL-003` | Validity of declared rows is independent from mounted cells. | A form turns valid because the invalid cell was unmounted. |
| `COL-004` | Numeric record keys remain object keys. | `{"0": …}` becomes an array after a patch, draft or undo. |
| `COL-005` | Removing a row removes its value and settles descendant async work. | A removed row's validator answers, or its path is submitted. |
| `COL-006` | A waiting cell binds when its row arrives and waits again after removal. | The handle held before declaration is not the one the row arrives on. |
| `COL-007` | Rename preserves the state promised by the contract. | Value, validity, touched or a binding is lost across a rename. |
| `COL-008` | A row declared without a value is the row the template describes. | Cells come back `null` instead of the initial the schema declares. |

## Lifecycle and reactivity

| Id | Promise | A break looks like |
| --- | --- | --- |
| `LIF-001` | Destroy leaves no observable reactive or asynchronous work. | A timer, effect or validator run fires after destroy. |
| `LIF-002` | Repeated mount/unmount does not alter value or registration ownership. | Field registration counts drift across remounts. |
| `REA-001` | Every handle a form hands out is observed through its owning runtime. | A collection handle or row tree is unknown to the registry, so a foreign runtime is accepted in silence. |
| `REA-002` | Cross-runtime misuse produces the documented diagnostic. | The mismatch is silent, or the diagnostic names the wrong thing. |

## Validation and submission

| Id | Promise | A break looks like |
| --- | --- | --- |
| `VAL-001` | The latest applicable async validation result wins. | An older run's answer overwrites a newer one. |
| `VAL-002` | Disabled values are retained in edit state and excluded from submission. | A disabled value is submitted, or is lost from the model. |
| `VAL-003` | Hidden or unmounted controls do not alter validation semantics. | Validity depends on what is on screen. |
| `SUB-001` | Submission contains no undeclared path introduced by rendering. | A mounted control adds a path to the payload. |
| `SUB-002` | The shape of a form's value follows the schema, not the order controls mounted. | A row's cells come back in the order controls happened to bind them. |

## Contracts, persistence, security, packaging

| Id | Promise | A break looks like |
| --- | --- | --- |
| `DYN-001` | Typed and dynamic forms agree for the supported common subset. | The same operations produce different canonical states. |
| `DYN-002` | Collection kind survives flattening and reconstruction. | A record comes back as an array. |
| `PER-001` | Draft restore reconstructs declared structure without resurrecting removed rows. | A removed row returns after a restore. |
| `PER-002` | Undo and redo preserve the documented structural semantics. | Undo across a structural change loses or duplicates a row. |
| `SEC-001` | Unsafe path segments never register fields or pollute prototypes. | `__proto__` in a key, contract, patch or draft reaches the model. |
| `SEC-002` | A value the panel masks is not readable elsewhere in the same panel. | The value is bulleted and the error beside it quotes it. |
| `SSR-001` | A widget command that needs a DOM is not executed where there is none. | A server render is told to focus an element that does not exist. |
| `A11Y-001` | Partial and late rendering never leaves dangling ID references after settling. | `aria-controls` points at a removed element. |
| `LOC-001` | A localized date is read in the reader's own order, and an impossible one is refused. | `12/31/2026` becomes the 12th somewhere, or Feb 30 is accepted. |
| `A11Y-003` | A palette derived from any brand colour keeps its text above the contrast floor. | Some hue produces a chip whose label cannot be read. |
| `A11Y-002` | Focus is borrowed by a widget and handed back once. | A widget takes focus again after it has already returned it. |
| `PKG-001` | Packed consumers observe the same public behaviour as workspace tests. | The tarball behaves differently, or resolves two copies of a package. |
