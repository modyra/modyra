# Fable 5 hunts

Hunting assignments derived from `.modyra/fable5-work-orders.md`, which replaces the external
brief `.modyra/modyra-fable5-brief.md`. That brief promises a server-driven contract system;
roughly two thirds of it already exists in `packages/core/src/dynamic/` and
`packages/core/src/expression.ts`. Each hunt below is a claim about that promise, stated so it
can be broken. Findings from these hunts are numbered in
[`../reports/open-findings.md`](../reports/open-findings.md) by whoever files them, and pass to
the executor through the register as usual.

Two rules specific to this charter:

- A claim marked **red-by-construction** is known false today: the work order names the missing
  capability. The battle still matters — it is the pin that turns green when the work lands, and
  it is what the executor is handed.
- A claim marked **defend** is believed true and mature. The hunt is to break it, not to
  re-verify the happy path.

## H-1 — Angular renders a remote contract with no form-specific template (WO-1)

**Red-by-construction. Severity S2** (two renderers would diverge: plain and react consume the
document, angular does not).

Claim: `mdy-dynamic-form` accepts a raw dynamic-form document fetched from a server, validates it
through `parseDynamicForm`, and renders it with rules, `when` conditions and server errors bound
to field paths — with no branch naming the form.

Code under test: `packages/angular/src/lib/dynamic/mdy-dynamic-form.component.ts` (today: a flat
`[fields]` input and a `@switch` over kinds; no reference to `parseDynamicForm`,
`buildDynamicFormSchema` or `applyDynamicRules` anywhere in `packages/angular`).
Reference behaviour: `packages/plain/src/mount.ts`.

Green when: an e2e on the angular project renders a contract served over HTTP, a `when` condition
toggles a field, a server error lands on its canonical path, and a malformed or unknown-kind
document is refused with structured diagnostics.

## H-2 — A computed field follows its sources from a pure contract (WO-2)

**Red-by-construction. Severity S2.**

Claim: a document can declare a computation (e.g. a money field equal to the sum of
`quantity * unitPrice` over an array's rows) and the field updates as rows change, client and
server agreeing on the value.

Code under test: `packages/core/src/expression.ts` — today the AST holds predicates only; no
arithmetic, no aggregation, no `computations` slot in `packages/core/src/dynamic/parse.ts`.

Green when: the claim holds from JSON alone, cyclic computations are rejected with a diagnostic,
and a fixture in `spec/fixtures/dynamic-form/` pins the semantics for the Rust and Java SDKs.

## H-3 — The published schema and the parser refuse the same documents (WO-5)

**Defend and extend. Severity S3, S2 wherever an SDK disagrees.**

Claim: for every document, `spec/dynamic-form-v*.schema.json` and `parseDynamicForm` agree on
acceptance — and there exists a published schema for every version the parser accepts.

Known tear: the register already holds schema↔parser misalignments (a key the published schema
refuses passes the parser), and the parser accepts a **version 4** that has no published schema
at all. `packages/core/src/dynamic/parse.ts:44-48` pushes migration onto the loader; that policy
is a claim too.

Code under test: `spec/dynamic-form-v2.schema.json`, `spec/dynamic-form-v3.schema.json`,
`packages/core/src/dynamic/parse.ts`, checked by `scripts/audit-contract-schema.mjs`.

Green when: a v4 schema exists, the audit covers it, and a differential campaign (schema accepts
⇔ parser accepts, both directions) finds no residue.

## H-4 — The widget catalogue stays closed to what nobody registered (WO-4)

**Defend. Severity S0 if it breaks** (an unregistered kind rendering is the remote-contract
security boundary giving way).

Claim: a document naming a kind outside the catalogue is rejected with
`MDY_DYNAMIC_UNKNOWN_KIND`, on every adapter, whatever wraps it — nesting, layout slots,
renames, drafts.

Code under test: `packages/core/src/dynamic/field-kinds.ts`,
`packages/widgets/src/catalog/kinds.ts` (closed by deliberate decision — the header comment is
the contract), and each adapter's renderer switch.

Green when: the hunt fails to find a path that smuggles an unknown kind past the parser into a
renderer. If WO-4 lands (governed custom widgets), this claim is rewritten around the allowlist.

## H-5 — The brief's security promises, attacked as claims (transversal)

**Defend. Severity S0/S1.**

The external brief asks for a hardened remote contract as if it were missing. It is the most
mature part of the system — which makes it the most worth attacking, because everyone will
assume it is done. Claims already registered and worth re-pressing against the document path:

- `SEC-001` (unsafe path segments), `SEC-003` (sanitised values), `SEC-004` (a document cannot
  stall the form) — now against deeply nested `when`/`asyncWhen` expressions at the depth cap,
  layout at its own cap, and collections nested past what ADR 0043 contemplated.
- Fail-closed evaluation: an unknown operator, a wrong-typed operand, or an expression at depth
  33 must answer `false` or a diagnostic — never throw, never open a field.
- The hostile input is the whole document, not one field: a single payload combining max depth,
  max fields (the 10,000-step bound), ReDoS-shaped patterns and unsafe segments.

Code under test: `packages/core/src/expression.ts`, `packages/core/src/dynamic/parse.ts`,
`packages/core/src/dynamic/pattern-cost.ts`, `packages/core/src/security.ts`.

## H-6 — One interpreter, three runtimes (transversal)

**Defend. Severity S2.**

Claim: the same conditional semantics hold in `@modyra/core`, the Rust SDK and the Java SDK,
proven by the shared fixtures in `spec/fixtures/dynamic-form/` — including the v4 `when` forms,
which the SDKs may not yet parse.

Code under test: `sdk/rust/modyra-contract`, `sdk/java/modyra-contract`,
`spec/fixtures/dynamic-form/`.

Green when: a differential run over the fixtures finds no divergence, and any version the TS
parser accepts has a stated position (parsed or refused) in each SDK.
