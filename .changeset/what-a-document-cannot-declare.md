---
"@modyra/plain": minor
---

A host can supply what a document cannot declare

A document says which rules a field has and **when** its asynchronous checks run — and has no way to
say **that** a field has any, because an asynchronous check is a function and a document is data. A
field verified against something only a server can reach needs its check attached by the host.

Before this, that meant leaving `mountDynamicForm` entirely and doing parse, build, attach, create
and apply by hand — so the one-call door and the server-checked form were mutually exclusive, and a
form lost the door built to keep its steps together at exactly the moment it grew a real backend.

    mountDynamicForm(host, document, {
      fieldOptions: { vat: serverValidator(askTheRegister) },
    })

Merged onto what the document declared rather than replacing it, so a host adding a check does not
silently drop the rules the document asked for. A name the document does not have is refused: a
check attached to nothing is a guarantee the host believes is in force.

What is attached travels the contract's own channel — the field is `pending` while the answer is in
flight and carries what comes back exactly as it carries a rule it checked itself. There is no
second channel for "the server said no".

The demo's checkout now uses it: the Rust service declares a VAT field conditional on the country
and answers a register the page cannot reach, with a wait long enough to see.
