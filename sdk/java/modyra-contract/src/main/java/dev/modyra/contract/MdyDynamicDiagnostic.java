package dev.modyra.contract;

/** Mirrors {@code MdyDynamicDiagnostic} in packages/core/src/dynamic-config.ts. */
public record MdyDynamicDiagnostic(String code, String severity, String path, String message) {
  public static final String WARNING = "warning";
  public static final String ERROR = "error";
}
