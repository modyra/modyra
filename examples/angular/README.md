# modyra × Angular

Sectioned demo app for the `@modyra/angular` package, built and served by
the Angular CLI from this monorepo.

Run it from the repository root:

```bash
pnpm install           # once
npm run demo:angular   # builds @modyra/angular, then ng serve → http://localhost:4200
```

What it shows, one section per feature (see `src/app/sections/`):

- Contact form — typed fields and validators through the Angular adapter
- Typed form and Zod form — schema-defined forms, with `@modyra/zod`
- CVA interop — a Modyra field behind a `ControlValueAccessor`
- Dynamic form — rendering a form from the Dynamic Form Contract
- Enterprise select, time granularity — specialised controls
- Keyed rows — collections keyed by data, rendered as a table
- Orders and invoices — nested records three levels deep
- Conditional section — fields in play only under a condition
- Contracts and design system sections — contract rendering and theming

Documentation: [Angular example](../../docs/examples/angular.md) ·
[Modyra README](../../README.md)
