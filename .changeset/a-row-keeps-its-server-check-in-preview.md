---
"@modyra/studio-preview": patch
---

A server validator on a field inside an array or record row runs in the preview

The live preview attached a mock server validator only to fields outside collections. A server
validator declared on a row's field was silently absent, so the preview showed rows as valid that the
mock server would refuse. Every row now gets it, keyed rows and rows added later included.

**Migration.** None required.
