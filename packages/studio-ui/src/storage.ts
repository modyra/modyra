/**
 * Plan section 11 storage: "IndexedDB: projects + recovery; localStorage:
 * UI preferences only; JSON import/export; last session restore." Pure
 * async functions, no DOM/mountStudio state — reuses studio-model's own
 * loadProject() (already the full "read version -> migrate -> normalize
 * -> validate -> project+diagnostics" pipeline, R nothing new invented
 * here) for both JSON import and IndexedDB recovery, so a corrupt or
 * stale snapshot degrades the same way a bad import file would: reported,
 * never silently accepted or crashed on.
 */
import { loadProject, StudioModelError, type MdyStudioProject, type StudioDiagnostic } from "@modyra/studio-model";

const DB_NAME = "modyra-studio";
const DB_VERSION = 1;
const STORE_NAME = "sessions";
/** Single-slot "current session" key — plan's own scope is "last session restore", not a project browser. */
const SESSION_KEY = "last";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

/** Auto-save: fire-and-forget from the caller, errors are the caller's to decide whether to surface. */
export async function saveSession(project: MdyStudioProject): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(project, SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to save session"));
    });
  } finally {
    db.close();
  }
}

export interface LoadSessionResult {
  project: MdyStudioProject;
  diagnostics: StudioDiagnostic[];
}

/**
 * Loads the last auto-saved session. Returns `null` when there is none, or
 * when the stored snapshot is corrupt/structurally invalid — recovery, per
 * the plan gate, means falling back cleanly (the caller starts blank
 * instead), never throwing and never rendering a broken project.
 */
export async function loadSession(): Promise<LoadSessionResult | null> {
  const db = await openDb();
  let raw: unknown;
  try {
    raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(SESSION_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to read session"));
    });
  } finally {
    db.close();
  }
  if (raw === undefined) return null;
  try {
    return loadProject(raw);
  } catch (error) {
    if (error instanceof StudioModelError) return null; // corrupt snapshot -> recover to blank, not a crash
    throw error;
  }
}

export interface ImportResult {
  project: MdyStudioProject | null;
  diagnostics: StudioDiagnostic[];
  error: string | null;
}

/** Parses+validates an imported project JSON file's text. Never throws — the caller always gets a result to render a status from. */
export function importProjectFromText(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { project: null, diagnostics: [], error: "Not valid JSON" };
  }
  try {
    const { project, diagnostics } = loadProject(raw);
    return { project, diagnostics, error: null };
  } catch (error) {
    return { project: null, diagnostics: [], error: error instanceof StudioModelError ? error.message : String(error) };
  }
}
