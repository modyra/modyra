---
"@modyra/widgets": patch
"@modyra/plain": patch
---

`@modyra/widgets` stops holding one adapter's material, and a test now keeps it that way.

`contract-baseline/` held `angular-ui.json` — a record of the Angular renderer's own surface, whose
metadata names `packages/angular/src/lib/{control,renderers}` as its source — and an `angular-dom/`
directory beside it. They sat in the framework-agnostic package's own baseline directory, next to
what the *catalogue* declares. Nothing imported them, so nothing complained: the import graph was
clean the whole time, which is exactly why this kind of inversion survives. They now live in
`packages/angular/contract-baseline/`, where the surface they describe is.

`widget-completeness.json` stays: it records this package's own anatomy.

`independence.spec.mjs` asserts both halves of the rule — no file in this package may be named after
a package derived from it, and no comment may cite one as the contract's reference. It found twelve
comments in the tests that an earlier sweep of `src/` had missed, all of the same shape ("modeled on
Angular's real component", "the answer Angular kept"). A contract that explains itself by naming one
of its consumers is describing the wrong thing.

Also fixes a real defect the equivalence work exposed: Plain's multiselect applied the projection's
`trigger` part wholesale to its search button, so the button carried `mdy-multiselect` — the
catalogue's class for `inputWrapper` — and one class named two elements. The button now takes the
part's semantics without its classes.
