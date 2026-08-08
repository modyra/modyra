---
"@modyra/angular": patch
---

The Angular peer range starts at 21.2.19.

`>=21.0.0` admits the patch releases carrying GHSA-jj27-h5hq-8x99 (i18n XSS in `@angular/core` and
`@angular/compiler`) and the `HttpTransferCache` cache-key ambiguity in `@angular/common`. The range
is what an installer resolves against, so a floor below the fix is an install that reproduces it.

Consumers on Angular 21.0–21.2.18 update Angular to 21.2.19 or later. The exported surface is
unchanged: `npm run contract:diff` classifies this patch.
