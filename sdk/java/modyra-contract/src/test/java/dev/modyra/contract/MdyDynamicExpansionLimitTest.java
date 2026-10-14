package dev.modyra.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

/**
 * What a document's rows may cost this reader beyond what the document declares (ADR 0231).
 *
 * <p>A collection's declared rows are lent to every enclosing row that writes none, so the flatten
 * visits the product of the row counts and not the size of the document. The reader bounds the
 * visits beyond the declared nodes and refuses the whole schema past the bound, at {@code /schema},
 * in both modes.
 */
class MdyDynamicExpansionLimitTest {

  private static final Path SPEC_FIXTURES_V5 = Path.of("../../../spec/fixtures/dynamic-form/v5");
  private static final String TEXT = "{\"node\":\"field\",\"field\":{\"kind\":\"text\",\"label\":\"Cell\"}}";

  private final MdyDynamicFormParser parser = new MdyDynamicFormParser();

  /** A collection of {@code count} rows that write nothing, each row a group of {@code children}. */
  private static String rowsOf(int count, String children) {
    String rows = IntStream.range(0, count).mapToObj(index -> "{}").collect(Collectors.joining(","));
    return "{\"node\":\"array\",\"initialValue\":[" + rows + "],\"item\":{\"node\":\"group\",\"children\":{" + children + "}}}";
  }

  /** Nested collections of {@code rows} rows each, {@code depth} deep, ending in {@code leaf}. */
  private static String nested(int depth, int rows, String leaf) {
    String node = leaf;
    for (int level = 0; level < depth; level++) node = rowsOf(rows, "\"c" + level + "\":" + node);
    return "{\"version\":5,\"schema\":{\"node\":\"group\",\"children\":{\"root\":" + node + "}}}";
  }

  private static List<List<String>> findings(MdyDynamicFormParseResult result) {
    return result.diagnostics().stream().map(d -> List.of(d.code(), d.severity(), d.path())).toList();
  }

  @Test
  void rowsThatMultiplyPastTheBoundRefuseTheSchemaWholeInBothModes() {
    for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
      long started = System.nanoTime();
      // Four levels was an OutOfMemoryError at -Xmx1g before the bound; six is 10^12 visits.
      MdyDynamicFormParseResult result = parser.parse(nested(6, 100, TEXT), mode);
      assertTrue(System.nanoTime() - started < 2_000_000_000L, "the refusal does not walk what it refuses");
      assertFalse(result.ok(), mode.name());
      assertEquals(List.of(), result.fields(), mode.name());
      assertEquals(List.of(List.of("MDY_DYNAMIC_SCHEMA_LIMIT", "error", "/schema")), findings(result), mode.name());
    }
  }

  @Test
  void aBranchThatEndsInNoFieldIsBoundedToo() {
    // Leafless rows cost the walk what rows with cells cost it; a bound on fields alone leaves this.
    MdyDynamicFormParseResult result =
        parser.parse(nested(6, 100, "{\"node\":\"group\",\"children\":{}}"), MdyDynamicFormParser.Mode.LENIENT);
    assertFalse(result.ok());
    assertEquals(List.of(List.of("MDY_DYNAMIC_SCHEMA_LIMIT", "error", "/schema")), findings(result));
  }

  @Test
  void aCollectionWritesAtMostAHundredRows() throws IOException {
    // ADR 0232: the cap is on what a collection writes, refused at its initialValue.
    for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
      MdyDynamicFormParseResult at =
          parser.parse(Files.readString(SPEC_FIXTURES_V5.resolve("rows-written-at-the-cap.json")), mode);
      assertTrue(at.ok(), () -> mode + " at the cap: " + at.diagnostics());
      MdyDynamicFormParseResult past =
          parser.parse(Files.readString(SPEC_FIXTURES_V5.resolve("rows-written-past-the-cap.json")), mode);
      assertEquals(List.of(), past.fields(), mode.name());
      assertEquals(
          List.of(List.of("MDY_DYNAMIC_SCHEMA_LIMIT", "error", "/schema/children/rows/initialValue")),
          findings(past), mode.name());
    }
  }

  @Test
  void theBoundIsExactOnTheSharedPair() throws IOException {
    for (MdyDynamicFormParser.Mode mode : MdyDynamicFormParser.Mode.values()) {
      MdyDynamicFormParseResult at =
          parser.parse(Files.readString(SPEC_FIXTURES_V5.resolve("rows-lent-at-the-bound.json")), mode);
      assertTrue(at.ok(), () -> mode + " at the bound: " + at.diagnostics());
      MdyDynamicFormParseResult past =
          parser.parse(Files.readString(SPEC_FIXTURES_V5.resolve("rows-lent-past-the-bound.json")), mode);
      assertEquals(List.of(List.of("MDY_DYNAMIC_SCHEMA_LIMIT", "error", "/schema")), findings(past), mode.name());
    }
  }

  @Test
  void aTableOfAHundredRowsAndTwentyCellsIsAccepted() {
    String cells = IntStream.range(0, 20).mapToObj(index -> "\"c" + index + "\":" + TEXT).collect(Collectors.joining(","));
    MdyDynamicFormParseResult result = parser.parse(
        "{\"version\":5,\"schema\":{\"node\":\"group\",\"children\":{\"lines\":" + rowsOf(100, cells) + "}}}",
        MdyDynamicFormParser.Mode.STRICT);
    assertTrue(result.ok(), () -> "diagnostics: " + result.diagnostics());
    assertEquals(2000, result.fields().size());
  }

  @Test
  void aLentCellIsOneValueAcrossTheRowsThatTakeIt() {
    // A 100 KB multiselect value in one declared row, lent to every row of two enclosing collections:
    // 2,000 rows inside the bound, which copied per row would be 2,000 copies.
    String big = IntStream.range(0, 10_000).mapToObj(index -> "\"v" + index + "\"").collect(Collectors.joining(","));
    String cell = "{\"node\":\"field\",\"field\":{\"kind\":\"multiselect\",\"label\":\"Cell\","
        + "\"options\":[{\"value\":\"v0\",\"label\":\"V\"}]}}";
    String inner = "{\"node\":\"array\",\"initialValue\":[{\"cell\":[" + big + "]}],"
        + "\"item\":{\"node\":\"group\",\"children\":{\"cell\":" + cell + "}}}";
    String json = "{\"version\":5,\"schema\":{\"node\":\"group\",\"children\":{\"outer\":"
        + rowsOf(20, "\"mid\":" + rowsOf(100, "\"inner\":" + inner)) + "}}}";

    long started = System.nanoTime();
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.STRICT);
    assertTrue(System.nanoTime() - started < 5_000_000_000L, "a lent cell is read once, not once per row");

    assertTrue(result.ok(), () -> "diagnostics: " + result.diagnostics().subList(0, Math.min(3, result.diagnostics().size())));
    List<MdyDynamicField> cells = result.fields().stream().filter(field -> field.name().endsWith(".cell")).toList();
    assertEquals(2000, cells.size());
    Object first = cells.get(0).initialValue();
    assertEquals(10_000, ((List<?>) first).size());
    for (MdyDynamicField field : cells) {
      assertTrue(first == field.initialValue(), () -> field.name() + " holds its own copy of the lent cell");
    }
  }

  @Test
  void aSharedValueCannotBeChangedThroughOneOfItsFields() {
    // One instance serves every row that takes it, the lent cell and the declared default alike: a
    // write through one field would reach the others.
    String tags = "{\"node\":\"field\",\"field\":{\"kind\":\"multiselect\",\"label\":\"Tags\","
        + "\"options\":[{\"value\":\"a\",\"label\":\"A\"}],\"initialValue\":[\"a\"]}}";
    String inner = "{\"node\":\"array\",\"initialValue\":[{\"lent\":[\"a\"]}],"
        + "\"item\":{\"node\":\"group\",\"children\":{\"lent\":" + tags + ",\"declared\":" + tags + "}}}";
    MdyDynamicFormParseResult result = parser.parse(
        "{\"version\":5,\"schema\":{\"node\":\"group\",\"children\":{\"outer\":" + rowsOf(2, "\"inner\":" + inner) + "}}}",
        MdyDynamicFormParser.Mode.STRICT);
    assertTrue(result.ok(), () -> "diagnostics: " + result.diagnostics());
    for (String suffix : List.of(".lent", ".declared")) {
      List<MdyDynamicField> shared = result.fields().stream().filter(field -> field.name().endsWith(suffix)).toList();
      assertEquals(2, shared.size(), suffix);
      assertTrue(shared.get(0).initialValue() == shared.get(1).initialValue(), suffix + " is one instance");
      @SuppressWarnings("unchecked")
      List<Object> value = (List<Object>) shared.get(0).initialValue();
      assertThrows(UnsupportedOperationException.class, () -> value.add("b"), suffix);
      assertEquals(List.of("a"), shared.get(1).initialValue(), suffix);
    }
  }

  @Test
  void aSmallSharedScalarIsJudgedUnderEachCellsOwnKind() {
    // Jackson hands out one node for `true`; a checkbox may hold it and a text cell may not.
    String json = "{\"version\":5,\"schema\":{\"node\":\"group\",\"children\":{\"rows\":{\"node\":\"array\","
        + "\"initialValue\":[{\"on\":true,\"name\":true}],\"item\":{\"node\":\"group\",\"children\":{"
        + "\"on\":{\"node\":\"field\",\"field\":{\"kind\":\"checkbox\",\"label\":\"On\"}},"
        + "\"name\":{\"node\":\"field\",\"field\":{\"kind\":\"text\",\"label\":\"Name\"}}}}}}}}";
    MdyDynamicFormParseResult result = parser.parse(json, MdyDynamicFormParser.Mode.LENIENT);
    assertEquals(List.of("rows.0.on"), result.fields().stream().map(MdyDynamicField::name).toList());
    assertEquals(List.of(List.of("MDY_DYNAMIC_INVALID_FIELD", "error", "/schema/children/rows/item/children/name/field")),
        findings(result));
  }
}
