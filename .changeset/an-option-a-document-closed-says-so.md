---
"@modyra/widgets": minor
"@modyra/styles": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

An option a document closed says so before it is pressed.

The press was already refused — the form kept `null` — but three of six renderer-and-kind pairs drew
the unavailable option exactly like an available one: no `aria-disabled`, no distinguishing class,
nothing a person could see or hear before pressing it. Someone who cannot see the list read that as a
broken control; someone who could read it as their own misclick.

- `select.option` and `multiselect.option` declare the `disabled` state (`contract:diff`: **minor**).
- The select projection emits `aria-disabled` and the state class per option, which `@modyra/plain`
  applies with the rest of the part.
- `@modyra/lit` and `@modyra/angular` apply the multiselect's projected option part whole, instead of
  reading its id and rebuilding the classes beside it — which is what left the disabled half off.
- `@modyra/styles` paints both: `.mdy-select__option--disabled`, and `.mdy-chip--disabled` beside the
  existing `:disabled` rule, because an option chip in counter mode is a `div` and cannot carry the
  native attribute.

**Migration for a renderer implementing this contract**: apply the projected option part rather than
composing option classes locally, or the state will be declared and never drawn.
