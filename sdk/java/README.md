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
source of truth, not a hand-copied approximation.

**Scope note**: this first version parses the flat field-list envelope
(a bare JSON array, or `{"version": 1|2, "fields": [...]}`) — the same
shape `parseDynamicFields()` accepts on the TypeScript side. The v2
recursive `schema`/`layout`/`rules` envelope (nested groups/arrays,
declarative visibility rules) is not implemented yet; an input using
that shape reports a diagnostic explaining the gap rather than silently
misparsing it.

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
