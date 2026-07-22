<!--
  GENERATED FILE — do not edit by hand.
  Run `node scripts/reactivity-capability-matrix.mjs` to regenerate.
  Source: each adapter's own `MdyReactivity.capabilities` (piano-modyra-reactivity-adapter-api.md §15).
-->

# Reactivity adapter capability matrix

Generated 2026-07-22.

| Adapter | effects | effectOwnership | signalEquality | computedEquality | batching | deterministicFlush | directObservation | writableComputed | graphInspection | serverSnapshots | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| vanilla | yes | yes | yes | no | yes | yes | yes | no | no | no | reference implementation |
| angular (no Injector) | no | no | yes | yes | no | no | no | no | no | no | effect-dependent features disabled; source-verified by reactivity-angular.spec.ts, not live-imported (see script comment) |
| angular (with Injector) | yes | yes | yes | yes | no | no | no | no | no | no | source-verified by reactivity-angular.spec.ts, not live-imported (see script comment) |
| vue | — | — | — | — | — | — | — | — | — | — | not yet migrated to declare capabilities (piano Milestones 2-5 continued) |
| solid | — | — | — | — | — | — | — | — | — | — | not yet migrated to declare capabilities (piano Milestones 2-5 continued) |
| preact | — | — | — | — | — | — | — | — | — | — | not yet migrated to declare capabilities (piano Milestones 2-5 continued) |
| svelte | — | — | — | — | — | — | — | — | — | — | not yet migrated to declare capabilities (piano Milestones 2-5 continued) |
| lit | — | — | — | — | — | — | — | — | — | — | not yet migrated to declare capabilities (piano Milestones 2-5 continued) |
| react | — | — | — | — | — | — | — | — | — | — | not yet migrated to declare capabilities (piano Milestones 2-5 continued) |

"—" means the adapter has no `capabilities` object yet (pre-Milestone-1 shape) or could not be constructed by this script — not the same as every capability being false.
