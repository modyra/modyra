# ADR 0002: IDs & paths

Status: Accepted (P0)

## Context

The canvas is a structural tree the user reorganizes constantly (move, rename,
nest). Validators, form rules, and server validators must keep referring to
"the same field" across those reorganizations. If identity were path-based
(e.g. `"shipping.city"`), every move/rename would silently break every
reference that points at it.

## Decision

- Every `NodeBase` (field/group/array) and every validator carries a stable,
  generator-assigned `id: string` that never changes for the lifetime of that
  node/validator (R2).
- Paths (e.g. `shipping.city`) are always *derived* from the current tree shape
  at read time — never stored as identity, never used inside a reference.
- `NodeRef { nodeId: string }` (plan section 5) is the only reference shape.
  References always store `nodeId`, never a path (R3).
- Moving or renaming a node changes its derived path only. Its `id`, and every
  `NodeRef` pointing at that `id` elsewhere in the project, are untouched.
- Array runtime row indexes (`items[0]`, `items[1]`) are presentation/runtime
  concerns only — they never become part of schema identity. The array's
  `item` (singular) defines the schema for every row; `initialRows` is data,
  not structure.
- Sibling names must be unique within a parent, and reserved names are
  rejected, so path derivation is always unambiguous (plan section 5 rules).

## Consequences

- ID generation, index maintenance (`nodeById`, `pathByNode`, `nodeByPath`,
  `referencesByTargetNode`), and validation of the uniqueness/reserved-name
  rules become P1 model responsibilities (`packages/studio-model`), not canvas
  or command-engine responsibilities.
- Any command that changes tree shape (move, rename, insert, delete) must be
  provable to preserve or correctly cascade `id`-based references — this is
  the P1/P2 gate ("move/rename preserve refs").
- Deleting a node must decide explicitly what happens to dangling references
  (diagnostic, not silent corruption) — tracked as a diagnostics requirement
  (plan section 9, "broken reference").

## Rejection-test answers

- **Java addable without canvas model change?** Yes — IDs and derived paths
  are language-neutral strings; a Java target reads `nodeId` references the
  same way Core/Angular/React do.
- **Target loads lazily, no hardcoded UI import?** N/A — see ADR 0004.
- **Rename/move preserve all references?** Yes by construction: see
  `../checkout-example.md`, where `val_coupon_server.dependencies` and
  `val_items_min_one.errorTarget` reference `nd_country`/`nd_items` by ID.
  Renaming `country` → `shippingCountry`, or moving `coupon` under a new
  group, changes only the derived path string used for display/codegen —
  every `nodeId` reference in the example stays valid unchanged.
- **Same normalized project → byte-identical output?** Supports it: since
  identity is ID-based and paths are derived deterministically from tree
  shape, two loads of the same JSON always derive the same paths.

## Satisfies

R2, R3, R8 (structural tree, no pixel positioning — paths come from tree
shape, not coordinates).
