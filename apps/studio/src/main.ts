import { mountStudio } from "@modyra/studio-ui";
import "@modyra/studio-ui/studio.css";
import type { GenerateRequest, GenerateResponse } from "./codegen-worker.js";

const host = document.querySelector<HTMLElement>("[data-modyra-studio]");
if (!host) throw new Error("Missing [data-modyra-studio] mount point");

/** P11 Workers: generate/syntax-check/format run in codegen-worker.js, never on this thread. One request in flight at a time is all runExport() ever issues — a plain incrementing id plus a pending-map is enough, no queue needed. */
const worker = new Worker(new URL("./codegen-worker.js", import.meta.url), { type: "module" });
let nextRequestId = 0;
const pending = new Map<number, { resolve: (value: GenerateResponse) => void }>();
worker.onmessage = (event: MessageEvent<GenerateResponse>) => {
  const entry = pending.get(event.data.id);
  if (!entry) return;
  pending.delete(event.data.id);
  entry.resolve(event.data);
};

mountStudio(host, undefined, {
  generateOffMainThread: (job) =>
    new Promise((resolve, reject) => {
      const id = nextRequestId++;
      pending.set(id, {
        resolve: (response) => (response.ok ? resolve(response.artifact) : reject(new Error(response.error))),
      });
      const request: GenerateRequest = { id, job };
      worker.postMessage(request);
    }),
});
