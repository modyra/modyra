/**
 * Framework-agnostic devtools: a plain-DOM inspector panel that works with
 * a form running on ANY reactivity (it refreshes by polling, so it never
 * couples to the host graph). Sensitive-looking paths are masked.
 */
import { MdyReactivity, MdySignal } from "./reactivity.js";
import { MdyFormState } from "./types.js";

interface InspectableForm {
  readonly state: MdyFormState;
  readonly fieldNames?: MdySignal<readonly string[]>;
  /** Exposed by every engine-backed form — enables reactive rendering. */
  readonly reactivity?: MdyReactivity;
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

/**
 * Escapes a string for safe interpolation into the panel's innerHTML.
 * Field paths, values and error messages can carry user- or server-supplied
 * text (SECURITY.md: never render external strings as HTML).
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
 * Mounts the inspector into `host` and returns a dispose function.
 *
 * Rendering is **reactive**: the panel subscribes an effect on the form's
 * own reactive graph (`form.reactivity`), so it repaints in the same
 * change-propagation cycle as the form itself — no polling, no lag. When
 * the form exposes no effect-capable reactivity, it falls back to a
 * `intervalMs` polling refresh (default 300 ms).
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
          `<tr><td>${escapeHtml(f.path)}</td><td>${escapeHtml(JSON.stringify(f.value) ?? "undefined")}</td>` +
          `<td>${f.valid ? "✓" : "✗"}</td><td>${f.touched ? "✓" : "·"}</td>` +
          `<td>${f.dirty ? "✓" : "·"}</td><td>${f.pending ? "…" : "·"}</td>` +
          `<td style="color:#d33">${escapeHtml(f.errors.join(" | "))}</td></tr>`,
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
  const rx = form.reactivity;
  if (rx && rx.canEffect) {
    // Reactive path: mdyFormSnapshot reads every field signal inside the
    // effect, so any change re-renders in the same propagation cycle.
    const ref = rx.effect(() => render());
    return () => {
      ref.destroy();
      host.innerHTML = "";
    };
  }
  render();
  const timer = setInterval(render, intervalMs);
  return () => {
    clearInterval(timer);
    host.innerHTML = "";
  };
}
