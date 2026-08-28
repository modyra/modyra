---
"@modyra/styles": patch
---

The reserved line is under the fields that can fail a rule, not under every field

The stylesheet has reserved a line of feedback since `9ff66356`, and its comment gives the reason
exactly: *"validating must never move the control the user is reaching for."* It reserved it under
**every** field — `padding-block-end` on `.mdy-renderer`, unconditionally — including fields with no
rule that could ever fill it. On a long form on a phone that is a line of scrolling per field, bought
for a message that cannot arrive.

The contract now says which fields can fail, and the renderers answer it by drawing the error
container. The reservation follows that answer — `.mdy-renderer:has(> .mdy-control__errors:not([hidden]))`
— rather than holding a second opinion about it. Two mechanisms answering one question is how they
come to disagree, and these already did: the stylesheet reserved for all, the contract for some.

`:has` is the technique this stylesheet already uses in forty-six places, and `:not([hidden])` covers
both shapes a renderer uses — omitting the element, or keeping it and hiding it.
