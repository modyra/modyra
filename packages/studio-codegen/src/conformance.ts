/**
 * Reusable conformance suite (plan section 10) — every target must pass
 * this against at least one project (the checkout fixture, in this
 * repo's tests) before it ships. Checks what's testable against a single
 * generate() call: determinism, no project mutation, safe file paths,
 * stable diagnostic shape, and a consistent entryFile. Stale/cancel
 * handling is a caller-side (studio-ui) concern — see its generation-id
 * guard — not something a single generate() call can prove in isolation.
 */
import type { MdyStudioProject } from "@modyra/studio-model";
import type { StudioTarget } from "./types.js";

export interface ConformanceResult {
  readonly passed: boolean;
  readonly failures: readonly string[];
}

export async function runConformanceSuite<T>(target: StudioTarget<T>, project: MdyStudioProject): Promise<ConformanceResult> {
  const failures: string[] = [];
  const options = target.defaults();
  const before = JSON.stringify(project);

  const first = await target.generate(project, options);
  if (JSON.stringify(project) !== before) {
    failures.push("generate() mutated its input project");
  }

  const second = await target.generate(project, options);
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    failures.push("generate() is not deterministic — same project+options produced different output");
  }

  // Nothing generated *and* nothing said. A target that finds a project it cannot express reports it
  // — that is what diagnostics are for, and `analyze` answers the same question earlier — so silence
  // with no output is a target claiming it succeeded at producing nothing. This suite exists to be
  // passed before a target ships, and passing by having nothing to check is the emptiest way through
  // it. A target that emits no files and says why is conformant, which is the legitimate case.
  if (first.files.length === 0 && !first.diagnostics.some((d) => d.severity === "error")) {
    failures.push("generate() produced no files and reported no error explaining why");
  }

  const seenPaths = new Set<string>();
  for (const file of first.files) {
    if (!isWritableRelativePath(file.path)) {
      failures.push(`unsafe file path: "${file.path}"`);
    }
    if (!file.path || !file.language || !file.role) {
      failures.push(`file "${file.path}" is missing path/language/role`);
    }
    // A file is a path, a language, a role **and content**. Three were checked, so a file with no
    // content, or content that is a number, was conformant — and a host writes what it is handed.
    if (typeof file.content !== "string") {
      failures.push(`file "${file.path}" has no string content`);
    }
    // Two files at one path is a target overwriting its own output: whichever a host writes second
    // is the one that survives, and which that is depends on how the host iterates.
    if (seenPaths.has(file.path)) {
      failures.push(`two files share the path "${file.path}"`);
    }
    seenPaths.add(file.path);
  }

  for (const d of first.diagnostics) {
    if (typeof d.code !== "string" || !d.code) failures.push("a diagnostic is missing a code");
    if (!["error", "warning", "info"].includes(d.severity)) failures.push(`a diagnostic has an invalid severity: "${d.severity}"`);
    if (typeof d.message !== "string" || !d.message) failures.push("a diagnostic is missing a message");
  }

  if (first.entryFile && !first.files.some((f) => f.path === first.entryFile)) {
    failures.push(`entryFile "${first.entryFile}" is not among the generated files`);
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Whether a generated file's path stays inside the directory a host writes into.
 *
 * Both separators, because a path is written by a target and resolved by a host — and a host on
 * Windows reads `..\\out.ts` exactly as this reads `../out.ts`. Checking one notation is the same
 * shape of hole as a rule that catches `(a|a)*` and misses `([a-z]|[a-z])*`: right about the
 * examples it was written against, blind to the other spelling.
 *
 * Refused: an absolute path in either notation, a drive letter, a UNC share, and `..` as a segment
 * however the segments are separated.
 */
function isWritableRelativePath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  const separator = String.fromCharCode(92);
  if (path.startsWith("/") || path.startsWith(separator)) return false;
  // `C:` or `c:/…` — a drive-qualified path is absolute on the host that understands it.
  if (/^[A-Za-z]:/.test(path)) return false;
  const segments = path.split(new RegExp(`[/${separator}${separator}]`));
  return !segments.includes("..");
}
