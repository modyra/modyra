# Security Policy

## Supported versions

Security fixes land on the latest minor of the current major.

## Reporting a vulnerability

Please **do not open a public issue** for suspected vulnerabilities.
Report privately via GitHub Security Advisories on this repository
("Report a vulnerability"). You will get an acknowledgment within 7 days.
Coordinated disclosure: we ask for 90 days or a released fix, whichever
comes first.

## Security-relevant design notes

- **Form values are treated as sensitive data.** The library never logs
  values, never sends them anywhere, and serializes `File`s as metadata
  only (name/size — never contents).
- **Draft persistence** (`draft:` option) writes to `localStorage` by
  default: plain text, origin-wide, survives logout. Use
  `draft.exclude` for passwords/tokens/card numbers, `ttlMs` for expiry,
  or a custom `MdyDraftStorage` for anything stricter. This is documented
  prominently in the typed-forms guide.
- **DevTools** mask values of sensitive-looking field paths
  (password/token/secret/card/cvv/ssn/iban) plus any path in
  `[maskFields]`; `[excludeFields]` hides fields entirely; file contents
  are never displayed. The devtools are only present in bundles whose code
  imports them — verified by `npm run test:bundle`.
- **No HTML rendering of external strings**: labels, options, dynamic-form
  config strings and error messages are rendered via Angular text
  interpolation (auto-escaped), never `innerHTML`. Dynamic form configs
  from the network should still be validated with `parseDynamicFields()`.
- **Runtime dependencies** are minimal by policy: `tslib` only; `zod` and
  `@angular/forms` are optional peers scoped to their entry points.
  Dependency audits run via `pnpm audit` (production audit must be clean
  at release).
