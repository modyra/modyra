package dev.modyra.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * P14 gate: "Java doc strict-valid in TS." These tests read the exact same
 * shared fixtures under {@code spec/fixtures/dynamic-form/v2/} that
 * {@code sdk/rust/modyra-contract}'s own conformance tests already use
 * (see tests/contract.rs there) — real cross-SDK conformance, not a
 * hand-copied approximation of one.
 */
class MdyDynamicFormParserTest {

  private static final Path SPEC_FIXTURES = Path.of("../../../spec/fixtures/dynamic-form/v2");

  private static String readFixture(String name) throws IOException {
    return Files.readString(SPEC_FIXTURES.resolve(name));
  }

  private final MdyDynamicFormParser parser = new MdyDynamicFormParser();

  @Test
  void acceptsSharedValidFixture() throws IOException {
    String json = readFixture("valid.json");
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> "expected ok=true, diagnostics: " + result.diagnostics());
    assertEquals(2, result.version());
    assertEquals(2, result.fields().size());

    MdyDynamicField customerType = result.fields().get(0);
    assertEquals("customerType", customerType.name());
    assertInstanceOf(MdyDynamicOptionsField.class, customerType);
    assertEquals(2, ((MdyDynamicOptionsField) customerType).options().size());

    MdyDynamicField vatNumber = result.fields().get(1);
    assertEquals("vatNumber", vatNumber.name());
    assertInstanceOf(MdyDynamicTextField.class, vatNumber);
  }

  /**
   * Documents a real, known scope gap rather than hiding it: this fixture
   * is invalid in TS/Rust specifically because its {@code rules} array
   * references an unknown field — a check this MVP Java parser does not
   * implement (it only parses the flat {@code fields} array, see the
   * class doc on {@link MdyDynamicFormParser}). It is therefore accepted
   * here, unlike in TS/Rust — asserted explicitly, not silently skipped.
   */
  @Test
  void invalidReferenceFixtureIsAcceptedHereBecauseRulesAreNotValidatedYet() throws IOException {
    String json = readFixture("invalid-reference.json");
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), "the field list itself is valid; only the (unimplemented) rules check would reject this in TS/Rust");
    assertEquals(1, result.fields().size());
  }

  @Test
  void bareArrayParsesAllRealKinds() {
    String json = """
        [
          {"name":"name","kind":"text","validators":{"required":true}},
          {"name":"email","kind":"email","validators":{"required":true,"email":true}},
          {"name":"age","kind":"number","validators":{"min":18}},
          {"name":"subscribe","kind":"checkbox"},
          {"name":"country","kind":"select","options":[{"value":"IT","label":"Italy"},{"value":"FR","label":"France"}]}
        ]
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok());
    assertEquals(1, result.version());
    assertEquals(5, result.fields().size());
    assertEquals(0, result.diagnostics().size());

    MdyDynamicField age = result.fields().get(2);
    assertInstanceOf(MdyDynamicNumberField.class, age);
    assertEquals(18.0, age.validators().min());
  }

  @Test
  void strictModeRejectsTheWholeDocumentWhenAnyFieldIsDropped() {
    String json = """
        [
          {"name":"ok","kind":"text"},
          {"name":"","kind":"text"}
        ]
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertFalse(result.ok());
    assertEquals(0, result.fields().size(), "strict mode returns no fields at all when any diagnostic exists");
    assertEquals(1, result.diagnostics().size());
    assertEquals("MDY_DYNAMIC_MISSING_NAME", result.diagnostics().get(0).code());
  }

  @Test
  void lenientModeKeepsValidFieldsAndReportsDroppedOnes() {
    String json = """
        [
          {"name":"ok","kind":"text"},
          {"name":"bad.name","kind":"text"},
          {"name":"unknownKind","kind":"not-a-real-kind"},
          {"name":"noOptions","kind":"select"}
        ]
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.LENIENT);

    assertTrue(result.ok(), "lenient mode's ok does not depend on per-field diagnostics, matching parseDynamicForm() in TS");
    assertEquals(1, result.fields().size());
    assertEquals("ok", result.fields().get(0).name());
    assertEquals(3, result.diagnostics().size());
    assertEquals(1, result.acceptedCount());
    assertEquals(3, result.rejectedCount());
  }

  @Test
  void duplicateNamesAreDropped() {
    String json = """
        [
          {"name":"dup","kind":"text"},
          {"name":"dup","kind":"number"}
        ]
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.LENIENT);

    assertEquals(1, result.fields().size());
    assertEquals("MDY_DYNAMIC_DUPLICATE_NAME", result.diagnostics().get(0).code());
  }

  @Test
  void malformedJsonReportsADiagnosticInsteadOfThrowing() {
    MdyDynamicFormParseResult result = parser.parse("{ not json", MdyDynamicFormParser.Mode.LENIENT);

    assertFalse(result.ok());
    assertEquals(1, result.diagnostics().size());
    assertEquals("MDY_DYNAMIC_INVALID_JSON", result.diagnostics().get(0).code());
  }

  @Test
  void theV2SchemaEnvelopeReportsItsOwnScopeGapRatherThanMisparsing() {
    String json = """
        {"version":2,"schema":{"node":"group","children":{}}}
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertFalse(result.ok());
    assertTrue(result.diagnostics().get(0).message().contains("schema/layout/rules envelope"));
  }

  @Test
  void optionsFieldsRequireANonEmptyOptionsList() {
    String json = """
        [{"name":"country","kind":"select"}]
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.LENIENT);

    assertEquals(0, result.fields().size());
    assertEquals("MDY_DYNAMIC_MISSING_OPTIONS", result.diagnostics().get(0).code());
  }
}
