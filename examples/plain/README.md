# modyra × Plain

Full-catalog demo for the framework-free `@modyra/plain` renderer, served
from this monorepo against the packages built from source.

Run it from the repository root:

```bash
pnpm install          # once
npm run demo:plain    # builds the packages, then serves → http://localhost:4307
```

What it shows:

- `mountMdyForm`/`renderField` — 18 fields across 17 widget kinds, with a
  section/columns layout
- Every packaged theme, switched at runtime
- Palette engines: live `data-mdy-palette` models and a theme compiled
  from the brand colour seed, with light/dark/auto mode
- A live conformance banner — the rendered DOM checked against the widget
  contract from `@modyra/widgets` on every change
- Keyed collections (`record`) — a table rendered by column, with rows
  upserted, renamed and removed through handles
- A conditional section (`group({ when })`) — fields that are validated
  and submitted only while the account is a company
- `lab.html` — a laboratory where each panel drives one part of the engine
  (states, validation, collections, orders, invoices, contracts, security…)

Documentation: [Plain example](../../docs/examples/plain.md) ·
[Modyra README](../../README.md)
