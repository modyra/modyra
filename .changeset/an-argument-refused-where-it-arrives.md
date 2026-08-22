---
"@modyra/core": patch
---

An argument refused where it arrives

`field(initial, validators, options)` stored whatever was put in the second position. The third
argument is the one a reader reaches for — `sensitive`, `when`, `sanitize` all live there — so the
ordinary mistake is passing it second, and the constructor said nothing: the failure arrived from
inside `createForm` as `node.validators.some is not a function`, naming a member of a node the author
never wrote, about a call two doors back.

It is refused at the door now, in the words of the call that made the mistake: what was passed — an
object, one function, `null`, a string — and where it belongs. ADR 0057 decided this for the
list-taking setters; the rule had reached the setters and not the constructor.
