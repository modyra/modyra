# ADR 0060: A refusal reaches somebody

Status: Accepted

## Context

A submit action returns errors to refuse. Its argument is whatever an application derived from a
server's answer — `any` at the boundary in practice, since the response is parsed JSON — so every
shape a response takes arrives at one line of engine code. Measured, on a form with one field:

| what the action returned | what a person saw |
| --- | --- |
| `[{ path: "a", message: "Already registered" }]` | the message |
| `[{ path: null, message }]` | the message, at form level |
| `[{ message }]` — no path at all | **nothing** |
| `[{ path: "", message }]` | **nothing** |
| `["Already registered"]` | **nothing** |
| `{ errors: [...] }` | `errors.filter is not a function` |
| `[{ path: "a", message: <the response object> }]` | `[object Object]` |

The three silent rows are the ones that matter. `{ message }` is what a server writes far more often
than `{ path: null, message }`; `path: ""` is the explicit spelling of "this is about the form"; and a
bare string is what an application has after pulling messages out of a response. Each was dropped by
the same guard that drops a hostile path — `isSafeFieldPath` refuses an empty string and refuses
`undefined` — so a refusal was discarded as if it were an attack.

What that costs is not a missing message. It is a person who pressed Send while the server said no,
saw nothing, and had every reason to believe it went through.

## Decision

**A refusal reaches somebody.** Every shape the engine cannot attribute to a field becomes a
form-level error rather than nothing:

- a path that is absent, `null` or `""` means the form;
- a bare string is a message about the form;
- a return that is not a list becomes one form-level error, and the development channel says what was
  returned and what the contract is;
- a message that is not a string is replaced by one that is, and what it held is kept on `payload`,
  where an application can read it. `[object Object]` is not something to show anyone.

**A path is still untrusted.** An unsafe path — `__proto__` and its family — is dropped and reported
as a security violation. It is the one case where losing the message is the lesser harm, because the
alternative is attributing an attacker's text to a field of their choosing.

**A submit whose answer could not be read is not a successful submit.** It records an error, so the
draft is not cleared and the form does not present itself as done.

## Consequences

An application returning a shape that used to vanish now shows a message. Where that shape was a bug
nobody had noticed, a message appears in a place that was previously empty — which is the point, and
is a visible change.

The engine now invents one sentence, `"The submitted answer could not be read."`, shown when the
answer carried no readable message. It is developer-facing wording on a user-facing surface, which is
the same trade the thrown-error path has always made by surfacing `e.message`. A product that wants
its own words has `lastSubmitErrors` and can render its own.

Reading a bare string as a form-level message is generous: an application that meant it as a field
path gets a form-level message instead of nothing, and no way to tell the engine otherwise. The
alternative is refusing it, which returns to silence.

A form-level error still needs somewhere to be rendered. `@modyra/plain` has no surface for one, so
on that renderer these messages reach `lastSubmitErrors` and no further; that is a renderer gap, and
this decision is what makes it worth closing.

## Alternatives rejected

**Refuse the wrong shapes at the call, as the setters do** ([ADR 0057](0057-an-argument-is-refused-where-it-arrives.md)).
A setter's argument is written by the caller; this one is derived from a server, and throwing inside
`submit` would replace a silent failure with a crash on a path a network already failed on.

**Keep dropping and warn under `MDY_DEV`.** The warning is stripped in production, which is where
the person pressing Send is.

**Type the boundary harder.** `MdyFormError[]` is already the declared return type, and the shapes
above all pass through `any` from a parsed response. A type that is not enforced at runtime is not a
guard at this boundary.

## Verification

- `battle-tests/adversarial/security/what-the-server-refused.battle.test.mjs` — every spelling of a
  path, with the three that already worked as controls.
- `battle-tests/adversarial/submission/submit-contract.battle.test.mjs` — a wrong-shaped return is
  reported in words a consumer can act on.
- `battle-tests/browser/what-the-server-said-on-the-page.spec.ts` — the same shapes as rendered.

## Security and privacy

A submit response is untrusted input and this decision widens what the engine keeps from it. The path
guard is unchanged: an unsafe path is still dropped and still reported as `error-path`, so no
server-chosen string can address a field it should not. What is newly kept is a *message*, which was
already displayed for the shapes that worked — the engine does not interpret it, and a non-string
message is replaced rather than rendered, which closes the `[object Object]` route by which a whole
response object reached a page.
