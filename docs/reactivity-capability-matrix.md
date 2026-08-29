<!--
  GENERATED FILE — do not edit by hand.
  To regenerate: `npm run build:packages` (+ `npm run build:lib` for the Angular row), then `npm run docs:reactivity-matrix`.
  Source: each adapter's own `MdyReactivity.capabilities`; see docs/guides/reactivity-adapter-guide.md.
-->

# Reactivity adapter capability matrix

Generated 2026-08-28.

| Adapter | effects | effectOwnership | signalEquality | computedEquality | batching | deterministicFlush | directObservation | graphInspection | serverSnapshots | pureComputeds | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| vanilla | yes | yes | yes | no | yes | yes | yes | no | no | yes | reference implementation |
| angular (no Injector) | no | no | yes | yes | no | no | no | no | no | yes | effect-dependent features disabled; source-verified by reactivity-angular.spec.ts, not live-imported (see script comment) |
| angular (with Injector) | yes | yes | yes | yes | no | no | no | no | no | yes | source-verified by reactivity-angular.spec.ts, not live-imported (see script comment) |
| react | yes | yes | yes | no | yes | yes | yes | no | no | yes | = vanilla (no signal primitive of its own) |
| preact | yes | yes | yes | no | yes | yes | yes | no | no | yes | = vanilla (no signal primitive of its own) |
| svelte | yes | yes | yes | no | yes | yes | yes | no | no | yes | = vanilla (no signal primitive of its own); toStore() bridges to a Readable |
| lit | yes | yes | yes | no | yes | yes | yes | no | no | yes | = vanilla (no signal primitive of its own) |
| vue | yes | yes | yes | no | yes | yes | yes | no | no | no | native @vue/reactivity; effect() scheduler + createScope() via effectScope() (the current implementation) |
| solid | yes | yes | yes | yes | yes | yes | yes | no | no | no | native createSignal/createMemo/createEffect; equals comparator honored on both signal and memo (the current implementation) |

"—" means the adapter has no `capabilities` object yet (pre-Milestone-1 shape) or could not be constructed by this script — not the same as every capability being false.
