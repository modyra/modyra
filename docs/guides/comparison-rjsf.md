# Compared with RJSF

[RJSF](https://github.com/rjsf-team/react-jsonschema-form) (`react-jsonschema-form`) builds a React
form from a JSON Schema document, with a mature set of themes behind it. This page is here to help
you decide, and it says where RJSF is the better answer.

Snapshot date: 2026-08-22. Both projects move; re-read the sources before quoting this page.

## Where each one lives

RJSF is a **React renderer for JSON Schema**: you hand it a schema and it draws the form. Modyra is
an **engine with a contract**: the same document can drive the framework-free renderer, a framework
adapter, or no UI at all, and the engine underneath carries validation lifecycle, drafts and undo.

| Aspect | RJSF | Modyra |
| :--- | :--- | :--- |
| Framework | React only | Eight adapters; three render, five are headless; the engine needs no framework |
| Contract format | JSON Schema | Dynamic Form Contract — bounded, form-shaped, strictly parseable |
| Themes | Broad, mature theme ecosystem (Bootstrap, MUI, AntD, Chakra and more) | Shared CSS themes in `@modyra/styles`; younger and smaller |
| Validation | AJV over the schema | Engine validators, sync and async with cancellation, cross-field rules, server error mapping |
| Drafts and undo/redo | Not built in | Built into the engine |
| Headless use | Not the model | First-class: the engine runs in a worker, a test, or behind your own components |

## Choose RJSF if…

- You are React-only and want a working, themed form from an existing JSON Schema today.
- The theme ecosystem matters more than the lifecycle: RJSF's themes are the most battle-tested part
  of the schema-form world.

## Choose Modyra if…

- The form has to live somewhere React does not — another framework, or no framework.
- You need drafts, undo or cancellable async validation without assembling them yourself.
- The document comes from somewhere untrusted and must be strictly parsed before it renders —
  see [forms as data](./ai-generated-forms.md).

## See also

- [Bundle and feature comparison](./comparison-form-libraries.md) — the dated, measured table
- [Compared with react-hook-form](./comparison-react-hook-form.md) — for the React-only, code-first
  route
- [Migration guide](./migration.md)
