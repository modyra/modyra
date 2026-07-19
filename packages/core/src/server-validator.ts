/**
 * serverValidator(check, options) — ergonomic factory for server-side async
 * validation. Returns an MdyFieldOptions fragment ready for field().
 * `check` may return a single message, an array, or null/undefined (valid).
 */
import type { MdyAsyncValidationContext } from "./types.js";
import type { MdyFieldOptions } from "./typed-form.js";

export interface MdyServerValidatorOptions<TValue = unknown> {
  readonly debounceMs?: number;
  readonly timeoutMs?: number;
  readonly dependsOn?: ReadonlyArray<string>;
  readonly when?: (value: TValue, formValue: Record<string, unknown>) => boolean;
}

export function serverValidator<TValue>(
  check: (value: TValue, ctx: MdyAsyncValidationContext) =>
    Promise<string | readonly string[] | null | undefined>,
  options?: MdyServerValidatorOptions<TValue>,
): MdyFieldOptions<TValue> {
  return {
    asyncValidators: [
      async (value, ctx) => {
        const result = await check(value, ctx);
        if (result == null) return [];
        return typeof result === "string" ? [result] : result;
      },
    ],
    asyncDebounceMs: options?.debounceMs ?? 0,
    asyncDependsOn: options?.dependsOn,
    asyncTimeoutMs: options?.timeoutMs,
    asyncWhen: options?.when,
  };
}
