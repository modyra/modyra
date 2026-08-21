# Migration guide

Two kinds of migration converge here: moving an existing form **to** Modyra from another library,
and moving **between Modyra versions**. The first is covered by the comparison pages, each paired
with a migration example that runs as a test; the second by the compatibility policy and the
release notes.

## From another form library

| You are coming from | Read first | Then run the tested example |
| --- | --- | --- |
| react-hook-form | [Comparison](./comparison-react-hook-form.md) | [`rhf-migration.test.mjs`](../examples/rhf-migration/rhf-migration.test.mjs) |
| Formik | [Comparison](./comparison-formik.md) | [`formik-migration.test.mjs`](../examples/formik-migration/formik-migration.test.mjs) |
| Angular Reactive Forms | [Comparison](./comparison-reactive-forms.md) | [Reactive Forms interop](./interop.md) — the two can share one form |

The test files are not illustrations: they build the same form in both libraries and assert the two
agree on the same invalid → valid transition, so a divergence between this page and the code fails a
test rather than a reader.

The moves that matter are the same in every path: validation rules become validator functions on the
field; form-level state (`valid`, `dirty`, `pending`) is read from handles and signals instead of a
render-tracked proxy; and anything the contract expresses — layout, visibility rules, widget kinds —
can leave your components entirely and become data. [Usage modes](./usage-modes.md) explains when
that trade is worth making.

## Between Modyra versions

`@modyra/core` and `@modyra/widgets` are versioned together under the [compatibility
policy](../contract-compatibility.md): nothing is removed or changed in a breaking way outside a
major release. The one bounded exception — a set of subpath removals shipped while the library had
no consumers — is recorded with its complete migration table in
[ADR 0039](../architecture/0039-a-breaking-change-shipped-as-a-patch.md).

Every other package — the adapters, the SDKs, Studio — versions independently below 1.0, and its
public surface can change in a minor release:

1. Pin versions in `package.json`; do not float on ranges.
2. Read the per-package changelog before upgrading — each entry states its migration, or states
   that there is none. The [changelog index](../../CHANGELOG.md) links them all.
3. If you render the widget contract yourself, check your renderer against the contract version it
   targets: `npx modyra-conformance` runs the suite, and
   [contract compatibility](../contract-compatibility.md) says how a version change is classified.

## What does not migrate

A form written against one framework adapter does not need porting to another: the schema or the
contract stays, only the rendering call changes. That is the property the
[checkout scenario](../examples/checkout-scenario.md) demonstrates — the same form in every
adapter, so a difference between pages is a difference between adapters, not between authors.
