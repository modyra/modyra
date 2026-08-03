# ADR 0003: Command engine

Status: Accepted (P0)

## Context

The canvas needs undo/redo, a keyboard-only equivalent for every pointer
drag action (R9), and predictable diagnostics after every edit. Ad hoc
in-place mutation of `MdyStudioProject` makes all three hard: undo requires
hand-written inverse logic per call site, and keyboard parity requires every
pointer gesture to already be expressible as a discrete, describable action.

## Decision

- Every project mutation — `insert`, `move`, `delete`, `duplicate`,
  `updateNode`, add/remove/reorder/update-validator, `updateBehavior` (plan
  section 7) — is a Command object, not a direct mutation.
- A Command must provide: `validate` (can this apply to this project right
  now), a pure `apply` (returns a new project, never mutates the input),
  `inverse` (a Command that undoes it), `description` (for history UI/live
  region announcements), and `affectedIds` (for incremental
  diagnostics/index updates).
- Indexes (`nodeById`, `parentById`, `childrenByParent`, `pathByNode`,
  `nodeByPath`, `referencesByTargetNode`, `validatorsByDependency`) are
  derived data maintained by the command engine, never edited directly.
- Drop/placement validity (cycle, wrong parent/child kind, max depth,
  duplicate sibling name, second array item, reserved name, malformed
  command) is rejected by `validate` before `apply` runs. Target
  incompatibility is a diagnostic (ADR emitted later, plan section 9), not a
  canonical-model drop rejection — the model stays target-neutral (R4).
- Because every action is a Command, keyboard interaction (Space
  pickup/Arrows move/Right-in/Left-out/Enter-drop/Escape-cancel) drives the
  exact same Commands that pointer drag drives — keyboard parity is
  structural, not a parallel feature (R9).
- Required test shape (plan section 7): for every command,
  `apply(command)` then `apply(inverse)` reproduces the original project.

## Consequences

- P2 (Commands phase) implements this contract for all listed command kinds
  plus a history stack; P3/P4 (pointer/keyboard canvas) become thin UI layers
  that only ever dispatch Commands — no direct model mutation from UI code.
- Property-based apply+inverse tests become the primary correctness gate for
  P2, ahead of any UI existing.
- A command that can't state a correct `inverse` (e.g. lossy deletes) must
  carry enough affected data in the command payload to invert exactly — this
  is a P2 design constraint, not deferred to later.

## Verification

- `packages/studio-editor/test/commands.test.mjs` — each command's `apply` is pure, its `inverse`
  restores the prior project, and invalid placements are refused by `validate` before `apply` runs.
- `npm run test:studio` — undo/redo across grouped mutations, and index consistency after each.

## Security and privacy

`validate` is a trust boundary for the editor's own inputs: cycles, wrong parent/child kinds, depth
limits, duplicate sibling names and reserved names are rejected before any mutation. The depth cap
mirrors the schema parser's own guard against hostile input — an unbounded nesting is a stack
exhaustion in every consumer that walks the tree.

## Rejection-test answers

- **Java addable without canvas model change?** Yes — commands operate on
  `MdyStudioProject`/IDs only; no command references a target.
- **Target loads lazily, no hardcoded UI import?** N/A — see ADR 0004.
- **Rename/move preserve all references?** Yes: `move`/`updateNode`
  (rename) commands change tree shape/`name`, never `id`; per ADR 0002 every
  `NodeRef` elsewhere keeps resolving. E.g. in `../checkout-example.md`, a
  `move` command relocating `nd_coupon` produces `affectedIds: ["nd_coupon"]`
  only — `val_coupon_server.dependencies` (pointing at `nd_country`) is
  outside the affected set and stays valid.
- **Same normalized project → byte-identical output?** Supports it: `apply`
  is pure and deterministic given the same command + project, so replaying
  the same command sequence always reaches the same project state.

## Satisfies

R2 (via ADR 0002), R4, R8, R9.
