import { mountStudio } from "@modyra/studio-ui";
// The canvas draws Modyra controls, so their structure is Modyra's own: the layout grid, the field
// height, the popup container and the chip primitive come from the foundation rather than from rules
// Studio restates. Imported before Studio's chrome, so Studio's own rules layer over it.
import "@modyra/styles/foundation.css";
import "@modyra/studio-ui/studio.css";
import type { GenerateRequest, GenerateResponse } from "./codegen-worker.js";

const host = document.querySelector<HTMLElement>("[data-modyra-studio]");
if (!host) throw new Error("Missing [data-modyra-studio] mount point");

/** generate/syntax-check/format run in codegen-worker.js, never on this thread. One request in flight at a time is all runExport() ever issues — a plain incrementing id plus a pending-map is enough, no queue needed. */
const worker = new Worker(new URL("./codegen-worker.js", import.meta.url), { type: "module" });
let nextRequestId = 0;
const GENERATE_TIMEOUT_MS = 30_000;
interface PendingRequest {
  readonly resolve: (value: GenerateResponse) => void;
  readonly reject: (reason: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}
const pending = new Map<number, PendingRequest>();

function settleAllPending(error: Error): void {
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    request.reject(error);
  }
  pending.clear();
}

worker.onmessage = (event: MessageEvent<GenerateResponse>) => {
  const entry = pending.get(event.data.id);
  if (!entry) return;
  pending.delete(event.data.id);
  clearTimeout(entry.timeout);
  entry.resolve(event.data);
};
worker.onerror = (event) => {
  event.preventDefault();
  settleAllPending(new Error(event.message || "The code-generation worker failed"));
};
worker.onmessageerror = () => {
  settleAllPending(new Error("The code-generation worker returned an unreadable response"));
};

mountStudio(host, undefined, {
  generateOffMainThread: (job) =>
    new Promise((resolve, reject) => {
      const id = nextRequestId++;
      const timeout = setTimeout(() => {
        if (!pending.delete(id)) return;
        reject(new Error(`Code generation timed out after ${GENERATE_TIMEOUT_MS} ms`));
      }, GENERATE_TIMEOUT_MS);
      pending.set(id, {
        resolve: (response) => (response.ok ? resolve(response.artifact) : reject(new Error(response.error))),
        reject,
        timeout,
      });
      const request: GenerateRequest = { id, job };
      try {
        worker.postMessage(request);
      } catch (error) {
        clearTimeout(timeout);
        pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }),
});
