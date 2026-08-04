package dev.modyra.contract;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Mirrors {@code parseDynamicForm}/{@code parseDynamicFields} in
 * packages/core/src/dynamic-config.ts: never throws on untrusted input,
 * every field is validated independently (a bad one is dropped with a
 * diagnostic, not a parse failure for the whole document), and
 * {@code STRICT} mode returns no fields/layout/rules at all if any
 * diagnostic exists (never publish/accept a partially-valid document),
 * matching TS exactly.
 *
 * <p>Handles three envelope shapes: a bare JSON array, {@code {"version":
 * 1|2, "fields": [...]}}, and the v2 recursive {@code {"version": 2,
 * "schema": {...}}} envelope (nested {@code group}/{@code array}/{@code
 * field} nodes, flattened to dotted/indexed paths exactly like {@code
 * flattenDynamicSchema} in TS). {@code layout}/{@code rules} are validated
 * against the resolved field names and kept as the raw JSON nodes, same as
 * the TS reference implementation.
 */
public final class MdyDynamicFormParser {

  public enum Mode { STRICT, LENIENT }

  private static final Set<String> FORBIDDEN_NAMES = Set.of("__proto__", "prototype", "constructor");
  private static final Set<String> SCHEMA_NODE_KINDS = Set.of("field", "group", "array");
  private static final Set<String> RULE_EFFECTS = Set.of("visible", "hidden", "enabled", "disabled");
  private static final Set<String> RULE_OPERATORS = Set.of(
      "equals", "notEquals", "in", "notIn", "isEmpty", "isNotEmpty",
      "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual");
  private static final int SCHEMA_MAX_DEPTH = 8;
  private static final int SCHEMA_MAX_NODES = 500;
  private static final int SCHEMA_MAX_ARRAY_ROWS = 100;

  /**
   * Unknown properties are reported, never silently dropped.
   *
   * The records used to carry {@code @JsonIgnoreProperties(ignoreUnknown = true)} each, which made
   * a document this SDK did not understand parse cleanly and re-serialise as something else — a
   * multiselect losing its mode stops being the widget it was written as. Failing outright would
   * trade that for the opposite problem, refusing every document written against a later contract.
   *
   * So the mapper stays lenient and the parser says what it ignored, in the diagnostics vocabulary
   * the rest of this class already speaks.
   */
  private final ObjectMapper mapper = new ObjectMapper()
      .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  /**
   * What this SDK did not understand about a field, so the caller can see it rather than discover it
   * when a re-serialised document behaves differently from the one that was read.
   */
  private static List<String> unknownProperties(JsonNode item) {
    if (item == null || !item.isObject()) return List.of();
    List<String> unknown = new ArrayList<>();
    item.fieldNames().forEachRemaining((name) -> {
      if (!KNOWN_FIELD_PROPERTIES.contains(name)) unknown.add(name);
    });
    return unknown;
  }

  /** Property names a field of this kind declares, for the report above. */
  private static final Set<String> KNOWN_FIELD_PROPERTIES = Set.of(
      "name", "kind", "label", "placeholder", "initialValue", "validators", "options", "mode",
      "min", "max", "step", "rows", "multiple", "accept", "searchable", "loading");

  public MdyDynamicFormParseResult parse(String json, Mode mode) {
    JsonNode root;
    try {
      root = mapper.readTree(json);
    } catch (JsonProcessingException e) {
      return new MdyDynamicFormParseResult(
          false, null, List.of(), List.of(), List.of(),
          List.of(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_JSON", MdyDynamicDiagnostic.ERROR, "/", "Input is not valid JSON: " + e.getOriginalMessage())),
          0, 0);
    }
    return parse(root, mode);
  }

  public MdyDynamicFormParseResult parse(JsonNode root, Mode mode) {
    List<MdyDynamicField> accepted;
    List<MdyDynamicDiagnostic> diagnostics = new ArrayList<>();
    Integer version;
    int sourceCount;

    if (root.isArray()) {
      version = 1;
      FlatResult flat = parseFlatItems(root);
      accepted = flat.accepted;
      diagnostics.addAll(flat.diagnostics);
      sourceCount = root.size();
    } else if (root.isObject() && isStructuredVersion(root.path("version").asInt(-1)) && root.has("schema")) {
      version = root.path("version").asInt();
      List<MdyDynamicDiagnostic> schemaDiagnostics = new ArrayList<>();
      validateSchema(root.get("schema"), "/schema", 0, schemaDiagnostics, new int[]{0});
      diagnostics.addAll(schemaDiagnostics);
      accepted = schemaDiagnostics.isEmpty() ? flattenSchema(root.get("schema")) : List.of();
      sourceCount = accepted.size();
    } else if (root.isObject() && root.has("fields")) {
      int v = root.path("version").isInt() ? root.path("version").asInt() : -1;
      if (v != 1 && v != 2 && v != 3) {
        return new MdyDynamicFormParseResult(false, null, List.of(), List.of(), List.of(), List.of(), 0, 0);
      }
      version = v;
      JsonNode itemsNode = root.get("fields");
      if (!itemsNode.isArray()) {
        return new MdyDynamicFormParseResult(
            false, version, List.of(), List.of(), List.of(),
            List.of(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELDS", MdyDynamicDiagnostic.ERROR, "/fields", "fields must be an array.")),
            0, 0);
      }
      FlatResult flat = parseFlatItems(itemsNode);
      accepted = flat.accepted;
      diagnostics.addAll(flat.diagnostics);
      sourceCount = itemsNode.size();
    } else {
      return new MdyDynamicFormParseResult(
          false, null, List.of(), List.of(), List.of(),
          List.of(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_INPUT", MdyDynamicDiagnostic.ERROR, "/", "Input is neither a field array, a schema envelope, nor a {version, fields} envelope.")),
          0, 0);
    }

    Set<String> names = new HashSet<>();
    for (MdyDynamicField field : accepted) names.add(field.name());
    List<JsonNode> layout = new ArrayList<>();
    List<JsonNode> rules = new ArrayList<>();
    // v3 is v2 plus per-slot placement: every envelope member is read the same way.
    if (version != null && isStructuredVersion(version) && root.isObject()) {
      parseLayout(root.path("layout"), names, layout, diagnostics);
      parseRules(root.path("rules"), names, rules, diagnostics);
    }

    boolean strict = mode == Mode.STRICT;
    boolean blockAll = strict && !diagnostics.isEmpty();
    int rejectedFromLayoutRules = (int) diagnostics.stream()
        .filter(d -> d.path().startsWith("/layout/") || d.path().startsWith("/rules/"))
        .count();
    int rejectedCount = Math.max(0, sourceCount - accepted.size()) + rejectedFromLayoutRules;

    return new MdyDynamicFormParseResult(
        version != null && (!strict || diagnostics.isEmpty()),
        version,
        blockAll ? List.of() : List.copyOf(accepted),
        blockAll ? List.of() : List.copyOf(layout),
        blockAll ? List.of() : List.copyOf(rules),
        List.copyOf(diagnostics),
        accepted.size(),
        rejectedCount);
  }

  private record FlatResult(List<MdyDynamicField> accepted, List<MdyDynamicDiagnostic> diagnostics) {
  }

  private FlatResult parseFlatItems(JsonNode itemsNode) {
    List<MdyDynamicField> accepted = new ArrayList<>();
    List<MdyDynamicDiagnostic> diagnostics = new ArrayList<>();
    Set<String> seenNames = new HashSet<>();
    int index = 0;
    for (JsonNode item : itemsNode) {
      String path = "/fields/" + index;
      index++;

      if (!item.isObject()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.WARNING, path, "Dropped non-object dynamic field."));
        continue;
      }
      JsonNode nameNode = item.get("name");
      String name = nameNode != null && nameNode.isTextual() ? nameNode.asText() : null;
      if (name == null || name.isEmpty()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_MISSING_NAME", MdyDynamicDiagnostic.WARNING, path, "Dropped dynamic field without a name."));
        continue;
      }
      if (name.contains(".") || FORBIDDEN_NAMES.contains(name)) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_RESERVED_NAME", MdyDynamicDiagnostic.WARNING, path,
            "Dropped dynamic field \"" + name + "\": name is reserved or contains forbidden path separators."));
        continue;
      }
      if (!seenNames.add(name)) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_DUPLICATE_NAME", MdyDynamicDiagnostic.WARNING, path,
            "Dropped duplicate dynamic field name \"" + name + "\"."));
        continue;
      }

      for (String unknown : unknownProperties(item)) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_PROPERTY", MdyDynamicDiagnostic.WARNING, path,
            "Ignored unknown property \"" + unknown + "\" on dynamic field \"" + name + "\"."));
      }

      MdyDynamicField field;
      try {
        field = mapper.treeToValue(item, MdyDynamicField.class);
      } catch (JsonProcessingException e) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_KIND", MdyDynamicDiagnostic.WARNING, path,
            "Dropped dynamic field \"" + name + "\": " + e.getOriginalMessage()));
        continue;
      }
      if (field instanceof MdyDynamicOptionsField opt && (opt.options() == null || opt.options().isEmpty())) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_MISSING_OPTIONS", MdyDynamicDiagnostic.WARNING, path,
            "Dropped dynamic field \"" + name + "\": option-based kinds require a non-empty options list."));
        continue;
      }
      accepted.add(field);
    }
    return new FlatResult(accepted, diagnostics);
  }

  // ─── v2 recursive schema: validate + flatten (mirrors validateDynamicSchema / flattenDynamicSchema) ───

  private void validateSchema(JsonNode node, String path, int depth, List<MdyDynamicDiagnostic> out, int[] count) {
    count[0]++;
    if (depth > SCHEMA_MAX_DEPTH || count[0] > SCHEMA_MAX_NODES) {
      out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_SCHEMA_LIMIT", MdyDynamicDiagnostic.ERROR, path, "schema exceeds depth/node limits."));
      return;
    }
    String kind = node.isObject() && node.path("node").isTextual() ? node.path("node").asText() : null;
    if (!node.isObject() || kind == null || !SCHEMA_NODE_KINDS.contains(kind)) {
      out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_NODE", MdyDynamicDiagnostic.ERROR, path, "node must be field, group, or array."));
      return;
    }
    if (kind.equals("field")) {
      if (!node.path("field").isObject()) {
        out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, path + "/field", "field node requires a field object."));
      }
      return;
    }
    if (kind.equals("group")) {
      JsonNode children = node.path("children");
      if (!children.isObject()) {
        out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_GROUP", MdyDynamicDiagnostic.ERROR, path, "group requires children."));
        return;
      }
      for (var entry : children.properties()) {
        String key = entry.getKey();
        String childPath = path + "/children/" + key;
        if (!isSafeSegment(key)) {
          out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNSAFE_NAME", MdyDynamicDiagnostic.ERROR, childPath, "unsafe child name."));
        } else {
          validateSchema(entry.getValue(), childPath, depth + 1, out, count);
        }
      }
      return;
    }
    // array
    JsonNode item = node.path("item");
    if (!item.isObject()) {
      out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_ARRAY", MdyDynamicDiagnostic.ERROR, path, "array requires an item node."));
    } else {
      validateSchema(item, path + "/item", depth + 1, out, count);
    }
    JsonNode initialValue = node.path("initialValue");
    if (!initialValue.isMissingNode() && !initialValue.isArray()) {
      out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_ARRAY", MdyDynamicDiagnostic.ERROR, path + "/initialValue", "array initialValue must be an array."));
    } else if (initialValue.isArray() && initialValue.size() > SCHEMA_MAX_ARRAY_ROWS) {
      out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_SCHEMA_LIMIT", MdyDynamicDiagnostic.ERROR, path + "/initialValue", "array initialValue exceeds 100 rows."));
    }
  }

  private List<MdyDynamicField> flattenSchema(JsonNode schema) {
    List<MdyDynamicField> out = new ArrayList<>();
    flattenSchemaInto(schema, "", null, out);
    return out;
  }

  private void flattenSchemaInto(JsonNode node, String path, JsonNode initial, List<MdyDynamicField> out) {
    String kind = node.path("node").asText("");
    if (kind.equals("field")) {
      parseSingleField(node.get("field")).ifPresent(field -> {
        Object finalInitial = hasValue(initial) ? toObject(initial) : field.initialValue();
        out.add(withNameAndInitial(field, path, finalInitial));
      });
      return;
    }
    if (kind.equals("group")) {
      JsonNode value = hasValue(initial) && initial.isObject() ? initial : null;
      for (var entry : node.path("children").properties()) {
        String key = entry.getKey();
        if (!isSafeSegment(key)) continue;
        JsonNode childInitial = value != null ? value.path(key) : null;
        flattenSchemaInto(entry.getValue(), path.isEmpty() ? key : path + "." + key, childInitial, out);
      }
      return;
    }
    // array
    JsonNode item = node.get("item");
    JsonNode rows = hasValue(initial) && initial.isArray() ? initial
        : node.path("initialValue").isArray() ? node.path("initialValue") : null;
    if (rows != null) {
      for (int i = 0; i < rows.size(); i++) {
        flattenSchemaInto(item, path + "." + i, rows.get(i), out);
      }
    }
  }

  /** Validates one bare field config (no name/duplicate checks — the caller assigns the final path as name). */
  private Optional<MdyDynamicField> parseSingleField(JsonNode fieldConfig) {
    if (fieldConfig == null || !fieldConfig.isObject()) return Optional.empty();
    ObjectNode clone = fieldConfig.deepCopy();
    clone.put("name", "leaf");
    try {
      MdyDynamicField field = mapper.treeToValue(clone, MdyDynamicField.class);
      if (field instanceof MdyDynamicOptionsField opt && (opt.options() == null || opt.options().isEmpty())) {
        return Optional.empty();
      }
      return Optional.of(field);
    } catch (JsonProcessingException e) {
      return Optional.empty();
    }
  }

  private static MdyDynamicField withNameAndInitial(MdyDynamicField field, String name, Object initialValue) {
    if (field instanceof MdyDynamicTextField f) {
      return new MdyDynamicTextField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators());
    }
    if (field instanceof MdyDynamicNumberField f) {
      return new MdyDynamicNumberField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators(), f.min(), f.max(), f.step());
    }
    if (field instanceof MdyDynamicBooleanField f) {
      return new MdyDynamicBooleanField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators());
    }
    if (field instanceof MdyDynamicOptionsField f) {
      return new MdyDynamicOptionsField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators(), f.options(), f.mode());
    }
    if (field instanceof MdyDynamicDateField f) {
      return new MdyDynamicDateField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators());
    }
    throw new IllegalStateException("Unknown MdyDynamicField implementation: " + field.getClass());
  }

  private static boolean hasValue(JsonNode node) {
    return node != null && !node.isMissingNode() && !node.isNull();
  }

  private Object toObject(JsonNode node) {
    return mapper.convertValue(node, Object.class);
  }

  private static boolean isSafeSegment(String value) {
    return !value.isEmpty() && !value.contains(".") && !FORBIDDEN_NAMES.contains(value);
  }

  /** Depth cap for nested layout, matching the TS and Rust parsers. */
  private static final int LAYOUT_MAX_DEPTH = 6;

  /** The sizes a layout is authored against, mirroring MDY_LAYOUT_BREAKPOINTS. */
  private static final Set<String> LAYOUT_BREAKPOINTS = Set.of("base", "sm", "md", "lg");

  // ─── v2/v3 layout / rules: validate against resolved field names, keep raw nodes ───

  private void parseLayout(JsonNode layoutNode, Set<String> names, List<JsonNode> out, List<MdyDynamicDiagnostic> diagnostics) {
    if (layoutNode.isMissingNode()) return;
    if (!layoutNode.isArray()) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_LAYOUT", MdyDynamicDiagnostic.ERROR, "/layout", "layout must be an array."));
      return;
    }
    Set<String> placed = new LinkedHashSet<>();
    for (int i = 0; i < layoutNode.size(); i++) {
      JsonNode raw = layoutNode.get(i);
      String path = "/layout/" + i;
      if (!raw.isObject()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_LAYOUT", MdyDynamicDiagnostic.ERROR, path, "layout node must be an object."));
        continue;
      }
      Set<String> candidate = new LinkedHashSet<>(placed);
      if (!validLayoutNode(raw, names, candidate, 1)) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", MdyDynamicDiagnostic.ERROR, path, "layout references an unknown or already-placed field, or has an invalid shape."));
        continue;
      }
      placed = candidate;
      out.add(raw);
    }
  }

  /**
   * Validates one layout node and everything nested under it. A slot holds either a field
   * name or another layout node, so a column row can sit inside a section. Every leaf must
   * name a known field, and a field may only be placed once — the same field in two slots
   * would render twice and bind one value to both controls.
   */
  private boolean validLayoutNode(JsonNode raw, Set<String> names, Set<String> placed, int depth) {
    if (depth > LAYOUT_MAX_DEPTH || !raw.isObject() || !raw.path("id").isTextual()) return false;
    String kind = raw.path("kind").asText(null);

    List<JsonNode> slots = new ArrayList<>();
    if ("section".equals(kind)) {
      JsonNode children = raw.path("children");
      if (!children.isArray()) return false;
      slots.add(children);
    } else if ("columns".equals(kind)) {
      JsonNode columns = raw.path("columns");
      if (!columns.isArray()) return false;
      for (JsonNode column : columns) {
        if (!column.isArray()) return false;
        slots.add(column);
      }
    } else {
      return false;
    }

    // How many tracks this node has, so a slot cannot be sent to a column it does not have.
    // Zero marks a section: placement is refused there, because the column is the only element
    // a placement can act on.
    int tracks = 0;
    if ("columns".equals(kind)) {
      tracks = Math.max(1, raw.path("columns").size());
      JsonNode at = raw.path("at");
      if (at.isObject()) {
        for (JsonNode count : at) {
          if (count.isInt()) tracks = Math.max(tracks, count.asInt());
        }
      }
    }

    for (JsonNode slot : slots) {
      for (JsonNode child : slot) {
        if (child.isTextual()) {
          String name = child.asText();
          if (!names.contains(name) || !placed.add(name)) return false;
        } else if (child.isObject() && child.has("ref")) {
          // Contract v3's slot: a field name that also says where it sits, per size.
          if (!child.path("ref").isTextual()) return false;
          String name = child.path("ref").asText();
          if (!names.contains(name) || !validPlacement(child.path("at"), tracks) || !placed.add(name)) return false;
        } else {
          if (!validLayoutNode(child, names, placed, depth + 1)) return false;
          // A section's own `at` describes the column *this* node gives it, so it is checked
          // here rather than inside its own validation.
          if ("section".equals(child.path("kind").asText(null)) && !validPlacement(child.path("at"), tracks)) return false;
        }
      }
    }
    return true;
  }

  /** Whether a structured envelope carries a schema and a layout — v2 and everything after it. */
  private static boolean isStructuredVersion(int version) {
    return version == 2 || version == 3;
  }

  /**
   * A per-size placement the row can honour. {@code tracks} of 0 means there is no column at
   * all, and any placement is refused: {@code grid-column} and {@code display} belong to a grid
   * item, and only the column is one.
   */
  private boolean validPlacement(JsonNode at, int tracks) {
    if (at.isMissingNode() || at.isNull()) return true;
    if (tracks == 0 || !at.isObject()) return false;
    var sizes = at.fieldNames();
    while (sizes.hasNext()) {
      String size = sizes.next();
      if (!LAYOUT_BREAKPOINTS.contains(size)) return false;
      JsonNode placement = at.get(size);
      if (!placement.isObject()) return false;
      JsonNode column = placement.path("column");
      JsonNode hidden = placement.path("hidden");
      // A size that states neither is a typo worth refusing, not a no-op to keep.
      if (column.isMissingNode() && hidden.isMissingNode()) return false;
      if (!column.isMissingNode() && (!column.isInt() || column.asInt() < 1 || column.asInt() > tracks)) return false;
      if (!hidden.isMissingNode() && !hidden.isBoolean()) return false;
    }
    return true;
  }

  private void parseRules(JsonNode rulesNode, Set<String> names, List<JsonNode> out, List<MdyDynamicDiagnostic> diagnostics) {
    if (rulesNode.isMissingNode()) return;
    if (!rulesNode.isArray()) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_RULE", MdyDynamicDiagnostic.ERROR, "/rules", "rules must be an array."));
      return;
    }
    for (int i = 0; i < rulesNode.size(); i++) {
      JsonNode raw = rulesNode.get(i);
      String path = "/rules/" + i;
      if (!raw.isObject()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_RULE", MdyDynamicDiagnostic.ERROR, path, "rule must be an object."));
        continue;
      }
      String effect = raw.path("effect").asText(null);
      String target = raw.path("target").isTextual() ? raw.path("target").asText() : null;
      JsonNode when = raw.path("when");
      String whenField = when.path("field").isTextual() ? when.path("field").asText() : null;
      String operator = when.path("operator").asText(null);
      boolean valid = effect != null && RULE_EFFECTS.contains(effect)
          && target != null && names.contains(target)
          && when.isObject()
          && whenField != null && names.contains(whenField)
          && operator != null && RULE_OPERATORS.contains(operator);
      if (!valid) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_RULE", MdyDynamicDiagnostic.ERROR, path, "rule has an unsupported effect/operator or references an unknown field."));
        continue;
      }
      out.add(raw);
    }
  }


}
