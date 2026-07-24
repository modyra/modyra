/**
 * P11 Workers (plan §11 "generate ... off main thread"): the pure, DOM-free
 * half of the generate pipeline, importable from a Web Worker without
 * pulling in any rendering code. Registers the exact same lazy target
 * registry `mountStudio()` itself uses (R5: target = lazy plugin) so a
 * worker-hosted generate is byte-identical to the main-thread one it
 * replaces — this file has no `typescript` dependency of its own; a host
 * (e.g. apps/studio's codegen-worker.ts) that wants real syntax-check/
 * format on top brings that dependency itself and post-processes the
 * returned {@link Artifact}.
 */
import { TargetRegistry, type Artifact } from "@modyra/studio-codegen";
import type { MdyStudioProject } from "@modyra/studio-model";
import { jsonTargetManifest } from "@modyra/studio-target-json";
import { coreTargetManifest } from "@modyra/studio-target-core";
import { angularTargetManifest } from "@modyra/studio-target-angular";
import { reactTargetManifest } from "@modyra/studio-target-react";

const registry = new TargetRegistry();
registry.register(jsonTargetManifest);
registry.register(coreTargetManifest);
registry.register(angularTargetManifest);
registry.register(reactTargetManifest);

export interface GenerateJobRequest {
  readonly targetId: string;
  readonly project: MdyStudioProject;
  readonly options?: unknown;
}

/** Loads (and caches) the requested target, then generates — same call shape `runExport()` uses on the main thread. */
export async function runGenerateJob(request: GenerateJobRequest): Promise<Artifact> {
  const target = await registry.load(request.targetId);
  return target.generate(request.project, request.options ?? target.defaults());
}
