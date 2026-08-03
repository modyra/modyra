# ADR 0009: Client validation is defence in depth

Status: Accepted

## Context

Modyra is a validation engine that runs in the user's browser. Everything it enforces — required
fields, patterns, cross-field rules, option whitelists — runs on a machine the user controls, against
values the user supplies, in code the user can modify.

A form library that does not say this plainly invites the wrong inference. Rich client validation
looks like enforcement, and a team that has watched it reject bad input reasonably concludes the bad
input cannot arrive. It can: the network call is the interface, and the form is a convenience in
front of it.

The engine also persists in-progress work. Drafts default to `localStorage`, which is origin-wide,
plain text, readable by any script on the origin, and outliving a logout.

## Decision

**Client-side validation is a user-experience feature and a defence-in-depth layer. It is never the
authority.** Every value a form submits must be validated again by the server. This is stated in the
public documentation next to the validation capabilities, not in a footnote.

Concretely:

- **The option whitelist is enforced anyway.** A `select`'s declared options become a real `oneOf`
  validator, so a value from a scripted `set()`, a tampered draft, or a hallucinated document fails
  validation rather than flowing through. Not because it stops an attacker — it does not — but
  because it stops a *bug* silently producing an out-of-range value.
- **Every kind guards its own value shape.** A restored draft or a scripted write that is not the
  shape the kind holds is invalid.
- **Drafts are a hostile-input boundary in both directions.** Versioned envelopes with a TTL;
  `File`, `Blob` and `BigInt` refused; prototype-polluting keys rejected; quota errors never crash
  the form.
- **Draft persistence is opt-in per field, and its risks are documented where it is configured.**
  Sensitive fields must be excluded or a custom storage supplied. The default is `localStorage` and
  the default is stated, rather than being a surprise discovered in an audit.
- **Sensitivity is declarable, not guessed.** A field may say `sensitive: true`; the devtools panel's
  name-based guess is a fallback, and it is wrong in both directions — `notes` can hold a recovery
  phrase and `cardStyle` is masked for containing "card".
- **No document content is ever executed.** See [ADR 0007](0007-expressions-are-data.md).

## Consequences

- Comparison and marketing material may not claim validation as a security control. Principle 3 of
  the product principles — state limits beside features — is load-bearing here.
- Some duplication is accepted and expected: the same rule exists client-side for the user and
  server-side for the truth. The Dynamic Form Contract makes that duplication a *shared document*
  rather than two hand-written copies, which is the mitigation available; it does not remove the
  server's obligation.
- Draft persistence carries an ongoing documentation burden, because the safe default is not the
  convenient one.

## Alternatives rejected

- **Silence.** Letting users infer the trust boundary. The inference is predictable and wrong.
- **Refusing to persist drafts by default.** Would push every consumer into hand-rolled persistence,
  which is where the real leaks are. A documented default with per-field exclusion is safer than a
  vacuum.
- **Encrypting drafts in `localStorage`.** The key would sit next to the data on the same origin.
  Security theatre; it would weaken the warning by appearing to answer it.

## Verification

- `docs/guides/security.md` and `docs/project-background.md` state the boundary; `npm run test:docs`
  keeps them reachable and their links live.
- `packages/core/test/` covers draft envelope versioning, TTL, refused value types, prototype-key
  rejection, and quota-error tolerance.
- Option whitelists and per-kind shape guards are exercised by the dynamic-config suites — a value
  outside the declared set is invalid.

**Not verifiable here, by construction**: that a given consumer's server revalidates. This ADR is the
statement of the obligation; nothing in this repository can enforce it.

## Security and privacy

This ADR *is* the trust boundary. Everything Modyra validates is advisory with respect to an attacker
and authoritative only with respect to a cooperating user. Drafts are the standing privacy exposure:
plain text, origin-wide, surviving logout unless excluded.
