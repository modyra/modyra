---
"@modyra/studio-app": patch
"@modyra/plain-preview-app": patch
---

The development servers answer only their own page and build

They served the whole app folder, including `node_modules` links into the workspace, followed links
out of it, and answered any `Host`, so a hostile page could read them through DNS rebinding. They now
serve `/` and `dist/` only, check where a file really is before serving it, and refuse a foreign
`Host` with 421. The plain preview also serves `.css` as `text/css`. ADR 0219.
