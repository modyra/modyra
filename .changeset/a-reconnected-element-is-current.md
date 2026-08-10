---
"@modyra/lit": patch
---

A Lit element that leaves the document and comes back shows the value as it is now.

While an element is disconnected its subscription is destroyed, so every change in the meantime goes
unheard — and on reconnect the controller treated the fresh subscription's first run as the initial
one and suppressed the update. The element came back showing what it had when it left.

Coming back is not arriving: a reconnection now asks for one update, because the markup on screen is
stale by definition. Found while exercising keyed collections, but it was never about them — any
element reconnected after a change was affected.
