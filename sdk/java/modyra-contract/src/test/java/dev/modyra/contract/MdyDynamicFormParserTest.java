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
  private static final Path SPEC_FIXTURES_V5 = Path.of("../../../spec/fixtures/dynamic-form/v5");

  private static String readFixture(String name) throws IOException {
    return Files.readString(SPEC_FIXTURES.resolve(name));
  }

  private static String readV5Fixture(String name) throws IOException {
    return Files.readString(SPEC_FIXTURES_V5.resolve(name));
  }

  private static String readV3Fixture(String name) throws IOException {
    return Files.readString(SPEC_FIXTURES_V3.resolve(name));
  }

  private static final Path SPEC_FIXTURES_V4 = Path.of("../../../spec/fixtures/dynamic-form/v4");

  private static String readV4Fixture(String name) throws IOException {
    return Files.readString(SPEC_FIXTURES_V4.resolve(name));
  }

  private final MdyDynamicFormParser parser = new MdyDynamicFormParser();

  /**
   * Contract v5, read from the same file the TypeScript parser and the schema audit read.
   *
   * <p>A version this reader does not know is refused wholesale, so accepting the document is the
   * whole of what this asserts: a v5 envelope reaches the tree walk and comes back with its fields.
   * The mirror record grew {@code integer} and {@code messages} in the same change, and a reader
   * that had not been told about v5 would refuse the document before either could matter.
   */
  @Test
  void acceptsSharedV5Fixture() throws IOException {
    String json = readV5Fixture("whole-number-rule.json");
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> "expected ok=true, diagnostics: " + result.diagnostics());
    assertEquals(5, result.version());
    assertEquals(2, result.fields().size());
    assertEquals("seats", result.fields().get(0).name());
    assertEquals("note", result.fields().get(1).name());
  }

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

    // A version this parser has never heard of is still refused. Four is one it has: v4 is v3 plus a
    // condition on a node and the context keys a document declares it reads.
    String v5 = "{\"version\":5,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"}]}";
    assertFalse(parser.parse(v5, MdyDynamicFormParser.Mode.STRICT).ok());
  }

  /**
   * The shared corpus's v4 documents, read by this parser.
   *
   * The corpus is what makes one contract out of three implementations: the same documents, the same
   * verdict. A fixture's context lives in a twin file beside it (ADR 0098) and is not read here —
   * this parser says whether a document is a document, and supplying context is a host's part of
   * building a form.
   */
  @Test
  void acceptsTheSharedV4Fixtures() throws IOException {
    for (String name : new String[]{"conditional-tree.json", "self-and-root.json", "context-conditions.json"}) {
      MdyDynamicFormParseResult result = parser.parse(readV4Fixture(name), MdyDynamicFormParser.Mode.STRICT);
      assertTrue(result.ok(), () -> "a published v4 fixture was refused: " + name + " " + result.diagnostics());
      assertEquals(4, result.version());
    }
  }

  /**
   * The three readers of this contract accept the same versions, and read v4's own members.
   *
   * A document rendered by one runtime and refused by two is not one contract, and v4 carries the
   * conditional semantics — so it is where disagreeing costs the most. The clause is checked as a
   * shape: this parser says whether a document is a document, and building a form is the runtime's
   * work.
   */
  @Test
  void readsAV4DocumentAndTheContextItDeclares() {
    String declared = "{\"version\":4,\"requiresContext\":[\"tier\"],"
        + "\"schema\":{\"node\":\"group\",\"children\":{"
        + "\"vat\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"},"
        + "\"when\":{\"op\":\"equals\",\"operands\":[{\"context\":\"tier\"},\"business\"]}}}}}";
    assertTrue(parser.parse(declared, MdyDynamicFormParser.Mode.STRICT).ok());

    String undeclared = "{\"version\":4,"
        + "\"schema\":{\"node\":\"group\",\"children\":{"
        + "\"vat\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"},"
        + "\"when\":{\"op\":\"equals\",\"operands\":[{\"context\":\"tier\"},\"business\"]}}}}}";
    assertTrue(parser.parse(undeclared, MdyDynamicFormParser.Mode.LENIENT).diagnostics().stream()
        .anyMatch(d -> d.code().equals("MDY_DYNAMIC_UNDECLARED_CONTEXT")));

    String malformed = "{\"version\":4,\"requiresContext\":[\"tier\"],"
        + "\"schema\":{\"node\":\"group\",\"children\":{"
        + "\"vat\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"},"
        + "\"when\":{\"op\":\"equals\",\"operands\":[{\"nonsense\":\"tier\"},\"business\"]}}}}}";
    assertTrue(parser.parse(malformed, MdyDynamicFormParser.Mode.LENIENT).diagnostics().stream()
        .anyMatch(d -> d.code().equals("MDY_DYNAMIC_INVALID_CONDITION")));

    // And a member the version predates, the same answer the TypeScript and Rust readers give.
    String early = "{\"version\":3,\"requiresContext\":[\"tier\"],\"fields\":[{\"name\":\"a\",\"kind\":\"text\"}]}";
    assertTrue(parser.parse(early, MdyDynamicFormParser.Mode.LENIENT).diagnostics().stream()
        .anyMatch(d -> d.code().equals("MDY_DYNAMIC_UNSUPPORTED_VERSION")));
  }

  /**
   * A mode survives the parse, and what this SDK does not understand is said out loud.
   *
   * Both halves guard the same silence. A multiselect parsed without its mode re-serialises as a
   * different widget, because the widget contract picks an anatomy by that value; and a property
   * dropped without a word is a document this SDK reported success on and did not understand.
   */
  @Test
  void carriesTheMultiselectModeAndReportsWhatItIgnored() {
    String json = "{\"version\":2,\"fields\":[{"
        + "\"name\":\"tags\",\"kind\":\"multiselect\",\"mode\":\"multi\","
        + "\"options\":[{\"value\":\"a\",\"label\":\"A\"}]}]}";

    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);
    assertTrue(result.ok(), "a declared mode is not a parse error");
    MdyDynamicOptionsField field = (MdyDynamicOptionsField) result.fields().get(0);
    assertEquals("multi", field.mode(), "the mode must survive the parse");

    String unknown = "{\"version\":2,\"fields\":[{"
        + "\"name\":\"tags\",\"kind\":\"multiselect\",\"somethingNew\":true,"
        + "\"options\":[{\"value\":\"a\",\"label\":\"A\"}]}]}";

    MdyDynamicFormParseResult reported = parser.parse(unknown, MdyDynamicFormParser.Mode.LENIENT);
    assertTrue(
        reported.diagnostics().stream().anyMatch((d) -> "MDY_DYNAMIC_UNKNOWN_PROPERTY".equals(d.code())),
        "an ignored property must be reported, never dropped in silence");
  }


  /**
   * The shared nested-collections fixture: a keyed collection inside a keyed row, an array below
   * that, and a keyed collection as the whole row of an array — the same document TS and Rust take.
   */
  @Test
  void acceptsTheSharedNestedCollectionsFixture() throws Exception {
    MdyDynamicFormParseResult result =
        parser.parse(readV3Fixture("nested-collections.json"), MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> String.valueOf(result.diagnostics()));
    // A document declares the rows it starts with; this one declares none, so the flat view is
    // empty while the schema is whole.
    assertTrue(result.fields().isEmpty(), "no row is declared, so no leaf is named");
  }

  /**
   * A collection nests without a limit, in either direction.
   *
   * <p>This asserted the opposite — a path crossing one positional level, with an array below
   * another array refused where it was written. ADR 0043 removed that rule from the engine, and this
   * SDK went on refusing documents the runtime accepts, which is the one thing an SDK must not do.
   */
  @Test
  void aCollectionNestsWithoutALimit() {
    String arrayInArray = "{\"version\":3,\"schema\":{\"node\":\"array\",\"item\":"
        + "{\"node\":\"array\",\"item\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"}}}}}";
    MdyDynamicFormParseResult accepted = parser.parse(arrayInArray, MdyDynamicFormParser.Mode.STRICT);
    assertTrue(accepted.ok(), () -> String.valueOf(accepted.diagnostics()));

    String arrayUnderARowsRecord = "{\"version\":3,\"schema\":{\"node\":\"array\",\"item\":"
        + "{\"node\":\"record\",\"item\":{\"node\":\"array\",\"item\":"
        + "{\"node\":\"field\",\"field\":{\"kind\":\"text\"}}}}}}";
    MdyDynamicFormParseResult nested = parser.parse(arrayUnderARowsRecord, MdyDynamicFormParser.Mode.STRICT);
    assertTrue(nested.ok(), () -> String.valueOf(nested.diagnostics()));

    // The known-good refusal in the same test: what this walk still reports, it still reports.
    String unsafeKey = "{\"version\":3,\"schema\":{\"node\":\"record\",\"item\":"
        + "{\"node\":\"field\",\"field\":{\"kind\":\"text\"}},"
        + "\"initialValue\":{\"__proto__\":\"x\"}}}";
    MdyDynamicFormParseResult refused = parser.parse(unsafeKey, MdyDynamicFormParser.Mode.STRICT);
    assertFalse(refused.ok());
    assertTrue(refused.diagnostics().stream().anyMatch((d) -> "MDY_DYNAMIC_UNSAFE_NAME".equals(d.code())));
  }

  /** A record's declared rows are named in the flat view, by key rather than by index. */
  @Test
  void namesADeclaredRowByItsKey() {
    String json = "{\"version\":3,\"schema\":{\"node\":\"group\",\"children\":{"
        + "\"lines\":{\"node\":\"record\",\"item\":{\"node\":\"field\","
        + "\"field\":{\"kind\":\"text\"}},\"initialValue\":{\"tmp:1\":\"Espresso\"}}}}}";

    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);
    assertTrue(result.ok(), () -> String.valueOf(result.diagnostics()));
    assertEquals("lines.tmp:1", result.fields().get(0).name());
    assertEquals("Espresso", result.fields().get(0).initialValue());
  }

}
