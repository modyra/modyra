/**
 * Framework-agnostic devtools: a plain-DOM inspector panel that works with
 * a form running on ANY reactivity (it refreshes by polling, so it never
 * couples to the host graph). Sensitive-looking paths are masked.
 */
import { MdySignal } from "./reactivity.js";
import { MdyFormState } from "./types.js";

interface InspectableForm {
  readonly state: MdyFormState;
  readonly fieldNames?: MdySignal<readonly string[]>;
  getField(name: string): (() => {
    value(): unknown;
    valid(): boolean;
    touched(): boolean;
    dirty(): boolean;
    pending(): boolean;
    errors(): ReadonlyArray<{ readonly kind: string; readonly message: string }>;
  }) | null;
}

const SENSITIVE = /password|passwd|secret|token|card|cvv|ssn|iban/i;

/** One immutable snapshot of a form's state — also handy in tests/logs. */
export function mdyFormSnapshot(form: InspectableForm): {
  readonly valid: boolean;
  readonly pending: boolean;
  readonly submitting: boolean;
  readonly submitCount: number;
  readonly fields: ReadonlyArray<{
    readonly path: string;
    readonly value: unknown;
    readonly valid: boolean;
    readonly touched: boolean;
    readonly dirty: boolean;
    readonly pending: boolean;
    readonly errors: readonly string[];
  }>;
} {
  const names = form.fieldNames?.() ?? [];
  return {
    valid: form.state.valid(),
    pending: form.state.pending(),
    submitting: form.state.submitting(),
    submitCount: form.state.submitCount(),
    fields: names.map((path) => {
      const state = form.getField(path)?.();
      const masked = SENSITIVE.test(path);
      const raw = state?.value() ?? null;
      return {
        path,
        value: masked && raw !== null && raw !== "" ? "•••" : raw,
        valid: state?.valid() ?? true,
        touched: state?.touched() ?? false,
        dirty: state?.dirty() ?? false,
        pending: state?.pending() ?? false,
        errors: state?.errors().map((e) => `[${e.kind}] ${e.message}`) ?? [],
      };
    }),
  };
}

/**
 * Mounts the inspector into `host` and refreshes it every `intervalMs`
 * (default 300). Returns a dispose function. Same information as the
 * Angular devtools panel, zero framework requirements:
 *
 * ```ts
 * const dispose = mountMdyDevtools(form, document.getElementById("devtools")!);
 * ```
 */
export function mountMdyDevtools(
  form: InspectableForm,
  host: HTMLElement,
  intervalMs = 300,
): () => void {
  host.classList.add("mdy-devtools");
  host.style.cssText +=
    ";font:11px/1.5 ui-monospace,monospace;border:1px solid currentColor;border-radius:6px;padding:.4rem .6rem;display:block;opacity:.9";
  const render = (): void => {
    const s = mdyFormSnapshot(form);
    const rows = s.fields
      .map(
        (f) =>
          `<tr><td>${f.path}</td><td>${JSON.stringify(f.value)}</td>` +
          `<td>${f.valid ? "✓" : "✗"}</td><td>${f.touched ? "✓" : "·"}</td>` +
          `<td>${f.dirty ? "✓" : "·"}</td><td>${f.pending ? "…" : "·"}</td>` +
          `<td style="color:#d33">${f.errors.join(" | ")}</td></tr>`,
      )
      .join("");
    host.innerHTML =
      `<b>modyra devtools</b> ` +
      `<span style="color:${s.valid ? "#292" : "#d33"}">valid: ${s.valid}</span> ` +
      `pending: ${s.pending} · submitting: ${s.submitting} · submits: ${s.submitCount}` +
      `<table style="border-collapse:collapse;width:100%;margin-top:.3rem">` +
      `<thead><tr><th align="left">field</th><th align="left">value</th>` +
      `<th>valid</th><th>touched</th><th>dirty</th><th>pending</th><th align="left">errors</th></tr></thead>` +
      `<tbody>${rows}</tbody></table>`;
  };
  render();
  const timer = setInterval(render, intervalMs);
  return () => {
    clearInterval(timer);
    host.innerHTML = "";
  };
}
