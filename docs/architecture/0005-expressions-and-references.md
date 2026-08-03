# ADR 0005: Expressions & references

Status: Accepted (P0)

## Context

Cross-field/form validators and server-validator `skipWhen` conditions need
conditional logic (plan section 6). Two failure modes to avoid: (1) baking
target-specific code (a JS arrow function, an Angular expression) into the
model, which breaks target-neutrality (R4); (2) allowing arbitrary
user-supplied code/`eval` in the canvas, which breaks R11.

## Decision

- Conditional logic is expressed as `StudioExpression` — a small, fixed,
  portable operator set: `equals`, `notEquals`, `isEmpty`, `isNotEmpty`,
  `lengthAtLeast`, `lengthAtMost`, `greaterThan`, `lessThan`, `matches`,
  `and`, `or`, `not` (plan section 6). Operands are `NodeRef | string |
  number | boolean | null` — never a code string, never a closure.
- Any reference to a node from an expression, a validator's `dependencies`,
  or a form rule's `errorTarget` is a `NodeRef { nodeId }` (ADR 0002) — ID
  only, never a path or a serialized accessor expression.
- Logic that cannot be expressed as a `StudioExpression` (a real server call,
  arbitrary business logic) is never inlined as code in the model. It is
  represented as `StudioImplementationRef` (`id`, `role`, `displayName`,
  `mode: "stub" | "reference"`, optional `targetOverrides`) — a symbolic
  pointer plus target-generated stub code the developer fills in outside
  Studio (R7).
- Studio never evaluates user code and never fetches a plugin/expression
  implementation remotely at runtime (R11). `StudioExpression` trees are
  interpreted by each target's own (trusted, shipped) evaluator/compiler —
  there is no `eval` anywhere in this path.
- Editor is target-neutral by construction here: nothing in
  `StudioExpression` or `StudioImplementationRef` mentions Angular, React, or
  Java (R4).

## Consequences

- The expression operator set is a closed, versioned vocabulary — adding an
  operator is a model change (ADR 0001) requiring every target's IR/writer
  (ADR 0004) and Contract mapping to be updated together, not something a
  target can extend unilaterally.
- Every `ImplementationRef` in `mode: "stub"` implies each target must be
  able to emit a compilable stub function signature for that role
  (`serverValidator`/`customValidator`/`submitAction`) — this becomes part of
  each target's conformance fixture (ADR 0004).
- Diagnostics must detect a `NodeRef` whose `nodeId` no longer exists
  ("broken reference", plan section 9) — expressions are exactly where such
  dangling references would surface.

## Rejection-test answers

- **Java addable without canvas model change?** Yes — `StudioExpression`
  and `StudioImplementationRef` are data, not code; a Java target evaluator
  interprets the same operator set/stub roles Core/Angular/React do.
- **Target loads lazily, no hardcoded UI import?** N/A — see ADR 0004.
- **Rename/move preserve all references?** Yes: in `../checkout-example.md`,
  `val_coupon_server.skipWhen.operand` and
  `val_items_min_one.condition.operands[0].operand` reference `nd_coupon`/
  `nd_items` by ID — renaming or moving those nodes changes derived paths
  only, per ADR 0002.
- **Same normalized project → byte-identical output?** Yes: expressions and
  implementation refs are plain data with no execution step in the model
  layer, so target evaluation of the same expression tree is deterministic.

## Satisfies

R3, R4, R7, R11.
