/**
 * Framework-agnostic devtools: a plain-DOM inspector panel that works with
 * a form running on ANY reactivity (it refreshes by polling, so it never
 * couples to the host graph). Sensitive-looking paths are masked.
 */
import { MdyReactivity, MdySignal, reactivityRunsEffects } from "./reactivity-contract.js";
import { mdyFormSerialize } from "./serialize.js";
import { MdyFormState } from "./types.js";

interface InspectableForm {
  readonly state: MdyFormState;
  readonly fieldNames?: MdySignal<readonly string[]>;
  /**
   * The paths the schema declared as secrets.
   *
   * Optional because the panel takes any form-shaped object, including the doubles a test builds.
   * Where it is present it outranks the name heuristic, which is a guess in both directions.
   */
  sensitivePaths?(): readonly string[];
  /** Exposed by every engine-backed form — enables reactive rendering. */
  readonly reactivity?: MdyReactivity;
  getField(name: string): (() => {
    value(): unknown;
    valid(): boolean;
    touched(): boolean;
    dirty(): boolean;
    pending(): boolean;
    errors(): ReadonlyArray<{
      readonly kind: string;
      readonly message: string;
      /** Where it came from, when the form knows — see {@link MdyFieldError.origin}. */
      readonly origin?: string;
    }>;
  }) | null;
}

const SENSITIVE = /password|passwd|secret|token|card|cvv|ssn|iban/i;

/**
 * Whether a field's value is masked in the panel.
 *
 * The name heuristic is a guess, and it is wrong in both directions — `notes` can hold a recovery
 * phrase and `cardStyle` is masked for containing "card". So a declaration wins wherever there is
 * one, and the guess only fills the silence.
 */
export function isSensitivePath(path: string, declared?: boolean): boolean {
  return declared ?? SENSITIVE.test(path);
}

/** What a form says about which of its fields may be shown in the clear. */
export interface MdySnapshotOptions {
  /** `true` masks, `false` reveals, `undefined` falls back to the name heuristic. */
  readonly sensitive?: (path: string) => boolean | undefined;
}

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


/**
 * Whether a path is declared a secret, or sits under one.
 *
 * A declaration covers what is under it: naming a collection hides its rows, which is what a person
 * hiding a table of payment rows means by writing its name.
 */
function coveredBySecret(secrets: ReadonlySet<string>, path: string): boolean {
  if (secrets.has(path)) return true;
  for (const secret of secrets) {
    if (path.startsWith(`${secret}.`)) return true;
  }
  return false;
}

/** What a masked value reads as, wherever it would otherwise be printed. */
const MASK = "•••";

/**
 * The message with the field's own value taken out of it.
 *
 * Masking a value and printing it back in the column beside it does not mask the value, and quoting
 * what was rejected — `"hunter2" is not long enough` — is the most ordinary way there is to write a
 * validation message. The server half cannot be fixed by the consumer at all: a message that arrives
 * over the wire is not theirs to rewrite.
 *
 * The message is kept rather than dropped: why a field is invalid is what a panel exists to show.
 */
function withoutValue(message: string, raw: unknown): string {
  const literals: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === "string") { if (value.length > 0) literals.push(value); return; }
    if (typeof value === "number" || typeof value === "bigint") { literals.push(String(value)); return; }
    if (Array.isArray(value)) { for (const entry of value) collect(entry); }
  };
  collect(raw);
  // Longest first: a value that contains another must not leave the shorter one's occurrence behind
  // as a fragment of a mask it already replaced.
  return literals
    .sort((a, b) => b.length - a.length)
    .reduce((text, literal) => text.split(literal).join(MASK), message);
}

/** One immutable snapshot of a form's state — also handy in tests/logs. */
export function mdyFormSnapshot(form: InspectableForm, options: MdySnapshotOptions = {}): {
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
    /**
     * Why the value reads as bullets, when it does.
     *
     * The panel masks two different things and printed them identically: a field the schema declares
     * a secret, protected wherever the value would otherwise be copied, and a field whose *name*
     * looks like one, protected here and nowhere else — a draft writes it to storage in clear. A
     * reader seeing bullets drew the stronger conclusion because nothing on the row offered the
     * weaker one.
     */
    readonly masked?: "declared" | "guessed" | "caller";
  }>;
} {
  const names = form.fieldNames?.() ?? [];
  const declaredSecret = new Set(form.sensitivePaths?.() ?? []);
  return {
    valid: form.state.valid(),
    pending: form.state.pending(),
    submitting: form.state.submitting(),
    submitCount: form.state.submitCount(),
    fields: names.map((path) => {
      const state = form.getField(path)?.();
      // The caller's predicate first — it is the panel's own override — then what the schema
      // declared, then the name.
      const fromCaller = options.sensitive?.(path);
      const fromSchema = coveredBySecret(declaredSecret, path) ? true : undefined;
      const masked = isSensitivePath(path, fromCaller ?? fromSchema);
      // Which of the three said so, in the order they are consulted. A guess is the weakest of them
      // and the only one that protects nothing anywhere else.
      const maskedBy = !masked
        ? undefined
        : fromCaller === true
          ? "caller" as const
          : fromSchema === true
            ? "declared" as const
            : "guessed" as const;
      const raw = state?.value() ?? null;
      // The origin the form knows, and the payload's word only when there is none: prefixing with
      // `kind` printed `[unknown]` for the ordinary server refusal — `{ path, message }` — and
      // `[validation]` for one that called itself that, side by side with a rule this form ran.
      const messages = state?.errors().map((e) => `[${e.origin ?? e.kind}] ${e.message}`) ?? [];
      return {
        path,
        // Described rather than handed over: a `File` carries no `toJSON`, so a snapshot that
        // passed it through read as `{}` — the same as a field nobody filled — where the panel
        // beside it shows the name and size the guide promises.
        value: masked && raw !== null && raw !== "" ? MASK : mdyFormSerialize(raw),
        valid: state?.valid() ?? true,
        touched: state?.touched() ?? false,
        dirty: state?.dirty() ?? false,
        pending: state?.pending() ?? false,
        errors: masked ? messages.map((message) => withoutValue(message, raw)) : messages,
        ...(maskedBy === undefined ? {} : { masked: maskedBy }),
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
          // A masked value says which of the three decided it, where a reader hovers. A guess is
          // masked here and nowhere else — the draft writes that value to storage in clear — so a
          // panel that showed the same bullets for both was making a promise it does not keep.
          `<tr><td>${escapeHtml(f.path)}</td><td${
            f.masked === undefined
              ? ""
              : ` title="${f.masked === "guessed"
                ? "masked because the name looks like a secret — nothing else protects it"
                : f.masked === "declared"
                  ? "declared sensitive by the schema — kept out of drafts and copies"
                  : "masked by this panel's own predicate"}"`
          }>${escapeHtml(JSON.stringify(f.value) ?? "undefined")}</td>` +
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
  if (rx && reactivityRunsEffects(rx)) {
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
