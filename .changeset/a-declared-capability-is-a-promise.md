---
"@modyra/core": minor
---

The conformance suite checks that a declared equality capability is actually honoured.

`capabilities.signalEquality` and `capabilities.computedEquality` are declared by every adapter and
were verified by nothing. The one check that mentioned them asserted they are **booleans** — not that
a `true` means anything. An adapter that accepts `options.equal` and drops it on the floor passed:
the shape is right, the types are right, and the option is silently ignored.

That is the "accepted but unhonoured option" the adapter contract was written to prevent, and the Vue
adapter's own source flags it as the risk it deliberately avoided. Nothing was checking.

Two capability-gated tests now do: a comparator that calls every value equal must suppress the write
and must notify nothing. Every adapter passes — the suite had simply never asked. Removing the
comparator from an adapter's `signal()` fails the new check and nothing else.

Solid also moves onto the conformance suite directly, with a harness whose scope owns the effects the
suite creates and is genuinely destroyed. That is 2 of 6 adapters off the compatibility shim.
