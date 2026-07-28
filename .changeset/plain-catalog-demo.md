---
"@modyra/widgets": patch
---

Emit ARIA states as `"true"` / `"false"` strings everywhere, so a renderer that writes the
attribute verbatim cannot produce `aria-required=""`. Adds a framework-free catalog demo
(`npm run demo:plain`) that renders all seventeen kinds under every packaged theme and reports the
live DOM-contract verdict on screen.
