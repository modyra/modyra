# modyra × React (StackBlitz)

Signup form built with the **published** `@modyra/react` package on Vite —
no monorepo, no workspace, `npm install` and go.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/modyra/modyra/tree/main/examples/stackblitz-react)

Run it locally instead:

```bash
npm install
npm run dev   # vite → http://localhost:5173
```

What it shows:

- `useMdyForm`/`useMdyField` — typed fields, schema validators
- Cross-field validation (`crossField`) — password confirmation
- `serverValidator()` — debounced, cancellable async username check
  (try `admin` or `root`)
- Draft persistence (reload mid-typing) and undo/redo history
- A simulated server-rejected submit (try `taken@example.com`)
- The devtools panel — live engine state at the bottom of the page

Documentation: https://github.com/modyra/modyra#readme
