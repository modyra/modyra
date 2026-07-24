package dev.modyra.contract;

import java.util.List;

/**
 * Mirrors {@code MdyDynamicFormParseResult} in packages/core/src/dynamic-config.ts.
 * {@code layout}/{@code rules} are omitted from this MVP — this parser
 * handles the flat field-list envelope only (v1 {@code {fields:[...]}},
 * the legacy bare array, and a v2 envelope's already-flat {@code fields}),
 * not the recursive {@code schema}/{@code layout}/{@code rules} v2 adds.
 * See the class doc on {@link MdyDynamicFormParser} for the full scope note.
 */
public record MdyDynamicFormParseResult(
    boolean ok,
    Integer version,
    List<MdyDynamicField> fields,
    List<MdyDynamicDiagnostic> diagnostics,
    int acceptedCount,
    int rejectedCount
) {
}
