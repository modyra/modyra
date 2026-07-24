/**
 * Plan section 10 "Import resolver collects, deduplicates, sorts." Shared by
 * every target's writer so a target module only ever declares what it uses
 * — the P8 gate "no unused imports" depends on callers only ever `add()`ing
 * a name right where they emit code that references it.
 */
export class ImportResolver {
  #bySource = new Map<string, Set<string>>();

  add(source: string, ...names: string[]): void {
    let set = this.#bySource.get(source);
    if (!set) {
      set = new Set();
      this.#bySource.set(source, set);
    }
    for (const name of names) set.add(name);
  }

  /** Deterministic `import { a, b } from "source";` lines — sources and names both sorted. */
  print(): string {
    return [...this.#bySource.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([source, names]) => `import { ${[...names].sort().join(", ")} } from "${source}";`)
      .join("\n");
  }
}
