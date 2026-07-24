/**
 * Plan section 11 "server mock: delay/valid-values/error/timeout/network-
 * failure" — Studio's server validators/submit actions are always symbolic
 * stubs (ADR-0005, R7, R11: no real implementation exists at design time),
 * so the live preview needs something to actually call. This is a preview-
 * session concern, not part of the Studio project model.
 */
import type { MdyAsyncValidationContext, MdyFormError } from "@modyra/core";

export interface MockServerConfig {
  /** Milliseconds to wait before resolving/rejecting. Default 300. */
  readonly delayMs?: number;
  /** If set, the mock never settles before this — the field's own asyncTimeoutMs (if any) is what actually surfaces the timeout. */
  readonly timeoutMs?: number;
  /** Always fails with this message (or messages). */
  readonly forceError?: string | readonly string[];
  /** Rejects the promise instead of resolving — simulates a network failure (a real infra fault, not a validation failure). */
  readonly forceNetworkFailure?: boolean;
  /** If set, only these values are considered valid; anything else fails. */
  readonly validValues?: readonly string[];
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

/** Builds a mock async validator matching `MdyAsyncValidatorFn` — for wiring into a field's server-validation slot in the live preview. */
export function createMockAsyncValidator(config: MockServerConfig = {}) {
  return async (value: unknown, ctx: MdyAsyncValidationContext): Promise<readonly string[]> => {
    await wait(config.delayMs ?? 300, ctx.signal);
    if (config.forceNetworkFailure) throw new Error("Mock network failure");
    if (config.forceError) return Array.isArray(config.forceError) ? config.forceError : [config.forceError as string];
    if (config.validValues && typeof value === "string" && !config.validValues.includes(value)) {
      return [`"${value}" is not a recognized value`];
    }
    return [];
  };
}

/** Builds a mock submit action — for wiring into `form.submit()` in the live preview. */
export function createMockSubmitAction(config: MockServerConfig = {}) {
  return async (): Promise<MdyFormError[] | void> => {
    await wait(config.delayMs ?? 300);
    if (config.forceNetworkFailure) throw new Error("Mock network failure");
    if (config.forceError) {
      const messages = Array.isArray(config.forceError) ? config.forceError : [config.forceError as string];
      return messages.map((message) => ({ path: null, kind: "server", message }));
    }
  };
}
