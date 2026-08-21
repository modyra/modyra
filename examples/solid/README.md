# modyra × Solid

Signup form built with the workspace `@modyra/solid` adapter, served from
this monorepo against the packages built from source.

Run it from the repository root:

```bash
pnpm install          # once
npm run demo:solid    # builds the packages, then serves → http://localhost:4305
```

What it shows:

- `createSolidForm` — field handles read directly as accessors in JSX,
  with Solid's fine-grained updates instead of a per-field hook
- Cross-field validation (`crossField`) — password confirmation
- `serverValidator()` — debounced, cancellable async username check
  (try `admin` or `root`)
- Draft persistence (reload mid-typing) and undo/redo history
- A simulated server-rejected submit (try `taken@example.com`)
- Runtime theme switching across the packaged themes
- The devtools panel — live engine state at the bottom of the page

Documentation: [Solid example](../../docs/examples/solid.md) ·
[Modyra README](../../README.md)
