package dev.modyra.contract;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Mirrors {@code parseDynamicForm}/{@code parseDynamicFields} in
 * packages/core/src/dynamic-config.ts: never throws on untrusted input,
 * every field is validated independently (a bad one is dropped with a
 * diagnostic, not a parse failure for the whole document), and
 * {@code STRICT} mode returns no fields at all if any diagnostic exists
 * (never publish/accept a partially-valid document), matching TS exactly.
 *
 * <p><b>Scope of this MVP</b>: handles the flat envelope shapes — a bare
 * JSON array, or {@code {"version": 1|2, "fields": [...]}} — the same
 * input {@code parseDynamicFields()} accepts on the TS side. The v2
 * recursive {@code schema}/{@code layout}/{@code rules} envelope (nested
 * groups/arrays, declarative visibility rules) is <b>not implemented
 * here yet</b> — a real, documented gap, not a silent one. An input using
 * that shape reports {@code ok=false} with a diagnostic explaining why,
 * rather than silently misparsing it.
 */
public final class MdyDynamicFormParser {

  public enum Mode { STRICT, LENIENT }

  private static final Set<String> FORBIDDEN_NAMES = Set.of("__proto__", "prototype", "constructor");

  private final ObjectMapper mapper = new ObjectMapper();

  public MdyDynamicFormParseResult parse(String json, Mode mode) {
    JsonNode root;
    try {
      root = mapper.readTree(json);
    } catch (JsonProcessingException e) {
      return new MdyDynamicFormParseResult(
          false, null, List.of(),
          List.of(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_JSON", MdyDynamicDiagnostic.ERROR, "/", "Input is not valid JSON: " + e.getOriginalMessage())),
          0, 0);
    }
    return parse(root, mode);
  }

  public MdyDynamicFormParseResult parse(JsonNode root, Mode mode) {
    JsonNode itemsNode;
    int version;

    if (root.isArray()) {
      itemsNode = root;
      version = 1;
    } else if (root.isObject() && root.has("fields")) {
      JsonNode versionNode = root.get("version");
      int v = versionNode != null && versionNode.isInt() ? versionNode.asInt() : -1;
      if (v != 1 && v != 2) {
        return new MdyDynamicFormParseResult(false, null, List.of(), List.of(), 0, 0);
      }
      version = v;
      itemsNode = root.get("fields");
      if (itemsNode == null || !itemsNode.isArray()) {
        return new MdyDynamicFormParseResult(
            false, version, List.of(),
            List.of(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELDS", MdyDynamicDiagnostic.ERROR, "/fields", "fields must be an array.")),
            0, 0);
      }
    } else {
      String reason = root.isObject() && root.has("schema")
          ? "This Java parser does not support the v2 schema/layout/rules envelope yet — only a flat field array or {version, fields}."
          : "Input is neither a field array nor a {version, fields} envelope.";
      return new MdyDynamicFormParseResult(
          false, null, List.of(),
          List.of(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_INPUT", MdyDynamicDiagnostic.ERROR, "/", reason)),
          0, 0);
    }

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

    boolean strict = mode == Mode.STRICT;
    boolean ok = !strict || diagnostics.isEmpty();
    int rejectedCount = itemsNode.size() - accepted.size();
    boolean blockAll = strict && !diagnostics.isEmpty();
    return new MdyDynamicFormParseResult(
        ok,
        version,
        blockAll ? List.of() : List.copyOf(accepted),
        List.copyOf(diagnostics),
        accepted.size(),
        rejectedCount);
  }
}
