/**
 * Structured diagnostics for reactivity adapters — replaces ad-hoc
 * `console.warn()` calls so a consumer can route adapter-degradation
 * events (missing Injector, unsupported option, disabled async feature)
 * to their own logging/telemetry (`.modyra/piano-modyra-reactivity-adapter-api.md` §13).
 */

export type MdyDiagnosticSeverity = "info" | "warning" | "error";

export interface MdyDiagnostic {
  readonly code: string;
  readonly severity: MdyDiagnosticSeverity;
  readonly feature?: string | undefined;
  readonly adapter?: string | undefined;
  readonly message: string;
  readonly cause?: unknown;
}

export interface MdyDiagnostics {
  report(diagnostic: MdyDiagnostic): void;
}

/** Diagnostic codes emitted by core and the reference adapters. */
export const MDY_EFFECTS_UNAVAILABLE = "MDY_EFFECTS_UNAVAILABLE";
export const MDY_SCOPE_DESTROYED = "MDY_SCOPE_DESTROYED";
export const MDY_CROSS_RUNTIME_OBSERVATION = "MDY_CROSS_RUNTIME_OBSERVATION";
export const MDY_UNSUPPORTED_ADAPTER_OPTION = "MDY_UNSUPPORTED_ADAPTER_OPTION";
export const MDY_ASYNC_FEATURE_DISABLED = "MDY_ASYNC_FEATURE_DISABLED";
export const MDY_SSR_SNAPSHOT_MISMATCH = "MDY_SSR_SNAPSHOT_MISMATCH";
export const MDY_ADAPTER_CONTRACT_VIOLATION = "MDY_ADAPTER_CONTRACT_VIOLATION";

/** Reports every diagnostic to `console` (mapped by severity). Suitable as a dev-mode default. */
export function createConsoleDiagnostics(): MdyDiagnostics {
  return {
    report(diagnostic: MdyDiagnostic): void {
      const line = `[modyra:${diagnostic.code}] ${diagnostic.message}`;
      if (diagnostic.severity === "error") console.error(line, diagnostic.cause ?? "");
      else if (diagnostic.severity === "warning") console.warn(line);
      else console.info(line);
    },
  };
}

/** Reports nothing — the default when a consumer opts out of diagnostics. */
export function createSilentDiagnostics(): MdyDiagnostics {
  return {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op sink
    report(): void {},
  };
}
