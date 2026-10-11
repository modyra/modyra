# ADR 0217: A project id cannot leave its quotes

Status: Accepted. Amended 2026-10-11 — "where the door is, and what stays outside it", below.

## Context

Studio's editor builds its interface as HTML text. Every identifier a project carries is written
into it: node ids, validator ids, implementation keys and the references between them. They go
into quoted attributes such as `data-node="…"` and into CSS selectors such as `[data-plain-select="…"]`.
That happens at about seventy places in `studio-ui`, and almost none of them escape.

A project is a file anyone may hand to Studio, by import or as a restored session. The loader
checked that each id was a non-empty string and nothing more. An id holding `">` followed by markup
left the attribute it was written into, and that markup ran when the project was opened.

## Decision

Identifiers are constrained at the door. `loadProject` refuses a project in which any identifier,
reference or implementation key falls outside `[A-Za-z0-9_.:-]`, or is longer than 128 characters.
The refusal names the path. An identifier is any string under a key named `id` or ending in `Id` or
`Ref`, plus the keys of `implementations`.

Every way a project enters Studio passes through `loadProject`: import, and the session restore
in `packages/studio-ui/src/storage.ts`. Ids Studio makes itself come from `createId` (`prefix_` and twelve
lowercase letters and digits), which the rule admits.

## Consequences

- No identifier that reaches the editor can contain a quote, an angle bracket, an ampersand, a
  backslash, a backtick or whitespace. That holds for every current interpolation and for any future
  template that forgets to escape.
- A hand-written or older project whose ids use other characters does not open. The error names the
  first offending path, so it can be fixed by editing the file.
- Text an author writes, such as labels, messages and display names, is not an identifier. It is
  still escaped at each interpolation, as before.

## Alternatives rejected

- **Escape every interpolation.** That means about seventy sites, which reach both HTML attributes and
  CSS selectors, so each site would need the right escape for its context. The guarantee would also
  last only until the next template. It remains good practice; it is not the guarantee.
- **Rewrite unsafe ids on load.** References elsewhere in the project, and in code generated from it,
  would silently stop matching. A refusal that names the path is recoverable; a rename is not
  visible.
- **Build the UI with DOM APIs instead of HTML text.** That is the structural fix. It is a rewrite of a
  4,000-line module, outside the scope of a security repair.

## Amendment, 2026-10-11: where the door is, and what stays outside it

The guarantee belongs to `loadProject`, not to the project type. `normalize` from
`@modyra/studio-model` and `compileToContract` from `@modyra/studio-contract` are exported and do not
re-check identifiers: they take a project that has already been loaded. Code that builds or receives a
project by any other route and hands it to either of them has not passed the door, and must call
`loadProject` first if that project is untrusted.

A node's `name` is not an identifier under this rule, although it is the field closest to one. It
holds dotted paths, and it is author text: today it reaches the editor through DOM APIs or through
`escapeHtml` in markup, and generated code through printers that quote it. A template that writes `name` into HTML text unescaped
would reopen the path this record closes, and nothing here would catch it.

## Verification

`packages/studio-model/test/an-id-that-cannot-leave-its-quotes.test.mjs` checks three hostile
identifiers: a node id, a validator id and an implementation key. Each is refused. An id with
ordinary separators opens. Removing the `assertSafeIdentifiers` call turns the three refusals red.

## Security and privacy

This closes a stored cross-site scripting path. A crafted project file ran script in the Studio page
on open, with access to everything the page holds, including the session's saved projects. The
residual risk is the rest of `studio-ui`'s HTML-text construction: text fields are escaped site by
site, and a missed escape there is not covered by this rule. That includes a node's `name`, and any
project passed to `normalize` or `compileToContract` without first going through `loadProject`. No
data handling changes.
