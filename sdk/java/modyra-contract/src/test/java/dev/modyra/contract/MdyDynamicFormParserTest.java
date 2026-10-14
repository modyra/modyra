package dev.modyra.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
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

  /** Corpus documents this reader is known to judge differently from the verdict beside them. */
  private static final Path KNOWN_DISAGREEMENTS = Path.of("src/test/resources/known-corpus-disagreements.json");

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

  /**
   * Every document in the shared corpus, found rather than named.
   *
   * <p>A list of file names is a coverage claim nobody re-counts: this suite named eleven of
   * thirteen documents and reported its passes as if it had read them all, because the number a
   * list reports is the number it was given.
   *
   * <p>Each document's expected verdict comes from the corpus too — a {@code .expected.json}
   * beside it, whose absence means "this one parses clean". A fixture added tomorrow is read the
   * day it lands, and one meant to be refused is not mistaken for a regression.
   *
   * <p>Where this reader is known to disagree, the document is listed in
   * {@link #KNOWN_DISAGREEMENTS}, and the list is held exact in both directions: a disagreement it
   * does not name is a regression, and a name that now agrees is a repair the list has to lose. A
   * suite that stopped at the first disagreement could only be green once every one was fixed, so
   * it could not run anywhere meanwhile, and the next regression would land unseen behind the
   * known ones.
   */
  @Test
  void readsEveryDocumentInTheSharedCorpus() throws IOException {
    Path corpus = Path.of("../../../spec/fixtures/dynamic-form");
    List<Path> documents = new ArrayList<>();
    try (var versions = Files.list(corpus)) {
      for (Path version : versions.filter(Files::isDirectory).sorted().toList()) {
        try (var entries = Files.list(version)) {
          for (Path path : entries.sorted().toList()) {
            String name = path.getFileName().toString();
            // A document is a file whose name carries no second suffix. `.expected.json` states a
            // verdict and `.context.json` supplies host facts; a rule about suffixes covers the
            // next kind of companion without being edited for it.
            if (name.endsWith(".json") && name.chars().filter(c -> c == '.').count() == 1) {
              documents.add(path);
            }
          }
        }
      }
    }

    assertTrue(documents.size() >= 10, "the walk found " + documents.size() + " documents, too few to be the corpus");

    Map<String, String> disagreements = new TreeMap<>();
    for (Path path : documents) {
      String label = path.getParent().getFileName() + "/" + path.getFileName();
      MdyDynamicFormParseResult result =
          parser.parse(Files.readString(path), MdyDynamicFormParser.Mode.STRICT);

      Path expected = path.resolveSibling(
          path.getFileName().toString().replace(".json", ".expected.json"));
      boolean wanted = true;
      if (Files.exists(expected)) {
        JsonNode verdict = new ObjectMapper().readTree(Files.readString(expected));
        wanted = !verdict.has("valid") || verdict.get("valid").asBoolean();
      }
      if (wanted != result.ok()) {
        disagreements.put(label, (wanted ? "refused: " : "accepted: ") + result.diagnostics());
      }
    }

    Set<String> known = new TreeSet<>();
    new ObjectMapper().readTree(Files.readString(KNOWN_DISAGREEMENTS))
        .get("disagreements").forEach(entry -> known.add(entry.asText()));

    List<String> regressions = new ArrayList<>();
    disagreements.forEach((label, detail) -> {
      if (!known.contains(label)) regressions.add(label + " " + detail);
    });
    List<String> repaired = known.stream().filter(label -> !disagreements.containsKey(label)).toList();

    assertTrue(regressions.isEmpty(), () -> "disagrees with the corpus and is not in "
        + KNOWN_DISAGREEMENTS.getFileName() + ": " + regressions);
    assertTrue(repaired.isEmpty(), () -> "agrees with the corpus now, so remove from "
        + KNOWN_DISAGREEMENTS.getFileName() + ": " + repaired);
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

  /** A rule past the double range is no finite number, as it is not to a JavaScript reader. */
  @Test
  void refusesARuleThatOverflowsTheDoubleRange() {
    String json = "{\"version\":2,\"id\":\"f\",\"fields\":"
        + "[{\"name\":\"seats\",\"kind\":\"number\",\"validators\":{\"min\":1e400}}]}";
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertEquals(1, result.diagnostics().size(), () -> result.diagnostics().toString());
    MdyDynamicDiagnostic refusal = result.diagnostics().get(0);
    assertEquals("MDY_DYNAMIC_INVALID_FIELD", refusal.code());
    assertEquals("/fields", refusal.path());
    assertEquals("Dropped dynamic field \"seats\": validators.min must be a finite number.", refusal.message());
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

  /**
   * The three kinds whose value is not one scalar. Each keeps the members its kind declares, so a
   * document read and written back still describes the same control.
   */
  @Test
  void readsDaterangeFileAndColorsWithTheirOwnMembers() throws IOException {
    String json = """
        [
          {"name":"stay","kind":"daterange"},
          {"name":"cv","kind":"file","accept":".pdf","multiple":true},
          {"name":"brand","kind":"colors","presets":["#4361ee",{"value":"#e63946","label":"Signal red"}]}
        ]
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> "diagnostics: " + result.diagnostics());
    assertEquals(0, result.diagnostics().size(), () -> "diagnostics: " + result.diagnostics());
    assertInstanceOf(MdyDynamicDaterangeField.class, result.fields().get(0));
    MdyDynamicFileField file = assertInstanceOf(MdyDynamicFileField.class, result.fields().get(1));
    assertEquals(".pdf", file.accept());
    assertEquals(Boolean.TRUE, file.multiple());
    MdyDynamicColorsField colors = assertInstanceOf(MdyDynamicColorsField.class, result.fields().get(2));
    assertEquals(
        new ObjectMapper().readTree("[\"#4361ee\",{\"value\":\"#e63946\",\"label\":\"Signal red\"}]"),
        new ObjectMapper().valueToTree(colors.presets()));
  }

  /** A schema leaf takes its name from its path, and keeps the members of its kind while doing so. */
  @Test
  void schemaLeavesOfTheNewKindsKeepTheirMembers() {
    String json = """
        {"version":2,"schema":{"node":"group","children":{
          "stay":{"node":"field","field":{"kind":"daterange"}},
          "cv":{"node":"field","field":{"kind":"file","accept":".pdf"}},
          "brand":{"node":"field","field":{"kind":"colors","presets":["#4361ee"]}}
        }}}
        """;
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);

    assertTrue(result.ok(), () -> "diagnostics: " + result.diagnostics());
    Map<String, MdyDynamicField> byName = new TreeMap<>();
    for (MdyDynamicField field : result.fields()) byName.put(field.name(), field);
    assertInstanceOf(MdyDynamicDaterangeField.class, byName.get("stay"));
    assertEquals(".pdf", assertInstanceOf(MdyDynamicFileField.class, byName.get("cv")).accept());
    assertEquals(List.of("#4361ee"), assertInstanceOf(MdyDynamicColorsField.class, byName.get("brand")).presets());
  }

  /** A section nested {@code depth} levels deep, its innermost one holding field {@code a}. */
  private static String layoutNestedTo(int depth) {
    String node = "\"a\"";
    for (int level = depth; level >= 1; level--) {
      node = "{\"kind\":\"section\",\"id\":\"s" + level + "\",\"children\":[" + node + "]}";
    }
    return "{\"version\":2,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"}],\"layout\":[" + node + "]}";
  }

  /** The same cap the TS and Rust readers apply, on both sides of it. */
  @Test
  void nestsLayoutToThirtyTwoLevelsAndNoFurther() {
    MdyDynamicFormParseResult atCap = parser.parse(layoutNestedTo(32), MdyDynamicFormParser.Mode.STRICT);
    assertTrue(atCap.ok(), () -> "32 levels, diagnostics: " + atCap.diagnostics());

    MdyDynamicFormParseResult pastCap = parser.parse(layoutNestedTo(33), MdyDynamicFormParser.Mode.STRICT);
    assertFalse(pastCap.ok(), "33 levels was accepted");
    MdyDynamicDiagnostic refusal = pastCap.diagnostics().get(0);
    assertEquals("MDY_DYNAMIC_INVALID_LAYOUT", refusal.code());
    assertEquals("/layout/0", refusal.path());
    assertEquals("layout nests deeper than 32 levels.", refusal.message());
  }

  /** The first diagnostic of a v3 document whose one layout node is {@code node}, over fields a and b. */
  private MdyDynamicDiagnostic layoutRefusal(String node) {
    return layoutRefusal(3, node);
  }

  /** The first diagnostic of a document of {@code version} whose one layout node is {@code node}. */
  private MdyDynamicDiagnostic layoutRefusal(int version, String node) {
    MdyDynamicFormParseResult result = parser.parse(layoutDocument(version, node), MdyDynamicFormParser.Mode.STRICT);
    assertFalse(result.ok(), () -> "accepted: " + node);
    return result.diagnostics().get(0);
  }

  private static String layoutDocument(int version, String node) {
    return "{\"version\":" + version + ",\"fields\":[{\"name\":\"a\",\"kind\":\"text\"},{\"name\":\"b\",\"kind\":\"text\"}],"
        + "\"layout\":[" + node + "]}";
  }

  /**
   * Placement arrived with v3, a row's track counts are bounded, and a top-level section has no
   * column to be placed in — each refused with the code the TS reader gives it.
   */
  @Test
  void layoutPlacementIsGatedByVersionAndBounded() {
    String slot = "{\"kind\":\"columns\",\"id\":\"c\",\"columns\":[[\"a\"],[{\"ref\":\"b\",\"at\":{\"sm\":{\"column\":2}}}]]}";
    String placedSection = "{\"kind\":\"columns\",\"id\":\"c\",\"columns\":[[\"a\"],"
        + "[{\"kind\":\"section\",\"id\":\"in\",\"children\":[\"b\"],\"at\":{\"base\":{\"column\":2}}}]]}";
    // Below v3 a slot and a section's `at` are a version refusal, even when the placement is valid.
    MdyDynamicDiagnostic v2Slot = layoutRefusal(2, slot);
    assertEquals("MDY_DYNAMIC_UNSUPPORTED_VERSION", v2Slot.code());
    assertEquals("layout uses a placement this document's version (2) precedes; it needs version 3.", v2Slot.message());
    assertEquals("MDY_DYNAMIC_UNSUPPORTED_VERSION", layoutRefusal(2, placedSection).code());
    // From v3 on, the same nodes are accepted.
    assertTrue(parser.parse(layoutDocument(3, slot), MdyDynamicFormParser.Mode.STRICT).ok());
    assertTrue(parser.parse(layoutDocument(4, placedSection), MdyDynamicFormParser.Mode.STRICT).ok());

    // A row's track counts: an object keyed by size, each an integer from 1 to 12, at any version.
    String shape = "MDY_DYNAMIC_INVALID_LAYOUT";
    String row = "{\"kind\":\"columns\",\"id\":\"c\",\"columns\":[[\"a\"],[\"b\"]],\"at\":";
    assertEquals(shape, layoutRefusal(2, row + "3}").code());
    assertEquals(shape, layoutRefusal(row + "{\"xl\":2}}").code());
    assertEquals(shape, layoutRefusal(row + "{\"md\":0}}").code());
    assertEquals(shape, layoutRefusal(row + "{\"md\":13}}").code());
    assertEquals(shape, layoutRefusal(row + "{\"md\":\"4\"}}").code());
    assertEquals(shape, layoutRefusal(row + "null}").code());
    assertTrue(parser.parse(layoutDocument(2, row + "{\"md\":12}}"), MdyDynamicFormParser.Mode.STRICT).ok());
    // The widest count is the ceiling a slot may name.
    assertTrue(parser.parse(layoutDocument(3, "{\"kind\":\"columns\",\"id\":\"c\",\"at\":{\"md\":4},"
        + "\"columns\":[[\"a\"],[{\"ref\":\"b\",\"at\":{\"md\":{\"column\":4}}}]]}"), MdyDynamicFormParser.Mode.STRICT).ok());

    // An explicit null placement is written wrong, not left out.
    assertEquals("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE",
        layoutRefusal("{\"kind\":\"columns\",\"id\":\"c\",\"columns\":[[{\"ref\":\"a\",\"at\":null}]]}").code());

    // A section at the top of the layout occupies no column, whatever version or value it carries.
    MdyDynamicDiagnostic top = layoutRefusal(2, "{\"kind\":\"section\",\"id\":\"s\",\"children\":[\"a\"],\"at\":{\"base\":{\"hidden\":true}}}");
    assertEquals(shape, top.code());
    assertEquals("a section at the top of the layout occupies no column and cannot be placed.", top.message());

    // A whole number written with a fraction is the same JSON number, as for Number.isInteger.
    assertTrue(parser.parse(layoutDocument(3, "{\"kind\":\"columns\",\"id\":\"c\",\"at\":{\"md\":4.0},"
        + "\"columns\":[[\"a\"],[{\"ref\":\"b\",\"at\":{\"md\":{\"column\":4.0}}}]]}"), MdyDynamicFormParser.Mode.STRICT).ok());
    assertEquals(shape, layoutRefusal(row + "{\"md\":2.5}}").code());
  }

  /** A version this contract does not have is refused as a version, with nothing read. */
  @Test
  void anUnsupportedVersionIsRefusedAsAVersion() {
    String field = "[{\"name\":\"email\",\"kind\":\"email\"}]";
    MdyDynamicFormParseResult one = parser.parse("{\"version\":1,\"fields\":" + field + "}", MdyDynamicFormParser.Mode.LENIENT);
    assertFalse(one.ok());
    assertEquals(null, one.version());
    assertEquals(0, one.fields().size());
    assertEquals(1, one.diagnostics().size());
    MdyDynamicDiagnostic refusal = one.diagnostics().get(0);
    assertEquals("MDY_DYNAMIC_UNSUPPORTED_VERSION", refusal.code());
    assertEquals("/version", refusal.path());
    assertEquals("Unsupported dynamic form config version 1 — this contract has versions 2, 3, 4 and 5, and "
        + "nothing in this document was read. Version 1 was read by this runtime alone and is no longer "
        + "supported — set \"version\": 2, which reads the same fields.", refusal.message());

    // Any other value, in either envelope and in a document with neither, says it does not know the publisher.
    for (String version : List.of("6", "6.0", "2.5", "\"2\"", "null")) {
      for (String rest : List.of(",\"fields\":" + field, ",\"schema\":{\"node\":\"group\",\"children\":{}}", "")) {
        MdyDynamicFormParseResult result = parser.parse("{\"version\":" + version + rest + "}", MdyDynamicFormParser.Mode.LENIENT);
        assertEquals(1, result.diagnostics().size(), version + rest);
        MdyDynamicDiagnostic diagnostic = result.diagnostics().get(0);
        assertEquals("MDY_DYNAMIC_UNSUPPORTED_VERSION", diagnostic.code(), version + rest);
        assertEquals("Unsupported dynamic form config version " + ("6.0".equals(version) ? "6" : version)
            + " — this contract has versions 2, 3, 4 and 5, and nothing in this document was read. "
            + "The document is from a publisher this reader does not know.", diagnostic.message());
      }
    }

    // Every version the contract has reads a flat envelope, and 2.0 is version 2.
    for (String version : List.of("2", "3", "4", "5", "2.0")) {
      MdyDynamicFormParseResult result = parser.parse("{\"version\":" + version + ",\"fields\":" + field + "}", MdyDynamicFormParser.Mode.STRICT);
      assertTrue(result.ok(), () -> version + ": " + result.diagnostics());
      assertEquals(1, result.fields().size());
    }
  }

  /**
   * The refusal quotes an unknown version as {@code JSON.stringify} writes it; every expected text is
   * what the TS reader's message carries for the same declared value.
   */
  @Test
  void anUnknownVersionIsQuotedAsTheTsReaderQuotesIt() {
    String[][] cases = {
        {"1e21", "1e+21"}, {"1e20", "100000000000000000000"}, {"123456789012345678901", "123456789012345680000"},
        {"12345678901234567890", "12345678901234567000"}, {"9007199254740993", "9007199254740992"},
        {"4294967298", "4294967298"}, {"2.5e-7", "2.5e-7"}, {"0.000001", "0.000001"}, {"0.0000001", "1e-7"},
        {"1.5e300", "1.5e+300"}, {"1.7976931348623157e308", "1.7976931348623157e+308"}, {"5e-324", "5e-324"},
        {"1e400", "null"}, {"-1e400", "null"}, {"-0", "0"}, {"0.0", "0"}, {"0.1", "0.1"}, {"-3.75", "-3.75"},
        {"100.25e3", "100250"}, {"5.940911144672375e-213", "5.940911144672375e-213"}, {"7.00000000000000001", "7"},
        {"\"a\\u0001b\"", "\"a\\u0001b\""}, {"\"\\b\\f\\n\\r\\t\"", "\"\\b\\f\\n\\r\\t\""},
        {"\"\\u001f\\u007f\"", "\"\\u001f\u007f\""}, {"\"q\\\"\\\\/\"", "\"q\\\"\\\\/\""},
        {"\"\\u2028\\u2029\"", "\"\u2028\u2029\""}, {"\"\\ud800\"", "\"\\ud800\""}, {"\"\\udc00x\"", "\"\\udc00x\""},
        {"\"\\ud83d\\ude00\"", "\"\ud83d\ude00\""}, {"\"é€\"", "\"é€\""},
        {"true", "true"}, {"false", "false"}, {"[]", "[]"}, {"{}", "{}"},
        {"[1.0, 2.5e-7, \"x\"]", "[1,2.5e-7,\"x\"]"},
        {"{\"b\":1,\"2\":1,\"1\":1,\"a\":[1e21]}", "{\"1\":1,\"2\":1,\"b\":1,\"a\":[1e+21]}"},
        {"{\"01\":1,\"10\":1,\"9\":1,\"4294967295\":1,\"4294967294\":1,\"-1\":1}",
            "{\"9\":1,\"10\":1,\"4294967294\":1,\"01\":1,\"4294967295\":1,\"-1\":1}"},
        {"{\"a\":1,\"a\":2}", "{\"a\":2}"}, {"[[{\"x\":null}]]", "[[{\"x\":null}]]"},
    };
    for (String[] c : cases) {
      MdyDynamicFormParseResult result = parser.parse("{\"version\":" + c[0] + ",\"fields\":[]}", MdyDynamicFormParser.Mode.LENIENT);
      assertEquals(1, result.diagnostics().size(), c[0]);
      assertEquals("Unsupported dynamic form config version " + c[1] + " — this contract has versions 2, 3, 4 and 5, "
          + "and nothing in this document was read. The document is from a publisher this reader does not know.",
          result.diagnostics().get(0).message(), c[0]);
    }
  }

  /** An envelope that lists fields and declares no version is refused with a reason, in both modes. */
  @Test
  void anEnvelopeWithoutAVersionSaysTheVersionIsMissing() {
    String unversioned = "{\"fields\":[{\"name\":\"a\",\"kind\":\"text\"},{\"name\":\"b\",\"kind\":\"text\"}],"
        + "\"schema\":{\"node\":\"group\",\"children\":{}},\"layout\":\"x\",\"validations\":[]}";
    for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
      MdyDynamicFormParseResult result = parser.parse(unversioned, mode);
      assertFalse(result.ok(), mode.name());
      assertEquals(null, result.version());
      assertEquals(0, result.fields().size());
      assertEquals(0, result.acceptedCount());
      assertEquals(2, result.rejectedCount());
      assertEquals(List.of("/fields", "/layout", "/validations"),
          result.diagnostics().stream().map(MdyDynamicDiagnostic::path).toList());
      assertTrue(result.diagnostics().stream().allMatch(d -> d.code().equals("MDY_DYNAMIC_UNSUPPORTED_VERSION")));
      assertEquals("Unsupported dynamic form config version undefined — this contract has versions 2, 3, 4 and 5.",
          result.diagnostics().get(0).message());
      assertEquals("Unsupported dynamic form config version for \"layout\": a document that declares no version "
          + "reads fields and nothing else. Set \"version\": 2 to use it.", result.diagnostics().get(1).message());
    }
    assertEquals(0, parser.parse("{\"fields\":null}", MdyDynamicFormParser.Mode.STRICT).rejectedCount());
  }

  /** A lenient read keeps what it could read, and an error still withdraws `ok`. */
  @Test
  void aLenientErrorIsNotOk() {
    MdyDynamicFormParseResult result = parser.parse(
        "{\"version\":2,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"}],\"layout\":\"x\"}", MdyDynamicFormParser.Mode.LENIENT);
    assertFalse(result.ok());
    assertEquals(1, result.fields().size());
    assertEquals("/layout", result.diagnostics().get(0).path());
  }

  /** A document with no field list to read gets the one refusal the TypeScript reader gives it. */
  @Test
  void aDocumentWithNoFieldListIsRefusedAtFields() {
    java.util.Map<String, Integer> versions = new java.util.LinkedHashMap<>();
    for (String document : List.of("null", "5", "\"x\"", "true", "{}", "{\"schema\":{\"node\":\"group\",\"children\":{}}}")) {
      versions.put(document, null);
    }
    versions.put("{\"version\":2}", 2);
    versions.put("{\"version\":3,\"fields\":\"x\"}", 3);
    versions.put("{\"version\":2,\"fields\":null}", 2);
    versions.forEach((document, version) -> {
      for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
        MdyDynamicFormParseResult result = parser.parse(document, mode);
        assertFalse(result.ok(), document + " " + mode);
        assertEquals(version, result.version(), document);
        assertEquals(1, result.diagnostics().size(), () -> document + ": " + result.diagnostics());
        MdyDynamicDiagnostic refusal = result.diagnostics().get(0);
        assertEquals("MDY_DYNAMIC_INVALID_FIELD", refusal.code(), document);
        assertEquals("/fields", refusal.path(), document);
        assertEquals("Dynamic form config is neither a field array nor a config envelope.", refusal.message());
      }
    });
  }

  /** {@code integer} arrived with v5; an earlier document carrying it is refused at the rule. */
  @Test
  void integerIsGatedByTheVersionItArrivedWith() {
    String seats = "{\"name\":\"seats\",\"kind\":\"number\",\"validators\":{\"integer\":true}}";
    for (String document : List.of("{\"version\":4,\"fields\":[" + seats + "]}", "[" + seats + "]")) {
      MdyDynamicFormParseResult result = parser.parse(document, MdyDynamicFormParser.Mode.STRICT);
      assertFalse(result.ok(), document);
      MdyDynamicDiagnostic refusal = result.diagnostics().get(0);
      assertEquals("MDY_DYNAMIC_UNSUPPORTED_VERSION", refusal.code());
      assertEquals("/fields/0/validators/integer", refusal.path());
      assertEquals("Unsupported dynamic form config version for \"integer\": it arrived with version 5, and this "
          + "document says " + result.version() + ". Set \"version\": 5 to use it.", refusal.message());
    }
    String tree = "\"schema\":{\"node\":\"group\",\"children\":{\"seats\":{\"node\":\"field\",\"field\":"
        + "{\"kind\":\"number\",\"validators\":{\"integer\":false}}}}}}";
    assertEquals("/schema/children/seats/field/validators/integer",
        parser.parse("{\"version\":3," + tree, MdyDynamicFormParser.Mode.STRICT).diagnostics().get(0).path());
    assertTrue(parser.parse("{\"version\":5," + tree, MdyDynamicFormParser.Mode.STRICT).ok());
    assertTrue(parser.parse("{\"version\":5,\"fields\":[" + seats + "]}", MdyDynamicFormParser.Mode.STRICT).ok());
  }

  private List<String> pathsOf(String document, String code) {
    return parser.parse(document, MdyDynamicFormParser.Mode.LENIENT).diagnostics().stream()
        .filter(d -> d.code().equals(code)).map(MdyDynamicDiagnostic::path).sorted().toList();
  }

  /** A child key carrying "/" or "~" is one segment, escaped as an RFC 6901 token, as TS writes it. */
  @Test
  void aChildKeyIsOneEscapedPointerSegment() {
    assertEquals(List.of("/schema/children/a~1b", "/schema/children/x~01"),
        pathsOf("{\"version\":5,\"schema\":{\"node\":\"group\",\"children\":{\"a/b\":{\"node\":\"group\"},"
            + "\"x~1\":{\"node\":\"group\"}}}}", "MDY_DYNAMIC_INVALID_GROUP"));
  }

  /** A null `integer` declares no rule, so the version has nothing to refuse, in a list and a tree alike. */
  @Test
  void aNullIntegerIsNotAVersionFinding() {
    String field = "{\"name\":\"n\",\"kind\":\"number\",\"label\":\"N\",\"validators\":{\"integer\":null}}";
    for (String document : List.of("{\"version\":4,\"id\":\"f\",\"fields\":[" + field + "]}",
        "{\"version\":4,\"id\":\"f\",\"schema\":{\"node\":\"group\",\"children\":{\"n\":{\"node\":\"field\",\"field\":"
            + field + "}}}}")) {
      assertEquals(List.of(), pathsOf(document, "MDY_DYNAMIC_UNSUPPORTED_VERSION"));
    }
  }

  /** The integer gate points where the field was written: its list index, or its tree declaration. */
  @Test
  void integerGatePointsWhereTheFieldWasWritten() {
    String n = "{\"name\":\"n\",\"kind\":\"number\",\"validators\":{\"integer\":true}}";
    assertEquals(List.of("/fields/1/validators/integer"),
        pathsOf("{\"version\":4,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"}," + n + "," + n + "]}",
            "MDY_DYNAMIC_UNSUPPORTED_VERSION"));
    String leaf = "{\"node\":\"field\",\"field\":{\"kind\":\"number\",\"validators\":{\"integer\":true}}}";
    assertEquals(List.of("/schema/children/a~1b/children/seats/field/validators/integer"),
        pathsOf("{\"version\":4,\"schema\":{\"node\":\"group\",\"children\":{\"a/b\":{\"node\":\"group\","
            + "\"children\":{\"seats\":" + leaf + "}}}}}", "MDY_DYNAMIC_UNSUPPORTED_VERSION"));
    assertEquals(List.of("/schema/children/rows/item/children/seats/field/validators/integer"),
        pathsOf("{\"version\":4,\"schema\":{\"node\":\"group\",\"children\":{\"rows\":{\"node\":\"array\","
            + "\"initialValue\":[{},{},{}],\"item\":{\"node\":\"group\",\"children\":{\"seats\":" + leaf + "}}}}}}",
            "MDY_DYNAMIC_UNSUPPORTED_VERSION"));
  }

  /** A collection with no rows still declares its template, so the template's integer is refused. */
  @Test
  void integerGateReadsATemplateWithNoRows() {
    String leaf = "{\"node\":\"field\",\"field\":{\"kind\":\"number\",\"validators\":{\"integer\":true}}}";
    String document = "{\"version\":4,\"schema\":{\"node\":\"group\",\"children\":{"
        + "\"rows\":{\"node\":\"array\",\"item\":{\"node\":\"group\",\"children\":{\"seats\":" + leaf + "}}},"
        + "\"byKey\":{\"node\":\"record\",\"item\":" + leaf + "}}}}";
    assertEquals(List.of("/schema/children/byKey/item/field/validators/integer",
        "/schema/children/rows/item/children/seats/field/validators/integer"),
        pathsOf(document, "MDY_DYNAMIC_UNSUPPORTED_VERSION"));
    assertFalse(parser.parse(document, MdyDynamicFormParser.Mode.STRICT).ok());
  }

  /** Each nested layout refusal carries the code the TS and Rust readers give the same cause. */
  @Test
  void layoutRefusalsNameTheirCause() {
    String shape = "MDY_DYNAMIC_INVALID_LAYOUT";
    String reference = "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE";
    // Shape: an unknown kind, a missing id, children that are not an array, a column that is not
    // an array, a nested node that is not an object, a section placed outside the columns it has.
    assertEquals(shape, layoutRefusal("{\"kind\":\"grid\",\"id\":\"g\",\"children\":[\"a\"]}").code());
    assertEquals(shape, layoutRefusal("{\"kind\":\"section\",\"children\":[\"a\"]}").code());
    assertEquals(shape, layoutRefusal("{\"kind\":\"section\",\"id\":\"s\",\"children\":\"a\"}").code());
    assertEquals(shape, layoutRefusal("{\"kind\":\"columns\",\"id\":\"c\",\"columns\":[\"a\"]}").code());
    assertEquals(shape, layoutRefusal("{\"kind\":\"section\",\"id\":\"s\",\"children\":[7]}").code());
    assertEquals(shape, layoutRefusal("{\"kind\":\"columns\",\"id\":\"c\",\"columns\":[[\"a\"],"
        + "[{\"kind\":\"section\",\"id\":\"in\",\"children\":[\"b\"],\"at\":{\"base\":{\"column\":5}}}]]}").code());
    assertEquals("layout node has an invalid shape.",
        layoutRefusal("{\"kind\":\"section\",\"id\":\"s\",\"children\":[7]}").message());
    // Reference: an unknown name, a name placed twice, and a slot whose placement the row cannot
    // honour — the TS reader files every slot failure under reference.
    assertEquals(reference, layoutRefusal("{\"kind\":\"section\",\"id\":\"s\",\"children\":[\"z\"]}").code());
    assertEquals(reference, layoutRefusal("{\"kind\":\"section\",\"id\":\"s\",\"children\":[\"a\",\"a\"]}").code());
    assertEquals(reference, layoutRefusal("{\"kind\":\"columns\",\"id\":\"c\",\"columns\":[[{\"ref\":\"a\",\"at\":{\"base\":{\"column\":5}}}]]}").code());
    // A shape failure deep inside a valid parent keeps its own cause rather than the parent's.
    assertEquals(shape, layoutRefusal("{\"kind\":\"section\",\"id\":\"s\",\"children\":[\"a\",{\"kind\":\"section\",\"id\":\"t\"}]}").code());
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
    assertEquals(0, result.fields().size(), "strict mode returns no fields at all when a field was refused");
    assertEquals(1, result.diagnostics().size());
    MdyDynamicDiagnostic dropped = result.diagnostics().get(0);
    assertEquals("MDY_DYNAMIC_INVALID_FIELD", dropped.code());
    assertEquals(MdyDynamicDiagnostic.ERROR, dropped.severity());
    assertEquals("/fields/1", dropped.path());
    assertEquals("Dropped dynamic field without a name: {\"name\":\"\",\"kind\":\"text\"}", dropped.message());
    assertEquals(1, result.acceptedCount(), "the counts say what the document declared and what was read, even when strict withholds it");
    assertEquals(1, result.rejectedCount());
  }

  /**
   * A dropped field is a loss, and the TypeScript reader grades every loss an error: the result is
   * not {@code ok} in lenient mode either, and what it withdraws is only the claim that nothing was
   * lost — the fields it could read are still there.
   */
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

    assertFalse(result.ok(), "a dropped field is an error, so the lenient result is not ok, as parseDynamicForm() answers");
    assertEquals(1, result.fields().size());
    assertEquals("ok", result.fields().get(0).name());
    assertEquals(
        List.of(
            "error MDY_DYNAMIC_UNSAFE_NAME /fields/1",
            "error MDY_DYNAMIC_UNKNOWN_KIND /fields/2",
            "error MDY_DYNAMIC_OPTIONS_REQUIRED /fields/3"),
        result.diagnostics().stream().map(d -> d.severity() + " " + d.code() + " " + d.path()).toList());
    assertEquals(1, result.acceptedCount());
    assertEquals(3, result.rejectedCount());
  }

  /**
   * A name passes the whole of the TS name rule, in its order, with its code and sentence; every
   * expected text is what the TS reader says for the same document.
   */
  @Test
  void aFieldNameIsHeldToEveryRuleTheTypeScriptReaderHoldsItTo() throws IOException {
    String[][] cases = {
        {"a​b", "MDY_DYNAMIC_INVALID_FIELD", "Dropped dynamic field \"a​b\": the name carries a character that cannot be seen, so two names that read the same would be two different fields."},
        {"a\u001Cb", "MDY_DYNAMIC_INVALID_FIELD", "Dropped dynamic field \"a\\u001cb\": the name carries a character that cannot be seen, so two names that read the same would be two different fields."},
        {"x".repeat(513), "MDY_DYNAMIC_PATH_TOO_LONG", "Dropped a dynamic field whose path is 513 characters, past the 512 a path may be: a path is the payload key, the draft key and the widget id, and every read of the value carries it."},
        {"toString", "MDY_DYNAMIC_INVALID_FIELD", "Dropped dynamic field \"toString\": a form's value is an object, so this name shadows the method every string conversion of that value goes through, and `${value}` then throws."},
        {"x.toString", "MDY_DYNAMIC_UNSAFE_NAME", "Dropped dynamic field \"x.toString\": name is reserved or contains forbidden path separators."},
        {"a__b", "MDY_DYNAMIC_INVALID_FIELD", "Dropped dynamic field \"a__b\": \"__\" separates the segments of a generated id, so this name would collide with another field's parts."},
        {"a b", "MDY_DYNAMIC_INVALID_FIELD", "Dropped dynamic field \"a b\": a widget id is built from this name, and whitespace splits an id reference into several, each resolving to nothing — so the control would have no accessible name."},
        // The sentence quotes the name, so a name that reads like another refusal keeps its own code.
        {"a path may be", "MDY_DYNAMIC_INVALID_FIELD", "Dropped dynamic field \"a path may be\": a widget id is built from this name, and whitespace splits an id reference into several, each resolving to nothing — so the control would have no accessible name."},
    };
    ObjectMapper json = new ObjectMapper();
    for (String[] c : cases) {
      String doc = "{\"version\":2,\"fields\":[{\"name\":" + json.writeValueAsString(c[0]) + ",\"kind\":\"text\"},{\"name\":\"keep\",\"kind\":\"text\"}]}";
      for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
        MdyDynamicFormParseResult result = parser.parse(doc, mode);
        assertFalse(result.ok(), c[1]);
        assertEquals(1, result.acceptedCount(), c[1]);
        assertEquals(1, result.rejectedCount(), c[1]);
        MdyDynamicDiagnostic refusal = only(result);
        assertEquals(c[1], refusal.code(), c[2]);
        assertEquals("/fields/0", refusal.path(), c[2]);
        assertEquals(c[2], refusal.message());
      }
    }
    // Names that only look close are read: 512 characters, a trailing underscore, `valueOf`.
    for (String fine : List.of("x".repeat(512), "a_", "valueOf")) {
      String doc = "{\"version\":2,\"fields\":[{\"name\":" + json.writeValueAsString(fine) + ",\"kind\":\"text\"}]}";
      assertTrue(parser.parse(doc, MdyDynamicFormParser.Mode.STRICT).ok(), fine);
    }
    // A tree's child name and a record's row key are held to the same rule.
    MdyDynamicDiagnostic child = only(parser.parse("{\"version\":4,\"schema\":{\"node\":\"group\",\"children\":{\"a b\":"
        + "{\"node\":\"field\",\"field\":{\"kind\":\"text\"}}}}}", MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_UNSAFE_NAME", child.code());
    assertEquals("/schema/children/a b", child.path());
    MdyDynamicDiagnostic row = only(parser.parse("{\"version\":4,\"schema\":{\"node\":\"group\",\"children\":{\"r\":{\"node\":\"record\","
        + "\"item\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"}},\"initialValue\":{\"a__b\":\"v\"}}}}}", MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_UNSAFE_NAME", row.code());
    assertEquals("/schema/children/r/initialValue/a__b", row.path());
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
    assertEquals(
        new MdyDynamicDiagnostic("MDY_DYNAMIC_DUPLICATE_NAME", MdyDynamicDiagnostic.ERROR, "/fields/1",
            "Dropped duplicate dynamic field name \"dup\"."),
        result.diagnostics().get(0));
  }

  /**
   * Every refusal of a flat field, in the TypeScript reader's code, severity, path and words. The
   * value a sentence quotes is spelled as JavaScript spells it — {@code JSON.stringify} for an entry,
   * {@code String()} for a kind — so a host matching on the message meets one sentence from both.
   */
  @Test
  void aDroppedFieldIsGradedAsTheTypeScriptReaderGradesIt() {
    record Case(String entry, String code, String path, String message) {}
    List<Case> cases = List.of(
        new Case("null", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped non-object dynamic field: null"),
        new Case("7.0", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped non-object dynamic field: 7"),
        new Case("\"x\"", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped non-object dynamic field: \"x\""),
        new Case("[1,{\"a\":2.5}]", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field without a name: [1,{\"a\":2.5}]"),
        new Case("{\"kind\":\"text\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field without a name: {\"kind\":\"text\"}"),
        new Case("{\"name\":5,\"kind\":\"text\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field without a name: {\"name\":5,\"kind\":\"text\"}"),
        new Case("{\"name\":\"a.b\",\"kind\":\"text\"}", "MDY_DYNAMIC_UNSAFE_NAME", "/fields/1", "Dropped dynamic field \"a.b\": name is reserved or contains forbidden path separators."),
        new Case("{\"name\":\"__proto__\",\"kind\":\"text\"}", "MDY_DYNAMIC_UNSAFE_NAME", "/fields/1", "Dropped dynamic field \"__proto__\": name is reserved or contains forbidden path separators."),
        new Case("{\"name\":\"k\",\"kind\":\"Text\"}", "MDY_DYNAMIC_UNKNOWN_KIND", "/fields/1", "Dropped dynamic field \"k\" with unknown kind \"Text\"."),
        new Case("{\"name\":\"k\"}", "MDY_DYNAMIC_UNKNOWN_KIND", "/fields/1", "Dropped dynamic field \"k\" with unknown kind \"undefined\"."),
        new Case("{\"name\":\"k\",\"kind\":null}", "MDY_DYNAMIC_UNKNOWN_KIND", "/fields/1", "Dropped dynamic field \"k\" with unknown kind \"null\"."),
        new Case("{\"name\":\"k\",\"kind\":3.0}", "MDY_DYNAMIC_UNKNOWN_KIND", "/fields/1", "Dropped dynamic field \"k\" with unknown kind \"3\"."),
        new Case("{\"name\":\"k\",\"kind\":[\"a\",null,2]}", "MDY_DYNAMIC_UNKNOWN_KIND", "/fields/1", "Dropped dynamic field \"k\" with unknown kind \"a,,2\"."),
        new Case("{\"name\":\"k\",\"kind\":{\"a\":1}}", "MDY_DYNAMIC_UNKNOWN_KIND", "/fields/1", "Dropped dynamic field \"k\" with unknown kind \"[object Object]\"."),
        new Case("{\"name\":\"m\",\"kind\":\"text\",\"validators\":{\"messages\":5}}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"m\": validators.messages must be an object."),
        new Case("{\"name\":\"m\",\"kind\":\"text\",\"validators\":{\"messages\":null}}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"m\": validators.messages must be an object."),
        new Case("{\"name\":\"m\",\"kind\":\"text\",\"validators\":{\"messages\":{\"required\":\"ok\",\"nope\":\"x\"}}}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"m\": validators.messages names \"nope\", which is not a rule a field declares."),
        new Case("{\"name\":\"m\",\"kind\":\"text\",\"validators\":{\"messages\":{\"required\":\"\\u00a0 \\u2007\"}}}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"m\": validators.messages.required must be a message a person can read."),
        new Case("{\"name\":\"m\",\"kind\":\"text\",\"validators\":{\"messages\":{\"min\":4}}}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"m\": validators.messages.min must be a message a person can read."),
        new Case("{\"name\":\"o\",\"kind\":\"select\"}", "MDY_DYNAMIC_OPTIONS_REQUIRED", "/fields/1", "Dropped dynamic field \"o\": kind \"select\" requires a valid options array."),
        new Case("{\"name\":\"o\",\"kind\":\"radio\",\"options\":{}}", "MDY_DYNAMIC_OPTIONS_REQUIRED", "/fields/1", "Dropped dynamic field \"o\": kind \"radio\" requires a valid options array."),
        new Case("{\"name\":\"o\",\"kind\":\"multiselect\",\"options\":[\"a\"]}", "MDY_DYNAMIC_OPTIONS_REQUIRED", "/fields/1", "Dropped dynamic field \"o\": kind \"multiselect\" requires a valid options array."),
        new Case("{\"name\":\"o\",\"kind\":\"segmented\",\"options\":[{\"value\":\"a\"}]}", "MDY_DYNAMIC_OPTIONS_REQUIRED", "/fields/1", "Dropped dynamic field \"o\": kind \"segmented\" requires a valid options array."),
        new Case("{\"name\":\"o\",\"kind\":\"select\",\"options\":[{\"value\":null,\"label\":\"A\"}]}", "MDY_DYNAMIC_OPTIONS_REQUIRED", "/fields/1", "Dropped dynamic field \"o\": kind \"select\" requires a valid options array."),
        new Case("{\"name\":\"o\",\"kind\":\"select\",\"options\":[{\"value\":\"a\",\"label\":\"A\",\"disabled\":\"yes\"}]}", "MDY_DYNAMIC_OPTIONS_REQUIRED", "/fields/1", "Dropped dynamic field \"o\": kind \"select\" requires a valid options array."),
        new Case("{\"name\":\"n\",\"kind\":\"number\",\"min\":\"1\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"n\": min must be a finite number."),
        new Case("{\"name\":\"n\",\"kind\":\"slider\",\"max\":1e400}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"n\": max must be a finite number."),
        new Case("{\"name\":\"n\",\"kind\":\"number\",\"min\":5,\"max\":4}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"n\": min cannot exceed max."),
        new Case("{\"name\":\"n\",\"kind\":\"number\",\"step\":null}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"n\": step must be a finite number."),
        new Case("{\"name\":\"n\",\"kind\":\"slider\",\"step\":0}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"n\": step must be greater than zero."),
        new Case("{\"name\":\"d\",\"kind\":\"datepicker\",\"locale\":\"en_US\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"d\": locale must be a valid BCP 47 tag, e.g. \"it-IT\"."),
        new Case("{\"name\":\"d\",\"kind\":\"timepicker\",\"locale\":7}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"d\": locale must be a valid BCP 47 tag, e.g. \"it-IT\"."),
        new Case("{\"name\":\"d\",\"kind\":\"daterange\",\"firstDayOfWeek\":7}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"d\": firstDayOfWeek must be an integer from 0 (Sunday) to 6."),
        new Case("{\"name\":\"d\",\"kind\":\"datepicker\",\"firstDayOfWeek\":1.5}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"d\": firstDayOfWeek must be an integer from 0 (Sunday) to 6."),
        new Case("{\"name\":\"d\",\"kind\":\"datepicker\",\"firstDayOfWeek\":6.0,\"minDate\":\"0099-01-01\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"d\": minDate must be an ISO date, e.g. \"2026-08-02\"."),
        new Case("{\"name\":\"d\",\"kind\":\"datepicker\",\"maxDate\":null}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"d\": maxDate must be an ISO date, e.g. \"2026-08-02\"."),
        new Case("{\"name\":\"d\",\"kind\":\"daterange\",\"minDate\":\"2026-08-02\",\"maxDate\":\"2026-08-01\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields", "Dropped dynamic field \"d\": minDate cannot be later than maxDate."),
        new Case("{\"name\":\"t\",\"kind\":\"text\",\"initialValue\":42}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"t\": initialValue does not match the kind — text holds string, got number."),
        new Case("{\"name\":\"t\",\"kind\":\"text\",\"initialValue\":null}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"t\": initialValue does not match the kind — text cannot hold null."),
        new Case("{\"name\":\"c\",\"kind\":\"checkbox\",\"initialValue\":\"yes\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"c\": initialValue does not match the kind — checkbox holds boolean, got string."),
        new Case("{\"name\":\"m\",\"kind\":\"multiselect\",\"options\":[],\"initialValue\":{\"b\":1,\"1\":2}}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"m\": initialValue does not match the kind — multiselect holds option[], got {\"1\":2,\"b\":1}."),
        new Case("{\"name\":\"d\",\"kind\":\"datepicker\",\"initialValue\":\"2026-02-30\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"d\": initialValue does not match the kind — datepicker holds an ISO date (yyyy-MM-dd), got \"2026-02-30\"."),
        new Case("{\"name\":\"d\",\"kind\":\"timepicker\",\"initialValue\":\"25:00\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"d\": initialValue does not match the kind — timepicker holds a time (HH:mm), got \"25:00\"."),
        new Case("{\"name\":\"d\",\"kind\":\"timepicker\",\"initialValue\":\"09:30\\n\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"d\": initialValue does not match the kind — timepicker holds a time (HH:mm), got \"09:30\\n\"."),
        new Case("{\"name\":\"d\",\"kind\":\"colors\",\"initialValue\":\"banana\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"d\": initialValue does not match the kind — colors holds a hex colour (#rgb or #rrggbb), got \"banana\"."),
        new Case("{\"name\":\"d\",\"kind\":\"daterange\",\"initialValue\":{\"start\":\"\",\"end\":null}}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"d\": initialValue does not match the kind — daterange holds ISO dates, and start is \"\"."),
        new Case("{\"name\":\"d\",\"kind\":\"daterange\",\"initialValue\":\"x\"}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"d\": initialValue does not match the kind — daterange holds dateRange, got string."),
        new Case("{\"name\":\"d\",\"kind\":\"number\",\"initialValue\":1e400}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"d\": initialValue does not match the kind — number holds number, got number."),
        new Case("{\"name\":\"d\",\"kind\":\"slider\",\"initialValue\":null}", "MDY_DYNAMIC_INVALID_FIELD", "/fields/1", "Dropped dynamic field \"d\": initialValue does not match the kind — slider cannot hold null."));
    for (Case c : cases) {
      for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
        MdyDynamicFormParseResult result = parser.parse("[{\"name\":\"ok\",\"kind\":\"text\"}," + c.entry() + "]", mode);
        assertFalse(result.ok(), () -> c.entry() + " in " + mode);
        assertEquals(
            List.of(new MdyDynamicDiagnostic(c.code(), MdyDynamicDiagnostic.ERROR, c.path(), c.message())),
            result.diagnostics(), () -> c.entry() + " in " + mode);
        assertEquals(1, result.acceptedCount(), () -> c.entry() + " in " + mode);
        assertEquals(1, result.rejectedCount(), () -> c.entry() + " in " + mode);
        assertEquals(mode == MdyDynamicFormParser.Mode.STRICT ? 0 : 1, result.fields().size(), () -> c.entry() + " in " + mode);
      }
    }
  }

  /**
   * A finding about part of a flat field that keeps the field, in the TypeScript reader's code, path
   * and words. Each is an error, so neither mode is {@code ok} and strict mode withholds the document;
   * the lenient field carries what the reader kept — an option whose value an earlier one holds is
   * left out, compared by value rather than by spelling.
   */
  @Test
  void aFindingThatKeepsTheFieldIsGradedAsTheTypeScriptReaderGradesIt() {
    record Finding(String code, String message) {}
    record Case(String entry, List<Finding> findings, List<String> keptLabels) {}
    String duplicate = "an option's value is its identity, so two options sharing one leave a value naming both and a control able to reach only the first.";
    List<Case> cases = List.of(
        new Case("{\"name\":\"o\",\"kind\":\"select\",\"options\":[{\"value\":\"a\",\"label\":\"A\"},{\"value\":\"a\",\"label\":\"B\"},"
            + "{\"value\":1,\"label\":\"C\"},{\"value\":\"1\",\"label\":\"D\"},{\"value\":1.0,\"label\":\"E\"}]}", List.of(
            new Finding("MDY_DYNAMIC_DUPLICATE_OPTION", "Dropped a duplicate option value \"a\" on \"o\": " + duplicate),
            new Finding("MDY_DYNAMIC_DUPLICATE_OPTION", "Dropped a duplicate option value 1 on \"o\": " + duplicate)),
            List.of("A", "C", "D")),
        new Case("{\"name\":\"o\",\"kind\":\"radio\",\"options\":[{\"value\":{\"a\":1,\"b\":[2,3]},\"label\":\"A\"},"
            + "{\"value\":{\"b\":{\"0\":2,\"1\":3},\"a\":1},\"label\":\"B\"}]}", List.of(
            new Finding("MDY_DYNAMIC_DUPLICATE_OPTION", "Dropped a duplicate option value {\"a\":1,\"b\":{\"0\":2,\"1\":3}} on \"o\": " + duplicate)),
            List.of("A")),
        new Case("{\"name\":\"t\",\"kind\":\"text\",\"required\":true,\"pattern\":\"x\"}", List.of(
            new Finding("MDY_DYNAMIC_UNKNOWN_MEMBER", "dynamic field \"t\" carries \"required\", \"pattern\", which this contract does not declare, so nothing reads it."),
            new Finding("MDY_DYNAMIC_MISPLACED_VALIDATOR", "Dynamic field \"t\" declares \"required\" on the field, and it belongs in \"validators\" — nothing reads it here, so the field has no such rule."),
            new Finding("MDY_DYNAMIC_MISPLACED_VALIDATOR", "Dynamic field \"t\" declares \"pattern\" on the field, and it belongs in \"validators\" — nothing reads it here, so the field has no such rule.")),
            null));
    for (Case c : cases) {
      for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
        MdyDynamicFormParseResult result = parser.parse("[" + c.entry() + "]", mode);
        assertFalse(result.ok(), () -> c.entry() + " in " + mode);
        assertEquals(
            c.findings().stream().map(f -> new MdyDynamicDiagnostic(f.code(), MdyDynamicDiagnostic.ERROR, "/fields/0", f.message())).toList(),
            result.diagnostics(), () -> c.entry() + " in " + mode);
        assertEquals(1, result.acceptedCount(), () -> c.entry() + " in " + mode);
        assertEquals(0, result.rejectedCount(), () -> c.entry() + " in " + mode);
        if (mode == MdyDynamicFormParser.Mode.STRICT) {
          assertEquals(0, result.fields().size(), () -> c.entry() + " in " + mode);
        } else {
          assertEquals(1, result.fields().size(), () -> c.entry() + " in " + mode);
          if (c.keptLabels() != null) {
            MdyDynamicOptionsField kept = assertInstanceOf(MdyDynamicOptionsField.class, result.fields().get(0));
            assertEquals(c.keptLabels(), kept.options().stream().map(MdySelectOption::label).toList(), c.entry());
          }
        }
      }
    }
  }

  /**
   * A member nobody declared is reported, on the field, on its validators and on each option, and
   * the field is kept: a reader may meet a document written against a contract it predates, and
   * dropping the field would turn a report into a loss. The finding is still an error — a document
   * reaching for something the contract does not do would otherwise render a form that quietly does
   * not do it — so strict mode withholds the document and neither mode is {@code ok}.
   */
  @Test
  void anUnknownMemberIsAnErrorThatKeepsTheField() {
    String json = "[{\"name\":\"u\",\"kind\":\"select\",\"somethingNew\":true,\"quo\\\"te\":1,"
        + "\"validators\":{\"required\":true,\"baz\":3},"
        + "\"options\":[{\"value\":\"a\",\"label\":\"A\",\"icon\":\"x\"},{\"value\":\"b\",\"label\":\"B\"},{\"value\":\"c\",\"label\":\"C\",\"extra\":1,\"more\":2}]}]";

    MdyDynamicFormParseResult lenient = parser.parse(json, MdyDynamicFormParser.Mode.LENIENT);
    assertFalse(lenient.ok());
    assertEquals(1, lenient.fields().size(), "the field is kept");
    assertEquals(1, lenient.acceptedCount());
    assertEquals(0, lenient.rejectedCount());
    assertEquals(
        List.of(
            new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/fields/0",
                "dynamic field \"u\" carries \"somethingNew\", \"quo\\\"te\", which this contract does not declare, so nothing reads it."),
            new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/fields/0",
                "the validators of \"u\" carries \"baz\", which this contract does not declare, so nothing reads it."),
            new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/fields/0/options/0",
                "an option of \"u\" carries \"icon\", which this contract does not declare, so nothing reads it."),
            new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/fields/0/options/2",
                "an option of \"u\" carries \"extra\", \"more\", which this contract does not declare, so nothing reads it.")),
        lenient.diagnostics());

    MdyDynamicFormParseResult strict = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);
    assertFalse(strict.ok());
    assertEquals(0, strict.fields().size(), "strict mode withholds a document with an error in it");
    assertEquals(lenient.diagnostics(), strict.diagnostics());

    // Members the contract declares for some kind are not unknown on any kind: the list is one list.
    String declaredElsewhere = "[{\"name\":\"u\",\"kind\":\"text\",\"ariaLabel\":\"a\",\"supportingText\":\"s\",\"sensitive\":true,"
        + "\"prefix\":\"p\",\"suffix\":\"s\",\"min\":1,\"max\":2,\"step\":1,\"mode\":\"multi\",\"searchable\":true,\"reorderable\":true,"
        + "\"loading\":false,\"locale\":\"it-IT\",\"firstDayOfWeek\":1,\"minDate\":\"2026-01-01\",\"maxDate\":\"2026-12-31\","
        + "\"animateHand\":true,\"showUnavailable\":true,\"accept\":\".pdf\",\"multiple\":true,\"presets\":[\"#fff\"]}]";
    assertTrue(parser.parse(declaredElsewhere, MdyDynamicFormParser.Mode.STRICT).ok());
  }

  /**
   * A finding about a list itself turns down no entry of it, so it is not a rejection; a finding
   * about an entry is one. Both are errors, so neither result is {@code ok}.
   */
  @Test
  void aFindingAboutAListItselfIsNotARejectedEntry() {
    MdyDynamicFormParseResult list = parser.parse(
        "{\"version\":3,\"fields\":[{\"name\":\"ok\",\"kind\":\"text\"}],\"layout\":{},\"rules\":1,\"validations\":\"x\"}",
        MdyDynamicFormParser.Mode.LENIENT);
    assertFalse(list.ok());
    assertEquals(List.of("/layout", "/rules", "/validations"), list.diagnostics().stream().map(MdyDynamicDiagnostic::path).toList());
    assertEquals(1, list.acceptedCount());
    assertEquals(0, list.rejectedCount());

    MdyDynamicFormParseResult entries = parser.parse(
        "{\"version\":3,\"fields\":[{\"name\":\"ok\",\"kind\":\"text\"},{\"name\":\"k\",\"kind\":\"nope\"}],\"layout\":[5],\"rules\":[null]}",
        MdyDynamicFormParser.Mode.LENIENT);
    assertEquals(List.of("/fields/1", "/layout/0", "/rules/0"), entries.diagnostics().stream().map(MdyDynamicDiagnostic::path).toList());
    assertEquals(1, entries.acceptedCount());
    assertEquals(3, entries.rejectedCount());
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

  /**
   * An options kind needs an options array every entry of which is an option — an object with a
   * value that is not null or a list, a textual label, and a boolean {@code disabled} when written.
   * An empty array has no entry to refuse and is accepted, as the TypeScript reader accepts it.
   */
  @Test
  void anOptionsKindNeedsAValidOptionsArray() {
    MdyDynamicFormParseResult missing = parser.parse("[{\"name\":\"country\",\"kind\":\"select\"}]", MdyDynamicFormParser.Mode.LENIENT);
    assertEquals(0, missing.fields().size());
    assertEquals(
        List.of(new MdyDynamicDiagnostic("MDY_DYNAMIC_OPTIONS_REQUIRED", MdyDynamicDiagnostic.ERROR, "/fields/0",
            "Dropped dynamic field \"country\": kind \"select\" requires a valid options array.")),
        missing.diagnostics());

    MdyDynamicFormParseResult unlabelled = parser.parse(
        "[{\"name\":\"country\",\"kind\":\"select\",\"options\":[{\"value\":\"it\",\"label\":\"Italy\"},{\"value\":\"fr\"}]}]",
        MdyDynamicFormParser.Mode.LENIENT);
    assertEquals(0, unlabelled.fields().size());
    assertEquals("MDY_DYNAMIC_OPTIONS_REQUIRED", unlabelled.diagnostics().get(0).code());

    MdyDynamicFormParseResult empty = parser.parse("[{\"name\":\"country\",\"kind\":\"select\",\"options\":[]}]", MdyDynamicFormParser.Mode.STRICT);
    assertTrue(empty.ok(), () -> "an empty options array is a valid options array: " + empty.diagnostics());
    assertEquals(1, empty.fields().size());

    MdyDynamicFormParseResult shapes = parser.parse(
        "[{\"name\":\"country\",\"kind\":\"select\",\"options\":[{\"value\":true,\"label\":\"A\",\"disabled\":false},{\"value\":2,\"label\":\"B\"},{\"value\":{\"id\":1},\"label\":\"C\"}]}]",
        MdyDynamicFormParser.Mode.STRICT);
    assertTrue(shapes.ok(), () -> "a boolean, a number and an object are option values: " + shapes.diagnostics());
  }

  /**
   * The two nested-collection fixtures, which this suite had never read.
   *
   * They were absent from the hand-written list rather than exempt: both parse clean here and in
   * the Rust reader. A list of names is a coverage claim nobody re-counts, which is how two
   * documents in a shared corpus stayed unread by two of its three readers.
   */
  @Test
  void acceptsTheSharedNestedCollectionFixtures() throws IOException {
    for (String name : new String[] {"keyed-rows.json", "positional-nesting.json"}) {
      MdyDynamicFormParseResult result =
          parser.parse(readV3Fixture(name), MdyDynamicFormParser.Mode.STRICT);
      assertTrue(result.ok(), () -> name + " was refused: " + result.diagnostics());
      assertEquals(3, result.version());
    }
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
    String v6 = "{\"version\":6,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"}]}";
    assertFalse(parser.parse(v6, MdyDynamicFormParser.Mode.STRICT).ok());
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
    assertEquals(
        List.of(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/fields/0",
            "dynamic field \"tags\" carries \"somethingNew\", which this contract does not declare, so nothing reads it.")),
        reported.diagnostics(), "an ignored member must be reported, never dropped in silence");
    assertEquals(1, reported.fields().size(), "and the field is kept");
    assertFalse(reported.ok());
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

  /**
   * The three shared-corpus documents about {@code validators.pattern}, answered as the TypeScript
   * reader answers them: a shape that backtracks exponentially, a source no JavaScript engine
   * compiles, and a quantified boundary — which {@code java.util.regex} would compile, and which is
   * refused here all the same because the contract's grammar is JavaScript's. The field stays in
   * lenient mode and the result is not {@code ok} in either.
   */
  @Test
  void aValidatorPatternIsRefusedAsTheTypeScriptReaderRefusesIt() throws IOException {
    record Case(String fixture, String code, String message) {
    }
    List<Case> cases = List.of(
        new Case("f-validator-pattern-catastrophic.json", "MDY_DYNAMIC_PATTERN_TOO_COSTLY",
            "Dropped validators.pattern on dynamic field \"code\": the pattern has a repeated group whose body "
                + "can be divided several ways, which backtracks exponentially."),
        new Case("r-validator-pattern-uncompilable.json", "MDY_DYNAMIC_INVALID_FIELD",
            "Dropped validators.pattern on dynamic field \"code\": \"[\" is not a regular expression this "
                + "platform can compile, so the rule never runs."),
        new Case("s-validator-pattern-quantified-boundary.json", "MDY_DYNAMIC_INVALID_FIELD",
            "Dropped validators.pattern on dynamic field \"code\": \"\\b+\" is not a regular expression this "
                + "platform can compile, so the rule never runs."));
    for (Case c : cases) {
      String json = readFixture(c.fixture());
      MdyDynamicFormParseResult strict = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);
      assertFalse(strict.ok(), c.fixture());
      assertEquals(0, strict.fields().size(), c.fixture());
      assertEquals(1, strict.diagnostics().size(), () -> c.fixture() + " " + strict.diagnostics());
      assertEquals(new MdyDynamicDiagnostic(c.code(), MdyDynamicDiagnostic.ERROR, "/fields", c.message()),
          strict.diagnostics().get(0), c.fixture());

      MdyDynamicFormParseResult lenient = parser.parse(json, MdyDynamicFormParser.Mode.LENIENT);
      assertFalse(lenient.ok(), c.fixture());
      assertEquals(1, lenient.fields().size(), c.fixture() + " keeps the field: the rule is lost, the input is not");
      assertEquals(1, lenient.acceptedCount(), c.fixture());
      assertEquals(0, lenient.rejectedCount(), c.fixture());
      assertEquals(strict.diagnostics(), lenient.diagnostics(), c.fixture());
    }
  }

  /**
   * The pattern cost gate draws its line where the TypeScript one does: a variable body repeated is
   * refused, a body pinned by a boundary the stretchy part cannot take is not, alternatives that
   * share a character are refused and ones that cannot be mistaken for each other are not.
   */
  @Test
  void thePatternCostGateDrawsTheTypeScriptLine() {
    for (String refused : List.of(
        "^(a*)*$", "^(a|ab)+$", "^([a-z]|a)*$", "^(.|x)+$", "^(a{2,4})+$", "^(a+){15}b$", "(.*a){20}$",
        "^([A-Za-z]+[0-9]*)+$", "^([^x]+[^y]+)+z$", "^(a|ab)+c$")) {
      assertTrue(withPattern(refused).diagnostics().stream().anyMatch(d -> d.code().equals("MDY_DYNAMIC_PATTERN_TOO_COSTLY")),
          () -> refused + " should be refused: " + withPattern(refused).diagnostics());
    }
    for (String allowed : List.of(
        "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", "^(\\d{1,3}\\.){3}\\d{1,3}$", "^([a-z]+-)*[a-z]+$",
        "^(\\s*[^,]+,)*\\s*[^,]+$", "^(foo|bar|baz)+$", "^([a-z]|[0-9])+$", "^(.|\\n)*$", "^(?:ab){3}$",
        "^(\"[^\"]*\",)*\"[^\"]*\"$", "^((a)|b)+$", "^(?<year>\\d{4})-(?<month>\\d{2})$")) {
      MdyDynamicFormParseResult result = withPattern(allowed);
      assertTrue(result.ok(), () -> allowed + " should be allowed: " + result.diagnostics());
    }
  }

  /**
   * Whether a pattern compiles is answered by JavaScript's grammar, not {@code java.util.regex}'s.
   * Each pair here is a source the two engines judge differently, and the verdict is the one a
   * flagless {@code new RegExp(source)} gives.
   */
  @Test
  void whetherAPatternCompilesIsAJavaScriptQuestion() {
    // java.util.regex compiles these; JavaScript has nothing to repeat or an unknown group.
    for (String uncompilable : List.of("\\b+", "^+", "(?<=a)+", "{2}", "a{2}{3}", "(?i)a", "a++", "\\Q[\\E")) {
      MdyDynamicFormParseResult result = withPattern(uncompilable);
      assertFalse(result.ok(), uncompilable);
      assertEquals("MDY_DYNAMIC_INVALID_FIELD", result.diagnostics().get(0).code(), uncompilable);
      assertTrue(result.diagnostics().get(0).message().contains("is not a regular expression this platform can compile"), uncompilable);
    }
    // java.util.regex refuses these; JavaScript reads a literal brace, an empty class, an escape.
    for (String compilable : List.of("a{,5}", "a{", "[]", "[^]", "\\0", "\\c", "\\u{41}", "[\\b]", "(?<n>a)|(?<n>b)", "\\8", "[\\d-z]")) {
      MdyDynamicFormParseResult result = withPattern(compilable);
      assertTrue(result.ok(), () -> compilable + " should compile: " + result.diagnostics());
    }
    // And the ones both refuse are refused once, with the JavaScript wording.
    for (String both : List.of("[", "(", "a)", "*a", "[z-a]", "(?<n>a)\\k<m>", "(?<n>a)(?<n>b)", "a{2,1}")) {
      MdyDynamicFormParseResult result = withPattern(both);
      assertEquals(1, result.diagnostics().size(), () -> both + " " + result.diagnostics());
      assertEquals("MDY_DYNAMIC_INVALID_FIELD", result.diagnostics().get(0).code(), both);
    }
    // A name declared twice where both groups can take part in one match is a syntax error in the
    // ECMAScript grammar (MightBothParticipate). Node 24 compiles these nested shapes; the verdict
    // here is the specification's, so on this one shape the two readers differ.
    for (String nested : List.of("(?<g1>(?<g1>a)|b)", "(?<g1>a)(?:x|(?<g1>b))")) {
      MdyDynamicFormParseResult result = withPattern(nested);
      assertFalse(result.ok(), nested);
      assertEquals("MDY_DYNAMIC_INVALID_FIELD", result.diagnostics().get(0).code(), nested);
    }
  }

  /** A pattern that is not a string, or longer than the cap, takes its field with it. */
  @Test
  void aPatternThatIsNotAStringOrIsTooLongDropsTheField() {
    MdyDynamicFormParseResult number = parser.parse(
        "{\"version\":2,\"fields\":[{\"name\":\"code\",\"kind\":\"text\",\"validators\":{\"pattern\":5}}]}",
        MdyDynamicFormParser.Mode.LENIENT);
    assertFalse(number.ok());
    assertEquals(0, number.fields().size());
    assertEquals(1, number.rejectedCount());
    assertEquals(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, "/fields",
        "Dropped dynamic field \"code\": validators.pattern must be a string."), number.diagnostics().get(0));

    MdyDynamicFormParseResult tooLong = withPattern("a".repeat(257));
    assertFalse(tooLong.ok());
    assertEquals(0, tooLong.fields().size());
    assertEquals(new MdyDynamicDiagnostic("MDY_DYNAMIC_PATTERN_TOO_LONG", MdyDynamicDiagnostic.ERROR, "/fields",
        "Dropped dynamic field \"code\": validators.pattern length exceeds max 256."), tooLong.diagnostics().get(0));
    assertTrue(withPattern("a".repeat(256)).ok(), "the cap is inclusive");
  }

  /** A lenient parse of one text field whose {@code validators.pattern} is {@code pattern}. */
  private MdyDynamicFormParseResult withPattern(String pattern) {
    com.fasterxml.jackson.databind.node.ObjectNode validators = new ObjectMapper().createObjectNode().put("pattern", pattern);
    com.fasterxml.jackson.databind.node.ObjectNode field = new ObjectMapper().createObjectNode()
        .put("name", "code").put("kind", "text");
    field.set("validators", validators);
    com.fasterxml.jackson.databind.node.ObjectNode document = new ObjectMapper().createObjectNode().put("version", 2);
    document.set("fields", new ObjectMapper().createArrayNode().add(field));
    return parser.parse(document, MdyDynamicFormParser.Mode.LENIENT);
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

  /** The one diagnostic a refused document carries, so a test can hold its every member. */
  private static MdyDynamicDiagnostic only(MdyDynamicFormParseResult result) {
    assertFalse(result.ok(), () -> "expected a refusal, got ok with " + result.diagnostics());
    assertEquals(1, result.diagnostics().size(), () -> "expected one diagnostic: " + result.diagnostics());
    return result.diagnostics().get(0);
  }

  /** {@code leaf} wrapped in {@code levels} negations, the shape that walks the depth bound. */
  private static String nested(int levels, String leaf) {
    StringBuilder open = new StringBuilder();
    StringBuilder close = new StringBuilder();
    for (int i = 0; i < levels; i++) {
      open.append("{\"op\":\"not\",\"operands\":[");
      close.append("]}");
    }
    return open + leaf + close;
  }

  /** A two-field v4 tree whose second field carries {@code when}. */
  private static String treeWithCondition(String when) {
    return "{\"version\":4,\"schema\":{\"node\":\"group\",\"children\":{"
        + "\"code\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"}},"
        + "\"note\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"},\"when\":" + when + "}}}}";
  }

  /**
   * A condition is judged by the one expression check the TypeScript reader uses, and the corpus
   * documents it refuses for shape get the TypeScript reader's words: the depth bound, an operator
   * with no operands, an operand naming two of the four things an operand can name.
   */
  @Test
  void aConditionIsJudgedAsTheTypeScriptReaderJudgesIt() throws IOException {
    MdyDynamicDiagnostic deep = only(parser.parse(readV4Fixture("a-expression-too-deep.json"), MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_INVALID_CONDITION", deep.code());
    assertEquals(MdyDynamicDiagnostic.ERROR, deep.severity());
    assertEquals("/schema/children/note/when", deep.path());
    assertTrue(deep.message().startsWith("/schema/children/note/when.operands[0]"), deep.message());
    assertTrue(deep.message().endsWith(": nests deeper than 32 levels"), deep.message());
    assertEquals(33, deep.message().split("\\.operands\\[0\\]", -1).length - 1, "the refused level is the thirty-third");

    MdyDynamicDiagnostic bare = only(parser.parse(readV4Fixture("b-expression-without-operands.json"), MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_INVALID_CONDITION", bare.code());
    assertEquals("/schema/children/note/when", bare.path());
    assertEquals("/schema/children/note/when: \"isNotEmpty\" has no operands", bare.message());

    MdyDynamicDiagnostic two = only(parser.parse(readV4Fixture("c-operand-names-two-references.json"), MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_INVALID_CONDITION", two.code());
    assertEquals("/schema/children/note/when", two.path());
    assertEquals("/schema/children/note/when.operands[0]: an operand names one of {path}, {self}, {root}, {context}, "
        + "and this one names more than one", two.message());

    // Every problem a clause has is said in one diagnostic, in reading order.
    MdyDynamicDiagnostic many = only(parser.parse(treeWithCondition(
        "{\"op\":\"nope\",\"operands\":[{\"path\":\"__proto__\"},{\"self\":1},{\"op\":\"x\"},{\"path\":\"a__b\"},{\"path\":\"a b\"}]}"), MdyDynamicFormParser.Mode.STRICT));
    assertEquals("/schema/children/note/when: unknown operator \"nope\"; "
        + "/schema/children/note/when.operands[0]: \"__proto__\" is not a field path; "
        + "/schema/children/note/when.operands[1]: an object operand must be {path}, {self}, {root}, {context} or a nested expression; "
        + "/schema/children/note/when.operands[2]: unknown operator \"x\"; "
        + "/schema/children/note/when.operands[2]: \"x\" has no operands; "
        + "/schema/children/note/when.operands[3]: \"a__b\" is not a field path; "
        + "/schema/children/note/when.operands[4]: \"a b\" is not a field path", many.message());

    // A `matches` pattern passes the gate a field's validators.pattern passes; a pattern that fails
    // both halves says both, compile verdict first. Expected texts are the TS reader's.
    String where = "/schema/children/note/when: \"matches\" pattern ";
    String divided = "a repeated group whose body can be divided several ways, which backtracks exponentially";
    String[][] patterns = {
        {"(a+)+$", where + divided},
        {"(", where + "is not a valid regular expression"},
        {"((a+)+", where + "is not a valid regular expression; " + where + divided},
        {"(a|a)*", where + "repeated alternatives that can match the same text, which backtracks exponentially"},
        {"\\\\b+", where + "is not a valid regular expression"},
    };
    for (String[] c : patterns) {
      MdyDynamicDiagnostic refused = only(parser.parse(treeWithCondition(
          "{\"op\":\"matches\",\"operands\":[{\"self\":true},\"" + c[0] + "\"]}"), MdyDynamicFormParser.Mode.STRICT));
      assertEquals("MDY_DYNAMIC_INVALID_CONDITION", refused.code(), c[0]);
      assertEquals(c[1], refused.message(), c[0]);
    }
    assertTrue(parser.parse(treeWithCondition(
        "{\"op\":\"matches\",\"operands\":[{\"self\":true},\"^[a-z]+$\"]}"), MdyDynamicFormParser.Mode.STRICT).ok());

    // An operator that is not a string is named as JavaScript's String() writes it.
    String[][] spelled = {
        {"1e21", "1e+21"}, {"9007199254740993", "9007199254740992"}, {"1e400", "Infinity"},
        {"2.5e-7", "2.5e-7"}, {"-0", "0"}, {"[1e21,null,2]", "1e+21,,2"},
    };
    for (String[] c : spelled) {
      MdyDynamicDiagnostic named = only(parser.parse(treeWithCondition(
          "{\"op\":" + c[0] + ",\"operands\":[{\"self\":true}]}"), MdyDynamicFormParser.Mode.STRICT));
      assertEquals("/schema/children/note/when: unknown operator \"" + c[1] + "\"", named.message(), c[0]);
    }
  }

  /**
   * The depth bound is thirty-two nested expressions, inclusive, and no operator written in a valid
   * shape is refused: a check that is stricter than the TypeScript reader's turns away a document
   * the runtime renders, which is the one thing a reader must not do.
   */
  @Test
  void aConditionNestedToTheBoundIsAcceptedAndOneLevelPastItIsNot() {
    String leaf = "{\"op\":\"isNotEmpty\",\"operands\":[{\"self\":true}]}";
    MdyDynamicFormParseResult atTheBound = parser.parse(treeWithCondition(nested(32, leaf)), MdyDynamicFormParser.Mode.STRICT);
    assertTrue(atTheBound.ok(), () -> String.valueOf(atTheBound.diagnostics()));
    assertEquals(2, atTheBound.fields().size());

    MdyDynamicDiagnostic pastIt = only(parser.parse(treeWithCondition(nested(33, leaf)), MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_INVALID_CONDITION", pastIt.code());
    assertTrue(pastIt.message().endsWith(": nests deeper than 32 levels"), pastIt.message());

    for (String op : new String[] {"equals", "notEquals", "isEmpty", "isNotEmpty", "lengthAtLeast", "lengthAtMost",
        "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "in", "notIn", "matches", "and", "or", "not"}) {
      String right = op.equals("matches") ? "\"^[a-z]+$\"" : op.equals("in") || op.equals("notIn") ? "{\"root\":true}" : "1";
      String when = "{\"op\":\"" + op + "\",\"operands\":[{\"path\":\"code\"}," + right + ",{\"context\":\"tier\"}]}";
      String json = "{\"version\":4,\"requiresContext\":[\"tier\"],\"schema\":{\"node\":\"group\",\"children\":{"
          + "\"code\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"}},"
          + "\"note\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"},\"when\":" + when + "}}}}";
      MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);
      assertTrue(result.ok(), () -> op + " was refused: " + result.diagnostics());
    }
  }

  /**
   * A context key a condition reads anywhere in the tree — a collection's row included — is held
   * against {@code requiresContext}, and the refusal is one diagnostic at the declaration, worded
   * as the TypeScript reader words it. The fields are still read: the declaration is wrong, not
   * the tree.
   */
  @Test
  void aRowConditionReadingUndeclaredContextIsRefusedAtTheDeclaration() throws IOException {
    MdyDynamicDiagnostic row = only(parser.parse(readV4Fixture("j-row-condition-reads-undeclared-context.json"), MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_UNDECLARED_CONTEXT", row.code());
    assertEquals(MdyDynamicDiagnostic.ERROR, row.severity());
    assertEquals("/requiresContext", row.path());
    assertEquals("conditions read context \"tier\", which this document does not declare in \"requiresContext\" — "
        + "a host cannot supply what it is not told about.", row.message());

    String two = "{\"version\":4,\"requiresContext\":[\"c\"],\"schema\":{\"node\":\"group\",\"children\":{"
        + "\"code\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"}},"
        + "\"note\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"},\"when\":{\"op\":\"and\",\"operands\":["
        + "{\"op\":\"isEmpty\",\"operands\":[{\"context\":\"b\"}]},{\"op\":\"isEmpty\",\"operands\":[{\"context\":\"a\"}]},"
        + "{\"op\":\"isEmpty\",\"operands\":[{\"context\":\"b\"}]}]}}}}}";
    MdyDynamicFormParseResult lenient = parser.parse(two, MdyDynamicFormParser.Mode.LENIENT);
    assertFalse(lenient.ok());
    assertEquals(2, lenient.fields().size(), "the tree is read; only the declaration is wrong");
    assertTrue(lenient.diagnostics().get(0).message().startsWith("conditions read context \"b\", \"a\", which"),
        lenient.diagnostics().get(0).message());
  }

  /**
   * A condition is read against what encloses the clause, so the paths it may name are the
   * enclosing group's children; inside a collection's item that is the row's own cells. A name from
   * outside is refused, and {@code { "root": true }} is how a clause reaches the whole form.
   */
  @Test
  void aConditionReadingAPathNothingEnclosesIsRefused() throws IOException {
    MdyDynamicDiagnostic stranger = only(parser.parse(readV4Fixture("q-condition-reads-a-path-nothing-encloses.json"), MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", stranger.code());
    assertEquals(MdyDynamicDiagnostic.ERROR, stranger.severity());
    assertEquals("/schema/children/note/when", stranger.path());
    assertEquals("condition reads \"missing\", which nothing encloses this clause declares — a condition is read "
        + "against what encloses it, and { \"root\": true } is how it reaches the whole form.", stranger.message());

    String rowPrefix = "{\"version\":4,\"requiresContext\":[\"tier\"],\"schema\":{\"node\":\"group\",\"children\":{"
        + "\"code\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"}},"
        + "\"lines\":{\"node\":\"array\",\"item\":{\"node\":\"group\",\"children\":{"
        + "\"sku\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"}},"
        + "\"qty\":{\"node\":\"field\",\"field\":{\"kind\":\"number\"},\"when\":";
    String rowSuffix = "}}}}}}}";
    String sibling = "{\"op\":\"and\",\"operands\":[{\"op\":\"isNotEmpty\",\"operands\":[{\"path\":\"sku\"}]},"
        + "{\"op\":\"isNotEmpty\",\"operands\":[{\"root\":true}]},{\"op\":\"equals\",\"operands\":[{\"context\":\"tier\"},\"b\"]}]}";
    MdyDynamicFormParseResult reads = parser.parse(rowPrefix + sibling + rowSuffix, MdyDynamicFormParser.Mode.STRICT);
    assertTrue(reads.ok(), () -> String.valueOf(reads.diagnostics()));

    String outer = "{\"op\":\"isNotEmpty\",\"operands\":[{\"path\":\"code\"}]}";
    MdyDynamicDiagnostic outside = only(parser.parse(rowPrefix + outer + rowSuffix, MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", outside.code());
    assertEquals("/schema/children/lines/item/children/qty/when", outside.path());
  }

  /**
   * The document's cross-field validations are read with the TypeScript reader's codes: the
   * condition goes through the same expression check a schema clause does, its target and every
   * path it reads must name something in the form, and a refused validation counts as rejected.
   */
  @Test
  void aValidationIsReadWithTheTypeScriptReadersCodes() throws IOException {
    MdyDynamicFormParseResult corpus = parser.parse(readFixture("n-validation-condition-without-operands.json"), MdyDynamicFormParser.Mode.STRICT);
    MdyDynamicDiagnostic bare = only(corpus);
    assertEquals("MDY_DYNAMIC_INVALID_VALIDATION", bare.code());
    assertEquals(MdyDynamicDiagnostic.ERROR, bare.severity());
    assertEquals("/validations/0", bare.path());
    assertEquals("/validations/0.when: \"isEmpty\" has no operands", bare.message());
    assertEquals(1, corpus.acceptedCount());
    assertEquals(1, corpus.rejectedCount());

    String prefix = "{\"version\":2,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"}],\"validations\":";
    MdyDynamicDiagnostic unknown = only(parser.parse(prefix + "[{\"message\":\"m\",\"when\":{\"op\":\"and\",\"operands\":["
        + "{\"op\":\"isEmpty\",\"operands\":[{\"path\":\"zz\"}]},{\"op\":\"isEmpty\",\"operands\":[{\"path\":\"\"}]},"
        + "{\"op\":\"isEmpty\",\"operands\":[{\"path\":\"a\"}]}]}}]}", MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", unknown.code());
    assertEquals("/validations/0", unknown.path());
    assertEquals("validation condition references unknown field(s): \"zz\", \"\" — the whole form value is { \"root\": true }.", unknown.message());

    MdyDynamicDiagnostic target = only(parser.parse(prefix + "[{\"message\":\"m\",\"target\":\"zz\",\"when\":{\"op\":\"isEmpty\",\"operands\":[{\"path\":\"a\"}]}}]}", MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", target.code());
    assertEquals("validation target references an unknown field.", target.message());

    MdyDynamicDiagnostic silent = only(parser.parse(prefix + "[{\"when\":{\"op\":\"isEmpty\",\"operands\":[{\"path\":\"a\"}]}}]}", MdyDynamicFormParser.Mode.STRICT));
    assertEquals("MDY_DYNAMIC_INVALID_VALIDATION", silent.code());
    assertEquals("validation needs a non-empty message.", silent.message());

    // A message is empty exactly when JavaScript's trim() empties it: these 25 code units, no others.
    Set<Integer> jsSpaces = Set.of(0x9, 0xA, 0xB, 0xC, 0xD, 0x20, 0xA0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004,
        0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF);
    ObjectMapper json = new ObjectMapper();
    for (int c = 0; c < 0x10000; c++) {
      String message;
      try {
        message = json.writeValueAsString(String.valueOf((char) c) + (char) c);
      } catch (IOException e) {
        throw new AssertionError(e);
      }
      MdyDynamicFormParseResult said = parser.parse(prefix + "[{\"message\":" + message
          + ",\"when\":{\"op\":\"isEmpty\",\"operands\":[{\"path\":\"a\"}]}}]}", MdyDynamicFormParser.Mode.STRICT);
      int unit = c;
      assertEquals(jsSpaces.contains(unit), !said.ok(), () -> Integer.toHexString(unit) + ": " + said.diagnostics());
    }

    MdyDynamicDiagnostic notAList = only(parser.parse(prefix + "{}}", MdyDynamicFormParser.Mode.STRICT));
    assertEquals("/validations", notAList.path());
    assertEquals("validations must be an array.", notAList.message());

    MdyDynamicFormParseResult whole = parser.parse(prefix + "[{\"message\":\"m\",\"target\":\"a\",\"when\":{\"op\":\"isEmpty\",\"operands\":[{\"root\":true}]}}]}", MdyDynamicFormParser.Mode.STRICT);
    assertTrue(whole.ok(), () -> String.valueOf(whole.diagnostics()));
  }

  /**
   * The part of a rule its operator actually reads. A membership test against a string and an
   * ordering against an object parse as rules and then answer false forever, so they are refused
   * where the value is written, with the TypeScript reader's sentence; a unary operator reads no
   * value, and one written beside it is ignored.
   */
  @Test
  void aRuleValueIsJudgedAgainstItsOperator() throws IOException {
    MdyDynamicFormParseResult corpus = parser.parse(readFixture("o-rule-membership-against-a-string.json"), MdyDynamicFormParser.Mode.STRICT);
    MdyDynamicDiagnostic membership = only(corpus);
    assertEquals("MDY_DYNAMIC_INVALID_RULE", membership.code());
    assertEquals(MdyDynamicDiagnostic.ERROR, membership.severity());
    assertEquals("/rules/0/when/value", membership.path());
    assertEquals("in tests membership of a list, and \"value\" is a string.", membership.message());
    assertEquals(1, corpus.rejectedCount());

    String prefix = "{\"version\":2,\"fields\":[{\"name\":\"a\",\"kind\":\"text\"},{\"name\":\"n\",\"kind\":\"number\"},"
        + "{\"name\":\"d\",\"kind\":\"datepicker\"}],\"rules\":[{\"effect\":\"hidden\",\"target\":\"a\",\"when\":";
    MdyDynamicDiagnostic ordering = only(parser.parse(prefix + "{\"field\":\"n\",\"operator\":\"greaterThan\",\"value\":{}}}]}", MdyDynamicFormParser.Mode.STRICT));
    assertEquals("greaterThan orders two numbers or two strings, and \"value\" is a object.", ordering.message());

    MdyDynamicDiagnostic date = only(parser.parse(prefix + "{\"field\":\"d\",\"operator\":\"lessThan\",\"value\":\"2023-2-1\"}}]}", MdyDynamicFormParser.Mode.STRICT));
    assertEquals("lessThan on a datepicker compares dates as text, so \"value\" must be a full ISO date (yyyy-MM-dd); "
        + "\"2023-2-1\" would order wrongly.", date.message());

    MdyDynamicFormParseResult ignored = parser.parse(prefix + "{\"field\":\"n\",\"operator\":\"isEmpty\",\"value\":{\"any\":1}}}]}", MdyDynamicFormParser.Mode.STRICT);
    assertTrue(ignored.ok(), () -> String.valueOf(ignored.diagnostics()));
    MdyDynamicFormParseResult list = parser.parse(prefix + "{\"field\":\"a\",\"operator\":\"in\",\"value\":[\"x\"]}}]}", MdyDynamicFormParser.Mode.STRICT);
    assertTrue(list.ok(), () -> String.valueOf(list.diagnostics()));
    assertEquals(1, list.rules().size());
  }

  /**
   * A member nobody declared is reported on every object the published schema closes — the document,
   * each layout node and slot at any depth, each rule, each validation — in the TypeScript reader's
   * code, path, sentence and order, and each such finding under a list entry counts as a rejection of
   * that entry. The subject is kept: a reader may meet a document written against a contract it
   * predates, and what is not kept is the silence.
   */
  @Test
  void anUnknownMemberIsReportedOnEverySurfaceTheContractCloses() {
    String everySurface = "{\"version\":3,\"fields\":[{\"name\":\"ok\",\"kind\":\"text\"},{\"name\":\"b\",\"kind\":\"text\",\"extra\":1}],\"extra\":1,"
        + "\"layout\":[{\"kind\":\"section\",\"id\":\"s\",\"children\":[{\"ref\":\"ok\",\"u\":1}],\"v\":1}],"
        + "\"rules\":[{\"effect\":\"visible\",\"target\":\"b\",\"when\":{\"field\":\"ok\",\"operator\":\"isEmpty\"},\"w\":1}],"
        + "\"validations\":[{\"when\":{\"op\":\"isEmpty\",\"operands\":[{\"path\":\"ok\"}]},\"message\":\"m\",\"x\":1}]}";
    List<MdyDynamicDiagnostic> expected = List.of(
        new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/fields/1",
            "dynamic field \"b\" carries \"extra\", which this contract does not declare, so nothing reads it."),
        new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/",
            "the document carries \"extra\", which this contract does not declare, so nothing reads it."),
        new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/layout/0",
            "a layout node carries \"v\", which this contract does not declare, so nothing reads it."),
        new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/layout/0/children/0",
            "a layout slot carries \"u\", which this contract does not declare, so nothing reads it."),
        new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/rules/0",
            "a rule carries \"w\", which this contract does not declare, so nothing reads it."),
        new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, "/validations/0",
            "a validation carries \"x\", which this contract does not declare, so nothing reads it."));
    for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
      MdyDynamicFormParseResult result = parser.parse(everySurface, mode);
      assertFalse(result.ok(), mode.name());
      assertEquals(expected, result.diagnostics(), mode.name());
      assertEquals(2, result.acceptedCount(), mode.name());
      assertEquals(4, result.rejectedCount(), "one finding per list entry: the slot's counts against its layout entry");
      boolean strict = mode == MdyDynamicFormParser.Mode.STRICT;
      assertEquals(strict ? 0 : 2, result.fields().size(), mode.name());
      assertEquals(strict ? 0 : 1, result.layout().size(), mode.name());
      assertEquals(strict ? 0 : 1, result.rules().size(), mode.name());
    }

    // A nested layout is walked node first, then its children last-first, and every depth is held to
    // the list of its own shape: a columns row, a slot, a section.
    String nested = "{\"version\":3,\"fields\":[{\"name\":\"ok\",\"kind\":\"text\"},{\"name\":\"b\",\"kind\":\"text\"},{\"name\":\"c\",\"kind\":\"text\"},{\"name\":\"d\",\"kind\":\"text\"}],"
        + "\"layout\":[{\"kind\":\"section\",\"id\":\"s\",\"children\":["
        + "{\"kind\":\"columns\",\"id\":\"c1\",\"columns\":[[{\"ref\":\"ok\",\"u1\":1}],[{\"ref\":\"b\",\"u2\":1},{\"kind\":\"section\",\"id\":\"in\",\"children\":[\"c\"],\"u3\":1}]],\"u4\":1},"
        + "{\"kind\":\"section\",\"id\":\"s2\",\"children\":[{\"ref\":\"d\",\"u5\":1}],\"u6\":1}],\"u7\":1},"
        + "{\"kind\":\"section\",\"id\":\"s3\",\"children\":[],\"u8\":1}]}";
    MdyDynamicFormParseResult walked = parser.parse(nested, MdyDynamicFormParser.Mode.LENIENT);
    assertEquals(
        List.of("/layout/0 u7", "/layout/0/children/1 u6", "/layout/0/children/1/children/0 u5", "/layout/0/children/0 u4",
            "/layout/0/children/0/columns/1/1 u3", "/layout/0/children/0/columns/1/0 u2", "/layout/0/children/0/columns/0/0 u1", "/layout/1 u8"),
        walked.diagnostics().stream().map(d -> d.path() + " " + d.message().replaceAll(".*carries \"(\\w+)\".*", "$1")).toList());
    assertTrue(walked.diagnostics().stream().allMatch(d -> d.code().equals("MDY_DYNAMIC_UNKNOWN_MEMBER")));
    assertEquals(List.of("a layout node", "a layout node", "a layout slot", "a layout node", "a layout node", "a layout slot", "a layout slot", "a layout node"),
        walked.diagnostics().stream().map(d -> d.message().substring(0, d.message().indexOf(" carries"))).toList());
    assertEquals(2, walked.layout().size(), "the members are reported and the layout is kept");
    assertEquals(8, walked.rejectedCount());

    // The list is chosen by the shape the position declares, not by whether the node is then usable.
    String prefix = "{\"version\":3,\"fields\":[{\"name\":\"ok\",\"kind\":\"text\"},{\"name\":\"b\",\"kind\":\"text\"}],\"layout\":[";
    MdyDynamicFormParseResult kindNull = parser.parse(prefix + "{\"kind\":null,\"id\":\"s\",\"children\":[\"ok\"],\"extra\":1}]}", MdyDynamicFormParser.Mode.LENIENT);
    assertEquals(List.of("a layout node carries \"extra\", which this contract does not declare, so nothing reads it.", "layout node has an invalid shape."),
        kindNull.diagnostics().stream().map(MdyDynamicDiagnostic::message).toList());
    MdyDynamicFormParseResult topSlot = parser.parse(prefix + "{\"ref\":\"ok\",\"extra\":1}]}", MdyDynamicFormParser.Mode.LENIENT);
    assertEquals(List.of("a layout slot carries \"extra\", which this contract does not declare, so nothing reads it.", "layout node has an invalid shape."),
        topSlot.diagnostics().stream().map(MdyDynamicDiagnostic::message).toList());
    assertEquals(2, topSlot.rejectedCount());
    MdyDynamicDiagnostic columns = only(parser.parse(prefix + "{\"kind\":\"columns\",\"id\":\"c\",\"columns\":[[\"ok\"],[\"b\"]],\"gap\":2,\"children\":[]}]}", MdyDynamicFormParser.Mode.LENIENT));
    assertEquals("a layout node carries \"gap\", \"children\", which this contract does not declare, so nothing reads it.", columns.message());
    // A section placed at the top of the layout is refused before its members are read.
    MdyDynamicDiagnostic placedAtTop = only(parser.parse(prefix + "{\"kind\":\"section\",\"id\":\"s\",\"children\":[\"ok\"],\"at\":{\"sm\":{\"column\":1}},\"extra\":1}]}", MdyDynamicFormParser.Mode.LENIENT));
    assertEquals("MDY_DYNAMIC_INVALID_LAYOUT", placedAtTop.code());
    // An array entry is an object to JavaScript: on each list it passes the door and is refused by
    // the check after it, while a scalar is refused at the door.
    assertEquals(List.of("layout node has an invalid shape.", "layout node must be an object."),
        parser.parse(prefix + "[\"ok\"],5]}", MdyDynamicFormParser.Mode.LENIENT).diagnostics().stream().map(MdyDynamicDiagnostic::message).toList());
    String lists = "{\"version\":2,\"fields\":[{\"name\":\"ok\",\"kind\":\"text\"}],\"rules\":[[\"x\"],5],\"validations\":[[\"x\"],null]}";
    assertEquals(List.of("rule has an unsupported effect/operator or references an unknown field.", "rule must be an object.",
            "validation needs a non-empty message.", "validation must be an object."),
        parser.parse(lists, MdyDynamicFormParser.Mode.LENIENT).diagnostics().stream().map(MdyDynamicDiagnostic::message).toList());

    // The document's own members, wherever the document stands: after what its fields said, before
    // what its version is told about, and on an envelope that declares no version or no field list.
    MdyDynamicFormParseResult early = parser.parse("{\"version\":2,\"fields\":[{\"name\":\"ok\",\"kind\":\"text\"}],\"extra\":1,\"requiresContext\":[\"t\"]}", MdyDynamicFormParser.Mode.LENIENT);
    assertEquals(List.of("/", "/requiresContext"), early.diagnostics().stream().map(MdyDynamicDiagnostic::path).toList());
    assertEquals("Unsupported dynamic form config version for \"requiresContext\": it arrived with version 4, and this document says 2. "
        + "Set \"version\": 4 to use it.", early.diagnostics().get(1).message());
    MdyDynamicFormParseResult unversioned = parser.parse("{\"fields\":[{\"name\":\"ok\",\"kind\":\"text\"}],\"extra\":1,\"layout\":[],\"rules\":1}", MdyDynamicFormParser.Mode.LENIENT);
    assertEquals(List.of("/fields", "/", "/layout", "/rules"), unversioned.diagnostics().stream().map(MdyDynamicDiagnostic::path).toList());
    assertEquals(null, unversioned.version());
    assertEquals(1, unversioned.rejectedCount());
    MdyDynamicFormParseResult noList = parser.parse("{\"layout\":[],\"extra\":1}", MdyDynamicFormParser.Mode.LENIENT);
    assertEquals(List.of("MDY_DYNAMIC_INVALID_FIELD /fields", "MDY_DYNAMIC_UNKNOWN_MEMBER /", "MDY_DYNAMIC_UNSUPPORTED_VERSION /layout"),
        noList.diagnostics().stream().map(d -> d.code() + " " + d.path()).toList());

    // Every member the contract declares, on every surface, is not a finding.
    assertTrue(parser.parse("{\"version\":4,\"id\":\"x\",\"fields\":[{\"name\":\"ok\",\"kind\":\"text\"},{\"name\":\"b\",\"kind\":\"text\"}],\"requiresContext\":[],"
        + "\"layout\":[{\"kind\":\"section\",\"id\":\"s\",\"label\":\"L\",\"children\":[\"ok\",{\"kind\":\"columns\",\"id\":\"c\",\"at\":{\"sm\":2},\"columns\":[[{\"ref\":\"b\",\"at\":{\"sm\":{\"column\":1}}}]]}]}],"
        + "\"rules\":[{\"effect\":\"visible\",\"target\":\"b\",\"when\":{\"field\":\"ok\",\"operator\":\"isEmpty\"}}],"
        + "\"validations\":[{\"when\":{\"op\":\"isEmpty\",\"operands\":[{\"path\":\"ok\"}]},\"message\":\"m\",\"target\":\"b\"}]}",
        MdyDynamicFormParser.Mode.STRICT).ok());
  }

  /**
   * A tree document's counts are about what the document declared, not about what survived it. A
   * declaration is a field node wherever it sits — inside a collection's row template too, where it
   * never becomes a flat field — or a node that is neither a field nor a container the walk can
   * descend; a schema turned down whole turned down every one of them; a leaf the walk refuses is one
   * rejection; and a row-template field read once per declared row is counted as many times as it
   * was read.
   */
  @Test
  void aTreeDocumentCountsWhatItDeclared() throws IOException {
    record Case(String document, boolean ok, int fields, int accepted, int rejected) {}
    String leaf = "{\"node\":\"field\",\"field\":{\"kind\":\"text\"}}";
    List<Case> cases = List.of(
        new Case("{\"version\":3,\"schema\":{\"node\":\"group\",\"children\":{\"a\":" + leaf + ",\"rows\":{\"node\":\"array\",\"item\":{\"node\":\"group\",\"children\":{\"b\":" + leaf
            + ",\"inner\":{\"node\":\"record\",\"item\":" + leaf + "}}}},\"keyed\":{\"node\":\"record\",\"item\":" + leaf + "}}}}", true, 1, 4, 0),
        new Case("{\"version\":2,\"schema\":{\"node\":\"group\",\"children\":{\"rows\":{\"node\":\"array\",\"initialValue\":[{\"b\":1},{\"b\":2},{}],"
            + "\"item\":{\"node\":\"group\",\"children\":{\"b\":{\"node\":\"field\",\"field\":{\"kind\":\"number\"}},\"c\":" + leaf + "}}}}}}", true, 6, 6, 0),
        new Case("{\"version\":2,\"schema\":{\"node\":\"group\",\"children\":{\"a\":" + leaf + ",\"bad\":{\"node\":\"nope\"},\"c\":" + leaf + "}}}", false, 0, 0, 3),
        new Case("{\"version\":2,\"schema\":{\"node\":\"group\",\"children\":{\"a\":" + leaf + ",\"bad\":{\"children\":{}},\"worse\":5,\"s\":\"x\"}}}", false, 0, 0, 2),
        new Case("{\"version\":2,\"schema\":{\"node\":\"group\",\"children\":{\"a\":" + leaf + ",\"bad\":{\"node\":\"group\",\"children\":[" + leaf + "," + leaf + "]}}}}", false, 0, 0, 2),
        new Case("{\"version\":2,\"schema\":{\"node\":\"group\",\"children\":{\"rows\":{\"node\":\"array\",\"item\":{\"node\":\"nope\"}},\"a\":" + leaf + "}}}", false, 0, 0, 2),
        new Case("{\"version\":2,\"schema\":{\"node\":\"group\",\"children\":{\"a\":" + leaf + ",\"bad\":{\"node\":\"nope\"}}},\"layout\":[5],\"rules\":[null],\"validations\":[1]}", false, 0, 0, 5),
        new Case("{\"version\":2,\"schema\":[" + leaf + "," + leaf + "]}", false, 0, 0, 0),
        new Case("{\"version\":2,\"fields\":[{\"name\":\"ok\",\"kind\":\"text\"}],\"schema\":{\"node\":\"group\",\"children\":{\"a\":" + leaf + ",\"bad\":{\"node\":\"nope\"}}}}", false, 0, 0, 2));
    for (Case c : cases) {
      for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
        MdyDynamicFormParseResult result = parser.parse(c.document(), mode);
        assertEquals(c.ok(), result.ok(), () -> c.document() + " in " + mode + ": " + result.diagnostics());
        assertEquals(c.fields(), result.fields().size(), () -> c.document() + " in " + mode);
        assertEquals(c.accepted(), result.acceptedCount(), () -> c.document() + " in " + mode);
        assertEquals(c.rejected(), result.rejectedCount(), () -> c.document() + " in " + mode);
      }
    }

    MdyDynamicFormParseResult templates = parser.parse(readV3Fixture("nested-collections.json"), MdyDynamicFormParser.Mode.STRICT);
    assertTrue(templates.ok(), () -> String.valueOf(templates.diagnostics()));
    assertEquals(0, templates.fields().size());
    assertEquals(5, templates.acceptedCount(), "every cell a row template declares");
    assertEquals(0, templates.rejectedCount());

    MdyDynamicFormParseResult refused = parser.parse(readV4Fixture("a-expression-too-deep.json"), MdyDynamicFormParser.Mode.LENIENT);
    assertFalse(refused.ok());
    assertEquals(0, refused.acceptedCount());
    assertEquals(2, refused.rejectedCount(), "a tree turned down whole turned down what it declared");
  }

  /**
   * A leaf in a tree is held to every rule a field in a flat list is, the way the TypeScript reader
   * holds it: once where it is written, under the key its parent gave it, and once more for each time
   * the walk reads it — every declared row, and the row template once even when no row exists, the
   * templates after the tree and the last one met first. A walk finding stays at the entry the flat
   * reader names; a path longer than a path may be is refused at the schema. Each walk finding is one
   * leaf turned down, and a leaf turned down never makes the document {@code ok}.
   */
  @Test
  void aTreeLeafIsHeldToTheFlatRules() {
    record Finding(String code, String path, String message) {}
    record Case(String document, int strictFields, int lenientFields, int accepted, int rejected, List<Finding> findings) {}
    Finding unknownLeaf = new Finding("MDY_DYNAMIC_UNKNOWN_KIND", "/fields/0", "Dropped dynamic field \"leaf\" with unknown kind \"nope\".");
    String key = "k".repeat(510);
    List<Case> cases = List.of(
        new Case("""
            {"version":2,"schema":{"node":"group","children":{"a":{"node":"field","field":{"kind":"text"}},
              "bad":{"node":"field","field":{"kind":"nope"}}}}}""", 0, 1, 1, 1, List.of(
            new Finding("MDY_DYNAMIC_UNKNOWN_KIND", "/schema/children/bad/field", "Dropped dynamic field \"bad\" with unknown kind \"nope\"."),
            unknownLeaf)),
        new Case("""
            {"version":2,"schema":{"node":"group","children":{
              "first":{"node":"array","item":{"node":"field","field":{"kind":"nope"}}},
              "rows":{"node":"array","initialValue":[{},{}],"item":{"node":"group","children":{"b":{"node":"field","field":{"kind":"other"}}}}}}}}""",
            0, 0, 0, 4, List.of(
            new Finding("MDY_DYNAMIC_UNKNOWN_KIND", "/schema/children/first/item/field", "Dropped dynamic field \"item\" with unknown kind \"nope\"."),
            new Finding("MDY_DYNAMIC_UNKNOWN_KIND", "/schema/children/rows/item/children/b/field", "Dropped dynamic field \"b\" with unknown kind \"other\"."),
            new Finding("MDY_DYNAMIC_UNKNOWN_KIND", "/fields/0", "Dropped dynamic field \"leaf\" with unknown kind \"other\"."),
            new Finding("MDY_DYNAMIC_UNKNOWN_KIND", "/fields/0", "Dropped dynamic field \"leaf\" with unknown kind \"other\"."),
            new Finding("MDY_DYNAMIC_UNKNOWN_KIND", "/fields/0", "Dropped dynamic field \"leaf\" with unknown kind \"other\"."),
            unknownLeaf)),
        new Case("{\"version\":2,\"schema\":{\"node\":\"group\",\"children\":{\"" + key + "\":{\"node\":\"array\","
            + "\"initialValue\":[\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"],\"item\":{\"node\":\"field\",\"field\":{\"kind\":\"text\"}}}}}}",
            0, 10, 10, 1, List.of(new Finding("MDY_DYNAMIC_PATH_TOO_LONG", "/schema",
                "Dropped a dynamic field whose path is 513 characters, past the 512 a path may be: a path is the payload key, "
                    + "the draft key and the widget id, and every read of the value carries it."))),
        // A walk finding the flat reader places on its list as a whole is placed on the schema.
        new Case("""
            {"version":2,"schema":{"node":"group","children":{"a":{"node":"field","field":{"kind":"text"}},
              "b":{"node":"field","field":{"kind":"text","validators":{"pattern":12}}}}}}""", 0, 1, 1, 1, List.of(
            new Finding("MDY_DYNAMIC_INVALID_FIELD", "/schema/children/b/field", "Dropped dynamic field \"b\": validators.pattern must be a string."),
            new Finding("MDY_DYNAMIC_INVALID_FIELD", "/schema", "Dropped dynamic field \"leaf\": validators.pattern must be a string."))),
        // A field is named by its whole key: a key may hold "/", which its path segment escapes as "~1".
        new Case("""
            {"version":2,"schema":{"node":"group","children":{"a/b":{"node":"field","field":{"kind":"nope"}},
              "x/":{"node":"field","field":{"kind":"text"}}}}}""", 0, 1, 1, 1, List.of(
            new Finding("MDY_DYNAMIC_UNKNOWN_KIND", "/schema/children/a~1b/field", "Dropped dynamic field \"a/b\" with unknown kind \"nope\"."),
            unknownLeaf)),
        // A leaf kept despite a member nothing reads still counts each finding as a leaf turned down.
        new Case("""
            {"version":2,"schema":{"node":"group","children":{"a":{"node":"field","field":{"kind":"text","bogus":1}},
              "b":{"node":"field","field":{"kind":"text"}}}}}""", 0, 2, 2, 1, List.of(
            new Finding("MDY_DYNAMIC_UNKNOWN_MEMBER", "/schema/children/a/field",
                "dynamic field \"a\" carries \"bogus\", which this contract does not declare, so nothing reads it."),
            new Finding("MDY_DYNAMIC_UNKNOWN_MEMBER", "/fields/0",
                "dynamic field \"leaf\" carries \"bogus\", which this contract does not declare, so nothing reads it."))),
        // A declared initial the kind cannot hold is refused where it is written, which turns the
        // tree down whole; a row's value is the leaf's initial, and the walk judges it there.
        new Case("""
            {"version":5,"schema":{"node":"group","children":{"a":{"node":"field","field":{"kind":"text"}},
              "t":{"node":"field","field":{"kind":"text","initialValue":42}}}}}""", 0, 0, 0, 2, List.of(
            new Finding("MDY_DYNAMIC_INVALID_FIELD", "/schema/children/t/field/initialValue",
                "field initialValue does not match the kind — text holds string, got number."),
            new Finding("MDY_DYNAMIC_INVALID_FIELD", "/schema/children/t/field",
                "Dropped dynamic field \"t\": initialValue does not match the kind — text holds string, got number."))),
        new Case("""
            {"version":5,"schema":{"node":"group","children":{"a":{"node":"field","field":{"kind":"text"}},
              "rows":{"node":"array","initialValue":[{"t":5}],"item":{"node":"group","children":{"t":{"node":"field","field":{"kind":"text"}}}}}}}}""",
            0, 1, 1, 1, List.of(new Finding("MDY_DYNAMIC_INVALID_FIELD", "/fields/0",
                "Dropped dynamic field \"leaf\": initialValue does not match the kind — text holds string, got number."))),
        new Case("""
            {"version":5,"schema":{"node":"group","children":{"t":{"node":"field","field":{"kind":"text","email":true}}}}}""", 0, 1, 1, 2, List.of(
            new Finding("MDY_DYNAMIC_UNKNOWN_MEMBER", "/schema/children/t/field",
                "dynamic field \"t\" carries \"email\", which this contract does not declare, so nothing reads it."),
            new Finding("MDY_DYNAMIC_MISPLACED_VALIDATOR", "/schema/children/t/field", "Dynamic field \"t\" declares \"email\" on the field, "
                + "and it belongs in \"validators\" — nothing reads it here, so the field has no such rule."),
            new Finding("MDY_DYNAMIC_UNKNOWN_MEMBER", "/fields/0",
                "dynamic field \"leaf\" carries \"email\", which this contract does not declare, so nothing reads it."),
            new Finding("MDY_DYNAMIC_MISPLACED_VALIDATOR", "/fields/0", "Dynamic field \"leaf\" declares \"email\" on the field, "
                + "and it belongs in \"validators\" — nothing reads it here, so the field has no such rule."))),
        new Case("""
            {"version":5,"schema":{"node":"group","children":{"o":{"node":"field","field":{"kind":"segmented",
              "options":[{"value":true,"label":"A"},{"value":true,"label":"B"}]}}}}}""", 0, 1, 1, 1, List.of(
            new Finding("MDY_DYNAMIC_DUPLICATE_OPTION", "/schema/children/o/field", "Dropped a duplicate option value true on \"o\": an option's value "
                + "is its identity, so two options sharing one leave a value naming both and a control able to reach only the first."),
            new Finding("MDY_DYNAMIC_DUPLICATE_OPTION", "/fields/0", "Dropped a duplicate option value true on \"leaf\": an option's value "
                + "is its identity, so two options sharing one leave a value naming both and a control able to reach only the first."))),
        new Case("""
            {"version":5,"schema":{"node":"group","children":{"a":{"node":"field","field":{"kind":"text"}},
              "d":{"node":"field","field":{"kind":"datepicker","locale":"en_US"}}}}}""", 0, 1, 1, 1, List.of(
            new Finding("MDY_DYNAMIC_INVALID_FIELD", "/schema/children/d/field", "Dropped dynamic field \"d\": locale must be a valid BCP 47 tag, e.g. \"it-IT\"."),
            new Finding("MDY_DYNAMIC_INVALID_FIELD", "/schema", "Dropped dynamic field \"leaf\": locale must be a valid BCP 47 tag, e.g. \"it-IT\"."))),
        new Case("""
            {"version":5,"schema":{"node":"group","children":{"a":{"node":"field","field":{"kind":"text"}},
              "n":{"node":"field","field":{"kind":"number","min":5,"max":4}}}}}""", 0, 1, 1, 1, List.of(
            new Finding("MDY_DYNAMIC_INVALID_FIELD", "/schema/children/n/field", "Dropped dynamic field \"n\": min cannot exceed max."),
            new Finding("MDY_DYNAMIC_INVALID_FIELD", "/fields/0", "Dropped dynamic field \"leaf\": min cannot exceed max."))),
        new Case("""
            {"version":2,"schema":{"node":"group","children":{"s":{"node":"field","field":{"kind":"select","options":[]}},
              "rows":{"node":"array","item":{"node":"field","field":{"kind":"radio","options":[]}}}}}}""", 1, 1, 2, 0, List.of()));
    for (Case c : cases) {
      for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
        MdyDynamicFormParseResult result = parser.parse(c.document(), mode);
        List<Finding> findings = result.diagnostics().stream()
            .map(d -> new Finding(d.code(), d.path(), d.message())).toList();
        assertEquals(c.findings(), findings, () -> c.document() + " in " + mode);
        assertEquals(c.findings().isEmpty(), result.ok(), () -> c.document() + " in " + mode);
        assertEquals(mode == MdyDynamicFormParser.Mode.STRICT ? c.strictFields() : c.lenientFields(), result.fields().size(),
            () -> c.document() + " in " + mode);
        assertEquals(c.accepted(), result.acceptedCount(), () -> c.document() + " in " + mode);
        assertEquals(c.rejected(), result.rejectedCount(), () -> c.document() + " in " + mode);
      }
    }
  }

  /**
   * The member lists and kind sets this reader holds a document to are the ones the TypeScript
   * contract declares, read from its source in the same checkout. The lists are spelled twice because
   * one is TypeScript and one is Java; this is what keeps a member added to one from being a document
   * one reader reports and the other accepts.
   */
  @Test
  void theMemberListsAreTheOnesTheTypeScriptContractDeclares() {
    Path core = Path.of("../../../packages/core/src");
    Path members = core.resolve("dynamic/members.ts");
    assertEquals(tsList(members, "document: Object.freeze(["), MdyDynamicFormParser.DOCUMENT_MEMBERS, "document");
    assertEquals(tsList(members, "field: Object.freeze(["), MdyDynamicFormParser.FIELD_MEMBERS, "field");
    assertEquals(tsList(members, "validators: Object.freeze(["), MdyDynamicFormParser.VALIDATOR_MEMBERS, "validators");
    assertEquals(tsList(members, "option: Object.freeze(["), MdyDynamicFormParser.OPTION_MEMBERS, "option");
    assertEquals(tsList(members, "rule: Object.freeze(["), MdyDynamicFormParser.RULE_MEMBERS, "rule");
    assertEquals(tsList(members, "validation: Object.freeze(["), MdyDynamicFormParser.VALIDATION_MEMBERS, "validation");
    assertEquals(tsList(members, "layoutSection: Object.freeze(["), MdyDynamicFormParser.LAYOUT_SECTION_MEMBERS, "layoutSection");
    assertEquals(tsList(members, "layoutColumns: Object.freeze(["), MdyDynamicFormParser.LAYOUT_COLUMNS_MEMBERS, "layoutColumns");
    assertEquals(tsList(members, "layoutSlot: Object.freeze(["), MdyDynamicFormParser.LAYOUT_SLOT_MEMBERS, "layoutSlot");

    Path parse = core.resolve("dynamic/parse.ts");
    assertEquals(tsList(parse, "const MDY_VALIDATOR_MESSAGE_KEYS: ReadonlySet<string> = new Set(["), MdyDynamicFormParser.VALIDATOR_MESSAGE_KEYS, "messages");
    assertEquals(tsList(parse, "const needsOptions = ["), MdyDynamicFormParser.OPTIONS_KINDS, "the kinds that need options");
    assertEquals(tsList(core.resolve("field-kinds.ts"), "export const MDY_FIELD_KINDS = Object.freeze(["), MdyDynamicFormParser.FIELD_KINDS, "kinds");
  }

  /**
   * A calendar's locale is read where {@code Intl.getCanonicalLocales} draws the line, not where
   * RFC 5646 does: each verdict below is the one Node 24 gives. Grandfathered, extlang and
   * private-use-only tags, a repeated variant or singleton, an underscore and a character outside
   * ASCII are refused; a tag with any case and well-formed extensions is accepted.
   */
  @Test
  void aCalendarLocaleIsATagJavaScriptAccepts() {
    Map<String, Boolean> verdicts = new TreeMap<>(Map.ofEntries(
        Map.entry("it-IT", true), Map.entry("EN-us", true), Map.entry("en-x-foo", true), Map.entry("en-US-x-a-b-c", true),
        Map.entry("en-u-ca", true), Map.entry("en-u-attr-ca-gregory", true), Map.entry("en-t-it-m0-xxx", true),
        Map.entry("art-lojban", true),
        Map.entry("en_US", false), Map.entry("not a tag!", false), Map.entry("", false), Map.entry("root", false),
        Map.entry("i-klingon", false), Map.entry("x-foo", false), Map.entry("zh-yue", false), Map.entry("abcd", false),
        Map.entry("Latn-US", false), Map.entry("de-DE-1996-1996", false), Map.entry("en-a-xx-a-yy", false),
        Map.entry("en-a-b", false), Map.entry("en-t-m0", false), Map.entry("en-t-it-latn-1996-1996", false),
        Map.entry("en-u-ab-123456789", false), Map.entry("en-K", false)));
    verdicts.forEach((tag, valid) -> assertEquals(valid, MdyLanguageTags.isStructurallyValid(tag), tag));
  }

  /**
   * The value each kind holds is the one {@code MDY_VALUE_CONTRACTS} declares, read from its source:
   * every entry's shape and nullability, and the same kinds as the field kinds both readers dispatch
   * on — so a kind added to the TypeScript contract without its value here fails, rather than holding
   * anything. Each kind then refuses a value of another shape and accepts its empty value.
   */
  @Test
  void theValueEachKindHoldsIsTheOneTheTypeScriptContractDeclares() throws IOException {
    String source = Files.readString(Path.of("../../../packages/core/src/value-contracts.ts"))
        .replaceAll("(?s)/\\*.*?\\*/", "").replaceAll("//[^\n]*", "");
    String opening = "MDY_VALUE_CONTRACTS: Readonly<Record<MdyValueKind, MdyValueContract>> = Object.freeze({";
    int start = source.indexOf(opening);
    assertTrue(start >= 0, "value-contracts.ts does not declare MDY_VALUE_CONTRACTS as expected");
    int close = source.indexOf("\n});", start);
    assertTrue(close > start, "MDY_VALUE_CONTRACTS is not closed");
    java.util.regex.Pattern entry = java.util.regex.Pattern.compile("^\\s*(\\w+): (.*)$");
    java.util.regex.Pattern live = java.util.regex.Pattern.compile("live\\(\"([^\"]+)\", (true|false)\\)");
    java.util.regex.Pattern frozen = java.util.regex.Pattern.compile("shape: \"([^\"]+)\".*nullable: (true|false)");
    Map<String, MdyValueContracts.Contract> declared = new TreeMap<>();
    for (String line : source.substring(start + opening.length(), close).split("\n")) {
      if (line.isBlank()) continue;
      var e = entry.matcher(line);
      assertTrue(e.matches(), () -> "cannot read `" + line + "` in MDY_VALUE_CONTRACTS");
      var shape = live.matcher(e.group(2));
      if (!shape.find()) {
        shape = frozen.matcher(e.group(2));
        assertTrue(shape.find(), () -> "cannot read the shape of `" + line + "`");
      }
      assertFalse(declared.containsKey(e.group(1)), () -> line + " declares a kind twice");
      declared.put(e.group(1), new MdyValueContracts.Contract(shape.group(1), Boolean.parseBoolean(shape.group(2))));
    }
    assertEquals(declared, new TreeMap<>(MdyValueContracts.CONTRACTS));
    assertEquals(MdyDynamicFormParser.FIELD_KINDS, MdyValueContracts.CONTRACTS.keySet());

    ObjectMapper json = new ObjectMapper();
    Map<String, String> empty = Map.of("string", "\"\"", "number", "0", "boolean", "false", "option", "\"a\"",
        "option[]", "[]", "file[]", "[]", "dateRange", "{\"start\":null,\"end\":null}");
    for (var kind : MdyValueContracts.CONTRACTS.entrySet()) {
      String shape = kind.getValue().shape();
      assertEquals(null, MdyValueContracts.explainMismatch(kind.getKey(), json.readTree(empty.get(shape))), kind.getKey());
      assertEquals(kind.getValue().nullable(), MdyValueContracts.explainMismatch(kind.getKey(), json.readTree("null")) == null, kind.getKey());
      // An option holds anything that is not null, so only the other shapes have a value to refuse.
      if (!shape.equals("option")) {
        String other = shape.equals("boolean") ? "7" : "true";
        assertTrue(MdyValueContracts.explainMismatch(kind.getKey(), json.readTree(other)) != null, kind.getKey());
      }
    }
  }

  /**
   * The string literals of a list a TypeScript source declares, found by the text that opens it,
   * with {@code ...NAME} spreads resolved against {@code const NAME = [} in the same file.
   *
   * <p>Anything it cannot read is a failure, never an empty list: the opening text missing or
   * ambiguous, a list without a closing bracket, an entry that is neither a plain string literal nor
   * a resolvable spread, a duplicate, or nothing at all — because a check that compares against
   * nothing passes for the wrong reason.
   */
  private static Set<String> tsList(Path file, String opening) {
    String source;
    try {
      source = Files.readString(file);
    } catch (IOException e) {
      throw new AssertionError("cannot read " + file + ": " + e.getMessage(), e);
    }
    source = source.replaceAll("(?s)/\\*.*?\\*/", "").replaceAll("//[^\n]*", "");
    int start = source.indexOf(opening);
    assertTrue(start >= 0, () -> file + " does not declare `" + opening + "`");
    assertEquals(start, source.lastIndexOf(opening), () -> file + " declares `" + opening + "` more than once");
    int open = start + opening.length();
    int close = source.indexOf(']', open);
    assertTrue(close > open, () -> "`" + opening + "` in " + file + " is not closed");
    Set<String> out = new LinkedHashSet<>();
    for (String entry : source.substring(open, close).split(",")) {
      String token = entry.trim();
      if (token.isEmpty()) continue;
      if (token.startsWith("...")) {
        out.addAll(tsList(file, "const " + token.substring(3) + " = ["));
        continue;
      }
      assertTrue(token.length() > 2 && token.startsWith("\"") && token.endsWith("\"") && token.indexOf('"', 1) == token.length() - 1,
          () -> "cannot read `" + token + "` in `" + opening + "` of " + file);
      String name = token.substring(1, token.length() - 1);
      assertTrue(out.add(name), () -> "`" + opening + "` in " + file + " lists " + name + " twice");
    }
    assertFalse(out.isEmpty(), () -> "`" + opening + "` in " + file + " lists nothing");
    return out;
  }
}
