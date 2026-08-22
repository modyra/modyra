---
"@modyra/angular": minor
---

`<mdy-dynamic-form>` checks a field list handed to it directly.

The `fields` input went to the template unchecked, so a list naming one field twice built a form with
one field of that name and drew a control for each entry. The second control wrote into the first
one's field — over what a person had typed — and the entry following the pair was not drawn at all.

The list now passes through `assertSafeDynamicFieldNames`, the same guard `@modyra/plain`'s field-list
door makes, and a list that fails it renders nothing rather than a form with controls that do not
belong to it. The `document` input is unaffected: a document is already checked by the parser it
arrives through.

**Migration**: a consumer passing a list with a duplicate or unsafe name was already getting a form
that did not match the list. Fix the list, or route it through `parseDynamicFields`, which drops the
offending entries with a diagnostic instead of refusing.
