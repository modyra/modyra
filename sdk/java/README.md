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
