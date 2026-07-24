/**
 * Reusable conformance suite (plan section 10) — every target must pass
 * this against at least one real project (the checkout fixture, in this
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

  for (const file of first.files) {
    if (file.path.startsWith("/") || file.path.split("/").includes("..")) {
      failures.push(`unsafe file path: "${file.path}"`);
    }
    if (!file.path || !file.language || !file.role) {
      failures.push(`file "${file.path}" is missing path/language/role`);
    }
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
