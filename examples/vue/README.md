# modyra × Vue

Signup form built with the workspace `@modyra/vue` adapter, served from
this monorepo against the packages built from source.

Run it from the repository root:

```bash
pnpm install          # once
npm run demo:vue      # builds the packages, then serves → http://localhost:4302
```

What it shows:

- `createVueForm` — form state exposed as native Vue reactivity, read
  through plain `computed()` wrappers
- Cross-field validation (`crossField`) — password confirmation
- `serverValidator()` — debounced, cancellable async username check
  (try `admin` or `root`)
- Draft persistence (reload mid-typing) and undo/redo history
- A simulated server-rejected submit (try `taken@example.com`)
- Runtime theme switching across the packaged themes
- The devtools panel — live engine state at the bottom of the page

Documentation: [Vue example](../../docs/examples/vue.md) ·
[Modyra README](../../README.md)
