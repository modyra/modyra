package dev.modyra.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
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
  private static final Path SPEC_FIXTURES_V3 = Path.of("../../../spec/fixtures/dynamic-form/v3");

  private static String readFixture(String name) throws IOException {
    return Files.readString(SPEC_FIXTURES.resolve(name));
  }

  private static String readV3Fixture(String name) throws IOException {
    return Files.readString(SPEC_FIXTURES_V3.resolve(name));
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
   * Same shared fixture Rust rejects (tests/contract.rs): its {@code rules}
   * array references an unknown field ("missing"). Now that layout/rules
   * validation is implemented here too, Java rejects it for the same
   * reason — real cross-SDK agreement, not just a shared field list.
   */
  @Test
  void rejectsSharedInvalidReferenceFixtureLikeRust() throws IOException {
    String json = readFixture("invalid-reference.json");
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertFalse(result.ok());
    assertEquals(0, result.fields().size());
    assertEquals("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", result.diagnostics().get(0).code());
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
  void theV2SchemaEnvelopeParsesAnEmptyGroup() {
    String json = """
        {"version":2,"schema":{"node":"group","children":{}}}
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> "expected ok=true, diagnostics: " + result.diagnostics());
    assertEquals(2, result.version());
    assertEquals(0, result.fields().size());
  }

  /**
   * Mirrors packages/core/test/core.test.mjs "Contract v2 recursively
   * flattens group and array nodes" line for line, including the exact
   * expected field-name list and the array row data cascading into
   * items.0.qty's initialValue — same oracle values as the TS test, not a
   * hand-guessed approximation.
   */
  @Test
  void recursiveSchemaFlattensGroupAndArrayNodesLikeTs() {
    String json = """
        {
          "version": 2,
          "schema": {
            "node": "group",
            "children": {
              "shipping": {
                "node": "group",
                "children": {
                  "city": {"node":"field","field":{"kind":"text","label":"City","validators":{"required":true}}}
                }
              },
              "items": {
                "node": "array",
                "initialValue": [{"sku":"A","qty":2}],
                "item": {
                  "node": "group",
                  "children": {
                    "sku": {"node":"field","field":{"kind":"text","label":"SKU"}},
                    "qty": {"node":"field","field":{"kind":"number","label":"Qty","min":1}}
                  }
                }
              }
            }
          }
        }
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> "expected ok=true, diagnostics: " + result.diagnostics());
    List<String> names = result.fields().stream().map(MdyDynamicField::name).toList();
    assertEquals(List.of("shipping.city", "items.0.sku", "items.0.qty"), names);
    MdyDynamicField qty = result.fields().stream().filter(f -> f.name().equals("items.0.qty")).findFirst().orElseThrow();
    assertEquals(2, qty.initialValue());
  }

  @Test
  void acceptsSharedNestedLayoutFixture() throws IOException {
    // Same fixture the TS and Rust parsers accept: a column row nested inside a section.
    String json = readFixture("nested-layout.json");
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> "expected ok=true, diagnostics: " + result.diagnostics());
    assertEquals(2, result.layout().size());
    JsonNode section = result.layout().get(0);
    assertEquals("section", section.path("kind").asText());
    assertEquals("street", section.path("children").get(0).asText());
    assertEquals("columns", section.path("children").get(1).path("kind").asText());
  }

  @Test
  void rejectsSharedDuplicateLayoutReferenceFixture() throws IOException {
    // A field placed in two slots would render twice and bind one value to both controls.
    String json = readFixture("duplicate-layout-reference.json");
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertFalse(result.ok());
    assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE")));
  }

  @Test
  void acceptsSharedCheckoutRecursiveFixture() throws IOException {
    String json = readFixture("checkout-recursive.json");
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> "expected ok=true, diagnostics: " + result.diagnostics());
    assertEquals(2, result.version());
    List<String> names = result.fields().stream().map(MdyDynamicField::name).toList();
    assertEquals(List.of("country", "shipping.city", "shipping.zip", "items.0.sku", "items.0.qty", "coupon"), names);
    MdyDynamicField country = result.fields().get(0);
    assertInstanceOf(MdyDynamicOptionsField.class, country);
    assertEquals(3, ((MdyDynamicOptionsField) country).options().size());
    MdyDynamicField qty = result.fields().stream().filter(f -> f.name().equals("items.0.qty")).findFirst().orElseThrow();
    assertEquals(2, qty.initialValue());
  }

  @Test
  void schemaStructuralErrorsAreReportedAndBlockAllFieldsInStrictMode() {
    String json = """
        {"version":2,"schema":{"node":"group","children":{"bad":{"node":"not-a-kind"}}}}
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertFalse(result.ok());
    assertEquals(0, result.fields().size());
    assertEquals("MDY_DYNAMIC_INVALID_NODE", result.diagnostics().get(0).code());
  }

  @Test
  void layoutAndRulesAreValidatedAgainstResolvedFieldNames() {
    String json = """
        {
          "version": 2,
          "fields": [
            {"name":"type","kind":"select","options":[{"value":"business","label":"Business"}]},
            {"name":"vat","kind":"text"}
          ],
          "layout": [{"kind":"section","id":"identity","children":["type","vat"]}],
          "rules": [{"effect":"visible","target":"vat","when":{"field":"type","operator":"equals","value":"business"}}]
        }
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> "expected ok=true, diagnostics: " + result.diagnostics());
    assertEquals(1, result.layout().size());
    assertEquals(1, result.rules().size());
  }

  @Test
  void layoutReferencingUnknownFieldIsRejected() {
    String json = """
        {
          "version": 2,
          "fields": [{"name":"email","kind":"email"}],
          "layout": [{"kind":"section","id":"bad","children":["missing"]}]
        }
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertFalse(result.ok());
    assertEquals(0, result.fields().size());
    assertEquals("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", result.diagnostics().get(0).code());
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

  @Test
  void acceptsSharedV3PlacementFixture() throws IOException {
    // The same document the TS and Rust parsers accept. A v3 envelope is what a layout placing a
    // slot per breakpoint produces, and it is the shape parse() is most likely to reject by falling
    // through every branch and failing before it reads a single field.
    String json = readV3Fixture("placement.json");
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> "diagnostics: " + result.diagnostics());
    assertEquals(3, result.version());
    assertEquals(5, result.fields().size());
    assertEquals(2, result.layout().size());

    JsonNode row = result.layout().get(0);
    assertEquals(2, row.path("at").path("sm").asInt(), "v2's track counts still ride v3");
    JsonNode slot = row.path("columns").get(1).get(0);
    assertEquals("last", slot.path("ref").asText());
    assertTrue(slot.path("at").path("base").path("hidden").asBoolean());
    assertEquals(2, slot.path("at").path("md").path("column").asInt());
  }

  @Test
  void refusesPlacementWhereNoColumnCanHonourIt() {
    // `at` outside a columns row, and a column past the row's tracks: refused exactly as the TS
    // and Rust parsers refuse them, so the three implementations agree on what a slot may say.
    String inSection = "{\"version\":3,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"}],"
        + "\"layout\":[{\"kind\":\"section\",\"id\":\"s\",\"children\":[{\"ref\":\"a\",\"at\":{\"sm\":{\"hidden\":true}}}]}]}";
    assertFalse(parser.parse(inSection, MdyDynamicFormParser.Mode.STRICT).ok());

    String pastTheEnd = "{\"version\":3,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"},{\"name\":\"b\",\"kind\":\"text\"}],"
        + "\"layout\":[{\"kind\":\"columns\",\"id\":\"r\",\"columns\":[[\"a\"],[{\"ref\":\"b\",\"at\":{\"sm\":{\"column\":5}}}]]}]}";
    assertFalse(parser.parse(pastTheEnd, MdyDynamicFormParser.Mode.STRICT).ok());

    // A slot with nothing to place is a field name written longhand, and is fine.
    String plainSlot = "{\"version\":3,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"},{\"name\":\"b\",\"kind\":\"text\"}],"
        + "\"layout\":[{\"kind\":\"columns\",\"id\":\"r\",\"columns\":[[\"a\"],[{\"ref\":\"b\"}]]}]}";
    assertTrue(parser.parse(plainSlot, MdyDynamicFormParser.Mode.STRICT).ok());

    // A version this parser has never heard of is still refused.
    String v4 = "{\"version\":4,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"}]}";
    assertFalse(parser.parse(v4, MdyDynamicFormParser.Mode.STRICT).ok());
  }
}
