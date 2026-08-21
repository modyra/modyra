# modyra × Lit

Signup form plus control catalog built with the workspace `@modyra/lit`
adapter, served from this monorepo against the packages built from source.

Run it from the repository root:

```bash
pnpm install          # once
npm run demo:lit      # builds the packages, then serves → http://localhost:4303
```

What it shows:

- `createLitForm` + `<mdy-text-field>` custom elements (light DOM, so the
  theme stylesheet applies directly)
- Cross-field validation (`crossField`) — password confirmation
- `serverValidator()` — debounced, cancellable async username check
  (try `admin` or `root`)
- Draft persistence (reload mid-typing) and undo/redo history
- A simulated server-rejected submit (try `taken@example.com`)
- A control catalog form exercising every element `@modyra/lit/ui` ships
  (select, radio, segmented, multiselect, slider, datepicker, daterange,
  timepicker, colors, toggle, file…)
- Keyed collections (`record`) — a table rendered by column, with rows
  upserted, renamed and removed through handles
- A conditional section (`group({ when })`) — fields that are validated
  and submitted only while the account is a company
- The devtools panel — live engine state at the bottom of the page
- `enterprise.html` — nested orders/lines/allocations and
  invoices/lines/splits, three keyed levels deep

Documentation: [Lit example](../../docs/examples/lit.md) ·
[Modyra README](../../README.md)
