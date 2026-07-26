# Roadmap

Modyra is moving toward 1.0 by stabilizing the core API, improving reliability and validating integrations in applications outside the repository. The order below reflects current priorities, not release promises.

## Before 1.0

### API stability

- review construction, activation and disposal semantics
- define a deprecation policy for public packages
- stabilize error, diagnostic and server-validation result shapes
- audit package exports and generated declarations from installed tarballs

### Reliability

- expand lifecycle, cancellation and recovery tests
- add focused Firefox and WebKit smoke coverage
- test published packages in isolated consumer projects
- add property-based coverage for paths, patches and dynamic contracts
- keep bundle and performance budgets reproducible

### Framework integrations

- document SSR, UI and reactivity differences next to each adapter
- prioritize integration depth according to user adoption
- avoid adding framework adapters before the existing set is stable
- complete React Native integration only after a Metro and device-level test exists

### Studio

- stabilize the project format and migration policy
- improve generated-code diagnostics and recovery behavior
- extend worker, storage and import failure coverage
- keep generated targets deterministic and independently type-checked

### Documentation

- separate tutorials, conceptual guides and reference material
- reduce duplicated framework examples
- keep comparisons factual, dated and reproducible
- publish limitations beside the features they qualify

## Later

- framework-specific UI integrations where adoption justifies them
- framework devtools integrations
- additional locale presets
- additional SDKs for the Dynamic Form Contract
- visual regression testing

## Not planned before 1.0

- new framework adapters without demonstrated demand
- production-readiness claims that apply equally to every adapter
- enterprise features without a concrete use case

Completed work belongs in [CHANGELOG.md](CHANGELOG.md). Design decisions that need long-term context should be recorded as focused architecture notes rather than as roadmap history.
