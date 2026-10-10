---
"@modyra/widgets": patch
---

`keyBindingFor` answers type-ahead when it is asked with a key press

Asked with an event, the printable binding was compared on its own placeholder key, which no
press ever equals, so a letter typed at a list resolved to `null` and a renderer passing its
event could never reach type-ahead. The modifier is now checked against the character that
was pressed: a bare letter (or a capital) is type-ahead, and a letter with Ctrl or Cmd held
still belongs to the platform. Asked with a key name, nothing changes. No migration.
