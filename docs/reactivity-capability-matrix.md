<!--
  GENERATED FILE — do not edit by hand.
  Run `node scripts/reactivity-capability-matrix.mjs` to regenerate.
  Source: each adapter's own `MdyReactivity.capabilities` (piano-modyra-reactivity-adapter-api.md §15).
-->

# Reactivity adapter capability matrix

Generated 2026-07-23.

| Adapter | effects | effectOwnership | signalEquality | computedEquality | batching | deterministicFlush | directObservation | writableComputed | graphInspection | serverSnapshots | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| vanilla | yes | yes | yes | no | yes | yes | yes | no | no | no | reference implementation |
| angular (no Injector) | no | no | yes | yes | no | no | no | no | no | no | effect-dependent features disabled; source-verified by reactivity-angular.spec.ts, not live-imported (see script comment) |
| angular (with Injector) | yes | yes | yes | yes | no | no | no | no | no | no | source-verified by reactivity-angular.spec.ts, not live-imported (see script comment) |
| react | yes | yes | yes | no | yes | yes | yes | no | no | no | = vanilla (no signal primitive of its own) |
| preact | yes | yes | yes | no | yes | yes | yes | no | no | no | = vanilla (no signal primitive of its own) |
| svelte | yes | yes | yes | no | yes | yes | yes | no | no | no | = vanilla (no signal primitive of its own); toStore() bridges to a Readable |
| lit | yes | yes | yes | no | yes | yes | yes | no | no | no | = vanilla (no signal primitive of its own) |
| vue | yes | yes | yes | no | yes | yes | yes | no | no | no | native @vue/reactivity; effect() scheduler + createScope() via effectScope() (Phase P2, 2026-07-23) |
| solid | yes | yes | yes | yes | yes | yes | yes | no | no | no | native createSignal/createMemo/createEffect; equals comparator honored on both signal and memo (Phase P3, 2026-07-23) |

"—" means the adapter has no `capabilities` object yet (pre-Milestone-1 shape) or could not be constructed by this script — not the same as every capability being false.
