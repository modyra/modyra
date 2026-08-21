# modyra × Svelte

Signup form built with the workspace `@modyra/svelte` adapter, served from
this monorepo against the packages built from source.

Run it from the repository root:

```bash
pnpm install          # once
npm run demo:svelte   # builds the packages, then serves → http://localhost:4306
```

What it shows:

- `createSvelteForm` + `toStore()` — field signals wrapped as Svelte
  `Readable` stores, subscribed in templates with the native `$store` syntax
- Cross-field validation (`crossField`) — password confirmation
- `serverValidator()` — debounced, cancellable async username check
  (try `admin` or `root`)
- Draft persistence (reload mid-typing) and undo/redo history
- A simulated server-rejected submit (try `taken@example.com`)
- Runtime theme switching across the packaged themes
- The devtools panel — live engine state at the bottom of the page

Documentation: [Svelte example](../../docs/examples/svelte.md) ·
[Modyra README](../../README.md)
