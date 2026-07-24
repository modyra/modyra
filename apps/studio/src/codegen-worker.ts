/**
 * P11 Workers (plan §11 "generate/format/syntax ... off main thread"). This
 * runs in its own esbuild bundle (build.mjs's second entry point), never in
 * the main studio.js bundle — `typescript` (the one dependency this batch
 * was approved to add) only ever loads here, so the main UI bundle stays
 * untouched by its size.
 *
 * Protocol: the host posts one {@link GenerateRequest} per Generate click;
 * this worker always replies with exactly one {@link GenerateResponse}
 * carrying the same `id`. Out-of-order replies are the host's problem to
 * discard (mountStudio's existing `exportState.generation` guard already
 * does this — see packages/studio-ui/src/index.ts's `runExport()` — a
 * worker reply is just another async result arriving late).
 */
import ts from "typescript";
import { runGenerateJob, type GenerateJobRequest } from "@modyra/studio-ui/worker-toolkit";
import type { Artifact, ArtifactFile } from "@modyra/studio-codegen";
import type { StudioDiagnostic } from "@modyra/studio-model";
import typecheckAssets from "../.generated/typecheck-assets.json";
import { checkTypes, supportsSemanticCheck, type VirtualFile } from "./typecheck-host.js";

export interface GenerateRequest {
  readonly id: number;
  readonly job: GenerateJobRequest;
}

export type GenerateResponse =
  | { readonly id: number; readonly ok: true; readonly artifact: Artifact }
  | { readonly id: number; readonly ok: false; readonly error: string };

/** Real syntax validation via the TS parser — catches malformed generated source instead of shipping it silently. Not a full cross-file typecheck (that needs a whole in-memory Program + lib.d.ts, a separate batch). */
function checkSyntax(file: ArtifactFile): StudioDiagnostic[] {
  const result = ts.transpileModule(file.content, {
    fileName: file.path,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return (result.diagnostics ?? [])
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => ({
      code: `TS${d.code}`,
      severity: "error" as const,
      message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      propertyPath: file.path,
    }));
}

/** Re-prints the parsed AST through TS's own printer — a real, deterministic normalization pass, not a no-op. */
function formatSource(file: ArtifactFile): string {
  const sourceFile = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  return printer.printFile(sourceFile);
}

/** Real cross-file typecheck (an in-memory ts.Program — see typecheck-host.ts) when the vendored .d.ts assets cover every bare import in play, else no-op: better to report nothing than a false "cannot find module". */
function checkSemantics(files: readonly VirtualFile[]): StudioDiagnostic[] {
  if (!supportsSemanticCheck(typecheckAssets, files)) return [];
  return checkTypes(typecheckAssets, files).flatMap((d) => {
    if (d.category !== ts.DiagnosticCategory.Error) return [];
    const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    const propertyPath = d.file && d.start !== undefined
      ? (() => {
          const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
          return `${d.file.fileName.replace(/^\/project\//, "")}:${line + 1}:${character + 1}`;
        })()
      : undefined;
    return [{ code: `TS${d.code}`, severity: "error" as const, message, propertyPath }];
  });
}

async function handleGenerate(job: GenerateJobRequest): Promise<Artifact> {
  const artifact = await runGenerateJob(job);
  const extraDiagnostics: StudioDiagnostic[] = [];
  const tsFiles: VirtualFile[] = [];
  const files = artifact.files.map((file) => {
    if (file.language !== "typescript") return file;
    extraDiagnostics.push(...checkSyntax(file));
    const formatted = formatSource(file);
    tsFiles.push({ path: file.path, content: formatted });
    return { ...file, content: formatted };
  });
  extraDiagnostics.push(...checkSemantics(tsFiles));
  return { ...artifact, files, diagnostics: [...artifact.diagnostics, ...extraDiagnostics] };
}

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const { id, job } = event.data;
  handleGenerate(job)
    .then((artifact) => {
      const response: GenerateResponse = { id, ok: true, artifact };
      (self as unknown as Worker).postMessage(response);
    })
    .catch((error: unknown) => {
      const response: GenerateResponse = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
      (self as unknown as Worker).postMessage(response);
    });
};
