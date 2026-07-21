# modyra × Lit (StackBlitz)

Signup form + full control catalog built with the **published**
`@modyra/lit` package on Vite — no monorepo, no workspace, `npm install`
and go.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/modyra/modyra/tree/main/examples/stackblitz-lit)

Run it locally instead:

```bash
npm install
npm run dev   # vite → http://localhost:5173
```

What it shows:

- `createLitForm` + `<mdy-text-field>` custom elements (light DOM, so the
  theme stylesheet applies directly)
- Cross-field validation (`crossField`) — password confirmation
- `serverValidator()` — debounced, cancellable async username check
  (try `admin` or `root`)
- Draft persistence (reload mid-typing) and undo/redo history
- A simulated server-rejected submit (try `taken@example.com`)
- The devtools panel — live engine state at the bottom of the page
- A second "control catalog" form exercising every widget
  `@modyra/lit/ui` ships (select, radio, segmented, multiselect, slider,
  datepicker, daterange, timepicker, colors, toggle, file…)

Documentation: https://github.com/modyra/modyra#readme
