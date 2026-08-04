---
"@modyra/widgets": minor
"@modyra/core": minor
"@modyra/lit": patch
---

A kind whose anatomy depends on its configuration declares it.

`multiselect` renders a choice two ways: in `single` mode an option is a `<button>` with a tick, in
`multi` it is a container holding a count between two step buttons. No single element declaration
fits both, so `option` was declared `presentation` and nothing checked it in either mode. That was
finding **J2**.

The catalogue now declares **variants**, keyed by the `mode` the field config already carries:

```ts
variants: {
  single: { elements: { option: "button"    }, required: ["optionCheck"] },
  multi:  { elements: { option: "container" }, required: ["optionStep", "optionCount"] },
}
```

In `single` the option *is* the control; in `multi` it contains them. Both named, which is what
[ADR 0014](https://github.com/modyra/modyra/blob/main/docs/architecture/0014-the-contract-names-the-responsible-element.md)
requires and what saying "one of these is operable" cannot give.

**Closed, and defined once.** `MdyWidgetVariant` is an alias of `MdyMultiselectMode` — newly named in
`@modyra/core`, the same union `mode` already used — so the variant key *is* the value a document
carries. An invented name is a compile error, with a runtime guard behind it for callers without
types.

**`container`** is a new semantic element: a part that holds controls and is not one. `presentation`
admits everything by design, so it could not refuse a `<button>` holding a `<button>`.

**`MdyWidgetShape` is generic over its parts.** `required: ["notAPart"]` no longer compiles — which
needed `NoInfer` on the shape parameter, because otherwise the shape is a second inference site and a
name appearing only there widens the part union to include it.

**For adapters:** declare which variants you support and the conformance kit mounts each. Declaring
none is checked exactly as before, so this is additive for the sixteen kinds that have no variants.
`contract-diff` now snapshots and compares variants, so declaring or withdrawing one is classified.

`@modyra/lit`'s counter steppers gain accessible names — they were icon-only buttons announcing
nothing, a defect the rule found the moment it existed.
