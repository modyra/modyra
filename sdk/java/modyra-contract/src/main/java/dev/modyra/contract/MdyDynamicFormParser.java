package dev.modyra.contract;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashSet;
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

  private final ObjectMapper mapper = new ObjectMapper();

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
    } else if (root.isObject() && root.path("version").asInt(-1) == 2 && root.has("schema")) {
      version = 2;
      List<MdyDynamicDiagnostic> schemaDiagnostics = new ArrayList<>();
      validateSchema(root.get("schema"), "/schema", 0, schemaDiagnostics, new int[]{0});
      diagnostics.addAll(schemaDiagnostics);
      accepted = schemaDiagnostics.isEmpty() ? flattenSchema(root.get("schema")) : List.of();
      sourceCount = accepted.size();
    } else if (root.isObject() && root.has("fields")) {
      int v = root.path("version").isInt() ? root.path("version").asInt() : -1;
      if (v != 1 && v != 2) {
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
    if (version == 2 && root.isObject()) {
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
      return new MdyDynamicOptionsField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators(), f.options());
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

  // ─── v2 layout / rules: validate against resolved field names, keep raw nodes ───

  private void parseLayout(JsonNode layoutNode, Set<String> names, List<JsonNode> out, List<MdyDynamicDiagnostic> diagnostics) {
    if (layoutNode.isMissingNode()) return;
    if (!layoutNode.isArray()) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_LAYOUT", MdyDynamicDiagnostic.ERROR, "/layout", "layout must be an array."));
      return;
    }
    for (int i = 0; i < layoutNode.size(); i++) {
      JsonNode raw = layoutNode.get(i);
      String path = "/layout/" + i;
      if (!raw.isObject()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_LAYOUT", MdyDynamicDiagnostic.ERROR, path, "layout node must be an object."));
        continue;
      }
      String kind = raw.path("kind").asText(null);
      boolean hasId = raw.path("id").isTextual();
      JsonNode refs = "section".equals(kind) ? raw.path("children")
          : "columns".equals(kind) ? flattenColumns(raw.path("columns"))
          : null;
      if (!hasId || refs == null || !refs.isArray() || !allRefsValid(refs, names)) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", MdyDynamicDiagnostic.ERROR, path, "layout references an unknown field or has an invalid shape."));
        continue;
      }
      out.add(raw);
    }
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

  private static JsonNode flattenColumns(JsonNode columnsNode) {
    if (!columnsNode.isArray()) return null;
    ArrayNode flat = JsonNodeFactory.instance.arrayNode();
    for (JsonNode column : columnsNode) {
      if (!column.isArray()) return null;
      flat.addAll((ArrayNode) column);
    }
    return flat;
  }

  private static boolean allRefsValid(JsonNode refs, Set<String> names) {
    for (JsonNode ref : refs) {
      if (!ref.isTextual() || !names.contains(ref.asText())) return false;
    }
    return true;
  }
}
