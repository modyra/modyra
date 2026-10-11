# Modyra Java SDK

The first Java deliverable is `modyra-contract` (`sdk/java/modyra-contract`),
a plain Java 17+ library — Jackson is its only runtime dependency, no
Spring, no Lombok, no other framework — for parsing the Modyra Dynamic
Form Contract v2.

```java
import dev.modyra.contract.MdyDynamicFormParser;
import dev.modyra.contract.MdyDynamicFormParseResult;

var parser = new MdyDynamicFormParser();
var result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);
if (!result.ok()) {
  result.diagnostics().forEach(d ->
      System.err.println(d.code() + " at " + d.path() + ": " + d.message()));
}
```

`STRICT` returns no fields at all when any diagnostic exists — never
accept a partially-valid document. `LENIENT` keeps every field that
parsed and reports the rest as diagnostics, for previews. Fields are a
sealed interface (`MdyDynamicField`) with one record per structural
family (`MdyDynamicTextField`, `MdyDynamicNumberField`,
`MdyDynamicBooleanField`, `MdyDynamicOptionsField`, `MdyDynamicDateField`)
— matching `packages/core/src/dynamic-config.ts`'s own discriminated
union exactly.

The project's tests read the same fixtures under
`spec/fixtures/dynamic-form/v2/` that `sdk/rust/modyra-contract`'s own
tests already use — real cross-SDK conformance against a single shared
source of truth, not a hand-copied approximation. This includes
`checkout-recursive.json` (a nested group/array schema) and
`invalid-reference.json` (rejected here for the same unknown-field-
reference reason Rust rejects it).

**Scope**: parses the flat field-list envelope (a bare JSON array, or
`{"version": 2|3|4, "fields": [...]}`, same as `parseDynamicFields()` in
TS) and the v2 recursive `{"version": 2, "schema": {...}}` envelope
(nested `group`/`array`/`field` nodes, flattened to dotted/indexed
paths exactly like `flattenDynamicSchema` in TS, including array-row
data cascading into a field's `initialValue`). `layout` (including nested section/columns nodes) and `rules` are
validated against the resolved field names and kept as their raw JSON
form, same as the TS reference implementation.

## Build and test

No global Maven installation needed — the repo ships the [Maven
Wrapper](https://maven.apache.org/wrapper/), which downloads a pinned
Maven version into `~/.m2/wrapper/` on first run:

```bash
cd sdk/java/modyra-contract
./mvnw test
./mvnw package
```

Requires Java 17+ (any distribution — verified against Homebrew's
OpenJDK 17 during development).

## Contract versions

This SDK reads and writes **Contract v2**. `@modyra/core` accepts v2, v3 and v4 envelopes plus the
legacy bare field array — a declared `version: 1` is refused. v3 adds
per-breakpoint placement for a single layout slot and changes nothing else, so a v2 document this
SDK produces is valid input everywhere.

## Known red: the shared corpus test

`readsEveryDocumentInTheSharedCorpus` compares this parser's `ok` with each corpus document's
verdict, and it fails on 18 documents that the TS reference and the Rust reader both judge
correctly. No CI job runs Maven, so the failure shows only when the suite is run by hand. Each
document names a rule this parser does not apply yet:

| Document | Rule | This parser |
| --- | --- | --- |
| `v4/a-expression-too-deep` | expression depth ≤ 32 | accepts |
| `v4/b-expression-without-operands` | `operands` required | accepts |
| `v4/c-operand-names-two-references` | an operand references exactly one marker | accepts |
| `v4/d-matches-catastrophic-pattern` | a `matches` pattern passes the cost test (ADR 0050) | accepts |
| `v4/e-matches-uncompilable-pattern` | a `matches` pattern compiles | accepts |
| `v2/f-validator-pattern-catastrophic` | `validators.pattern` passes the cost test | accepts |
| `v2/g-integer-before-v5` | `integer` needs v5 | accepts |
| `v2/h-slot-placement-in-v2` | slot placement needs v3 | accepts |
| `v2/i-version-one-envelope` | `version: 1` is refused | accepts |
| `v4/j-row-condition-reads-undeclared-context` | a condition reads only declared context | accepts |
| `v2/k-daterange-file-colors-kinds` | kinds `daterange`, `file`, `colors` | refuses |
| `v2/l-layout-eight-levels` | layout nests up to 32 levels | refuses |
| `v5/m-flat-v5-envelope` | flat v5 envelope | refuses, with no diagnostic |
| `v2/n-validation-condition-without-operands` | `validations` conditions are checked | accepts |
| `v2/o-rule-membership-against-a-string` | a rule's value matches its operator | accepts |
| `v4/q-condition-reads-a-path-nothing-encloses` | a `{path}` stays inside its group | accepts |
| `v2/r-validator-pattern-uncompilable` | `validators.pattern` compiles | accepts |
| `v2/s-validator-pattern-quantified-boundary` | `\b` takes no quantifier | accepts |

These are gaps in this parser. The documents are correct. A gap closes when its document passes,
and the row comes out of this table in the same change.
