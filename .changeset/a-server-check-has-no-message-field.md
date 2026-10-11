---
"@modyra/studio-model": minor
"@modyra/studio-ui": minor
---

A server validator no longer declares an error message

`StudioServerValidator.errorMessage` and the inspector's "Error message" input are removed. Nothing
read the field: the generated form shows the messages the host implementation returns, and the
preview shows the mock's refusal text. See ADR 0221.

**Migration.** Delete `errorMessage` from server validators in code that builds Studio projects.
Saved project documents that still carry it load unchanged, and the key is ignored.

`npm run contract:diff` classifies this as `patch` because it covers only the widget contract. Removing
a member from an exported Studio type breaks code that sets it, so this is released as `minor`
(breaking under 0.x).
