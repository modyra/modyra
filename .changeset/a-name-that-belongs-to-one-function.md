---
"@modyra/react": minor
"@modyra/preact": minor
---

The text-field widget hook is `useMdyTextField` — the name `useMdyField` belongs to one function

Both packages shipped two functions under one identifier: `src/index.ts` declares
`useMdyField(handle)`, the field-state hook, and `src/widgets/index.ts` exported
`useMdyField(handle, options)`, the headless text-field controller hook. An `export *` yields to a
local declaration silently, so the widget hook compiled and shipped but could never be imported from
the package root — what arrived was the field-state hook, and nothing in a build objected.

The widget hook now goes by the name its family already uses — `useMdyTextField`, beside
`useMdyBooleanField`, `useMdyOptionField` and the rest, wrapping `createTextFieldController` — with
`UseMdyTextFieldOptions` and `MdyReactTextFieldApi` / `MdyPreactTextFieldApi`. The field-state hook
keeps `useMdyField`, so every documented call (`useMdyField(form.f.email)`) is untouched.

Breaking only for the three type names, which were reachable where the function was not; both
packages are pre-1.0, so this lands as a minor. See ADR 0085.
