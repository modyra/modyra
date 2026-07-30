---
"@modyra/styles": patch
---

The foundation stops carrying a second copy of the palette

`modyra.css` spelled a literal into almost every `var()` it wrote:
`var(--mdy-sys-color-primary, var(--mdy-ref-color-indigo, #7067FF))`. **147 hex literals**, each a
copy of a value `modyra-base.css` already owned.

They existed for a real reason — base was a separate file a theme might not load, and an unresolved
`var()` drops the whole declaration it sits in, which is how the switch once rendered 0x0 and the
chips lost their border. The foundation imports the tier now, so that cannot happen, and what the
copies actually did was defeat the point of deriving a palette: **a literal cannot follow a chosen
colour.** A page that picked a green primary still got indigo out of the fallback, because the
fallback is a fixed hex and always was.

147 of them are gone; 2 remain, both `var(--mdy-on-surface-variant, #3f3f46)` on the short tier
rather than the `sys` one, left alone because that is a different rule and this batch is not it.
The file is 13KB smaller.

Verified inert rather than assumed: every `--mdy-*` token was read from a browser in all four
themes, before and after — **2016 readings, zero differences**, including `modyra-modern` which was
already whole.

`audit-styles-architecture.mjs` enforced the old invariant, that the foundation must never use a
`sys` or `comp` token without a fallback. That premise was deliberately replaced, so the rule is
replaced too: it now asserts the foundation **imports** the token tier, which is the thing that
actually prevents the dropped declarations the old rule was written for. Confirmed to still bite —
removing the import produces the defect.
