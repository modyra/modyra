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
      assertEquals("/fields/seats/validators/integer", refusal.path());
      assertEquals("Unsupported dynamic form config version for \"integer\": it arrived with version 5, and this "
          + "document says " + result.version() + ". Set \"version\": 5 to use it.", refusal.message());
    }
    String tree = "\"schema\":{\"node\":\"group\",\"children\":{\"seats\":{\"node\":\"field\",\"field\":"
        + "{\"kind\":\"number\",\"validators\":{\"integer\":false}}}}}}";
    assertEquals("/fields/seats/validators/integer",
        parser.parse("{\"version\":3," + tree, MdyDynamicFormParser.Mode.STRICT).diagnostics().get(0).path());
    assertTrue(parser.parse("{\"version\":5," + tree, MdyDynamicFormParser.Mode.STRICT).ok());
    assertTrue(parser.parse("{\"version\":5,\"fields\":[" + seats + "]}", MdyDynamicFormParser.Mode.STRICT).ok());
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

}
