# ADR 0221: A server validator carries no message of its own

Status: Accepted

## Context

A Studio server validator declared an optional `errorMessage`, and the Studio inspector offered an
"Error message" input to fill it. No part of the system read it. The generated form calls the host's
implementation, and the messages a user sees are the ones that implementation returns. The project's
`serverErrorMapping` behavior names `message` as a field of the server's response. The live preview's
mock answers with its own refusal text, or with `forceError` when that is set. An author who typed a
message saw it saved, exported and shown back in the inspector, and never saw it on a field.

A field that nothing honors cannot stay that way. Three options were left: honor it only in the
preview, honor it everywhere, or remove it.

## Decision

`StudioServerValidator` has no message field, and the inspector offers no message input for a
server validator. The text of a server refusal belongs to the server: the host implementation in a
generated form, and the mock's configuration (`forceError`, or its default refusal) in the preview.

The deciding principle is the smallest public surface: removing the field adds nothing a consumer
must learn, and leaves 1.0 nothing to keep stable for it. A routing decision run through TypeSafe
returned the same answer (remove, 75%; preview only, 25%; everywhere, 0%).

## Consequences

- An author cannot write the refusal text for a server check in Studio. The server must supply it,
  as it already had to.
- Project documents saved with an `errorMessage` still load. The key is no longer part of the type,
  nothing reads it, and an edit through the inspector keeps it as an unknown property instead of
  stripping it. It is inert, not migrated.
- If design-time refusal text is wanted later, it comes back as a new decision with a reader on
  every path, not as a field waiting for one.

## Alternatives rejected

- **Preview only.** The mock would use `errorMessage` as its refusal text. The preview would then
  show a message that the generated form never shows, so the preview would promise behavior the
  product does not have.
- **Everywhere.** Code generation would replace the host's messages with the authored one. That
  overrides the server's own explanation, for example a coupon rejected for expiry would read as
  rejected for country. It would also need a second message path next to `serverErrorMapping`.

## Verification

`StudioServerValidator` has no `errorMessage` member, so TypeScript rejects any code that reads or
writes it (`npm run typecheck` in the studio packages). The studio-model, studio-ui and
studio-codegen tests build their fixtures without it. No test asserts that the inspector lacks the
input. A reintroduced input would also need the type member back, so it would fail the typecheck
first.

## Security and privacy

None. Refusal text was never transmitted or rendered from this field. Removing it changes no trust
boundary.
