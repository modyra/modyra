package dev.modyra.contract;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

/**
 * Mirrors {@code MdyDynamicFormParseResult} in packages/core/src/dynamic-config.ts.
 * {@code layout} and {@code rules} entries are the raw, validated JSON nodes
 * (section/columns layout nodes, visibility rules) — same as the TS
 * reference implementation, which stores the validated raw object rather
 * than re-typing it. See {@link MdyDynamicFormParser} for the recursive
 * {@code schema} envelope this now supports.
 */
public record MdyDynamicFormParseResult(
    boolean ok,
    Integer version,
    List<MdyDynamicField> fields,
    List<JsonNode> layout,
    List<JsonNode> rules,
    List<MdyDynamicDiagnostic> diagnostics,
    int acceptedCount,
    int rejectedCount
) {
}
