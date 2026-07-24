/**
 * Lazy target registry (plan section 10 "lazy registry"). Holds manifests
 * only; a target's actual code is imported/instantiated on the first
 * load(id) call and cached after that — adding a new target is exactly
 * "register one more manifest", never a studio-model/studio-editor/
 * studio-ui change (P7 gate: "dummy target needs no canvas change").
 */
import type { StudioTarget, TargetManifest } from "./types.js";

export class TargetRegistry {
  #manifests = new Map<string, TargetManifest>();
  #loaded = new Map<string, StudioTarget>();

  register(manifest: TargetManifest): void {
    if (this.#manifests.has(manifest.id)) {
      throw new Error(`Target "${manifest.id}" is already registered`);
    }
    this.#manifests.set(manifest.id, manifest);
  }

  list(): { id: string; displayName: string }[] {
    return [...this.#manifests.values()].map((m) => ({ id: m.id, displayName: m.displayName }));
  }

  has(id: string): boolean {
    return this.#manifests.has(id);
  }

  /** Lazily loads (and caches) the target's real implementation. Throws for an unregistered id. */
  async load(id: string): Promise<StudioTarget> {
    const cached = this.#loaded.get(id);
    if (cached) return cached;
    const manifest = this.#manifests.get(id);
    if (!manifest) throw new Error(`Target "${id}" is not registered`);
    const target = await manifest.load();
    this.#loaded.set(id, target);
    return target;
  }
}
