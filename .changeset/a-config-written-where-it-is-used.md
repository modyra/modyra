---
"@modyra/react": patch
"@modyra/preact": patch
"@modyra/widgets": minor
---

A widget hook given its configuration as a literal at the call settles. Each hook memoized its
controller on the configuration object's identity, so a new literal every render built a new
controller, which resubscribed, which set state, which rendered — React reported "Maximum update
depth exceeded" and kept going, and Preact did the same thing silently. The configuration is now
compared by what it says (`sameControllerOptions`, published from `@modyra/widgets`), and a handler
written at the call — a new function every render — is replaced by one stable function that calls
whatever the latest render passed, so the controller keeps the handler it was built with and that
handler is never stale. Memoizing the configuration still works and is still free.
