# Internal probes

The one place in this suite allowed to look past a package's public entry points, and the only
directory the black-box audit skips.

A probe belongs here when a public claim cannot be observed from outside at all — for example
counting live subscriptions to prove that destroy left nothing behind. Two rules make it safe:

1. **A probe is marked.** Its file says what it reaches into and why the public surface cannot answer.
2. **A probe is never the only evidence.** A public claim needs a public observation; a probe may
   explain a break or make one easier to localise, but a finding resting on a probe alone is a
   finding about the implementation, not about a promise.

An empty directory here is the healthy state.
