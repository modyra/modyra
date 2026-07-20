# modyra × StackBlitz

Minimal Angular signup form built with the **published** `@modyra/angular`
package — no workspace, no build steps beyond `npm install`.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/modyra/modyra/tree/main/examples/stackblitz)

Run it locally instead:

```bash
npm install
npm start   # ng serve → http://localhost:4200
```

What it shows (declarative mode):

- `mdy-form` with text, select and checkbox controls
- `mdyRequired` / `mdyEmail` / `mdyMinLength` validators with inline errors
- `form.state.canSubmit()` / `form.state.submitting()` driving the submit button
- the `(submitted)` event carrying the typed form value

Documentation: https://github.com/modyra/modyra#readme
