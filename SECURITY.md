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
- **Injection prevention** (`security:` option, since 0.2): field values
  can be sanitized at the engine's single write choke point — user input,
  `patch`/`setValue`, draft restore and array operations are all covered.
  Two built-in zero-dependency profiles (`"text"` strips control/bidi/
  zero-width characters, `"strict"` also strips markup characters), a
  custom-function escape hatch (plug DOMPurify or any allow-list), string
  length caps, and a violation telemetry hook. Always-on and not
  configurable: restored draft entries are shape-checked against the
  declared field type, and server errors with prototype-polluting paths
  are dropped. See `docs/guides/security.md`.
- **Option whitelisting** (`oneOf`/`eachOneOf` validators, automatic for
  option-based dynamic fields): a select offering "one"/"two" rejects a
  scripted `set("three")` client-side. Client checks are defense-in-depth
  only — the server must re-validate; the engine runs in Node so one
  schema can drive the form and gate the API (isomorphic pattern in
  `docs/guides/security.md`).
- **Runtime dependencies** are minimal by policy: `tslib` only; `zod` and
  `@angular/forms` are optional peers scoped to their entry points.
  Dependency audits run via `pnpm audit` (production audit must be clean
  at release).
