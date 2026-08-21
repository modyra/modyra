# modyra × Preact

Signup form built with the workspace `@modyra/preact` adapter, served from
this monorepo against the packages built from source.

Run it from the repository root:

```bash
pnpm install          # once
npm run demo:preact   # builds the packages, then serves → http://localhost:4304
```

What it shows:

- `useMdyForm`/`useMdyField` — typed fields, schema validators
- Cross-field validation (`crossField`) — password confirmation
- `serverValidator()` — debounced, cancellable async username check
  (try `admin` or `root`)
- Draft persistence (reload mid-typing) and undo/redo history
- A simulated server-rejected submit (try `taken@example.com`)
- Runtime theme switching across the packaged themes
- The devtools panel — live engine state at the bottom of the page

Documentation: [Preact example](../../docs/examples/preact.md) ·
[Modyra README](../../README.md)
