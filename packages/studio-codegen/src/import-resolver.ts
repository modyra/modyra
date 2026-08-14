import { isValidBindingName, printString } from "./ts-print.js";

/**
 * The import block a generated module opens with.
 *
 * It collects what the mapper needs and prints it once, deterministically. What it did not do was
 * ask whether the thing it was handed can be an import at all — it is a `Map<source, Set<name>>`,
 * and both halves reached the output as written:
 *
 * ```
 * import { field } from "a"; import { field } from "b";   two sources, one binding
 * import { with space } from "…";                          not an identifier
 * import { class } from "…";                               a reserved word
 * import { field } from "a"b";                             a quote in the source
 * ```
 *
 * Every one of those is a module that does not compile, emitted with nothing said.
 *
 * **Refused rather than repaired**, which is the opposite of what a stub name gets. A stub's name is
 * the target's to choose, so renaming one is a repair; an import's name belongs to the module it
 * comes from, and renaming it binds a different identifier than the one the mapper then calls —
 * trading a module that fails loudly for one that fails at the call site.
 *
 * **Reported rather than thrown**, which is how this package answers every other bad profile: the
 * caller collects `problems` into its diagnostics, and a host gets a finding it can show beside the
 * others rather than an exception out of `generate()`.
 */
export class ImportResolver {
  #bySource = new Map<string, Set<string>>();
  /** Which source each name was claimed by, so a second claim on it is refused rather than printed. */
  #sourceOfName = new Map<string, string>();

  /** What could not be imported, for the caller to report. Empty when the block is usable. */
  readonly problems: string[] = [];

  add(source: string, ...names: string[]): void {
    if (typeof source !== "string" || source.length === 0) {
      this.problems.push("An import source must be a non-empty module specifier");
      return;
    }
    for (const name of names) {
      if (!isValidBindingName(name)) {
        this.problems.push(
          `"${name}" cannot be imported: an imported binding is a declaration, so it must be an ` +
          "identifier and not a reserved word",
        );
        continue;
      }
      const claimed = this.#sourceOfName.get(name);
      if (claimed !== undefined && claimed !== source) {
        this.problems.push(
          `"${name}" is imported from both "${claimed}" and "${source}", and one module can bind it once`,
        );
        continue;
      }
      this.#sourceOfName.set(name, source);
      // The source is recorded only once a name has been accepted for it: creating it first left
      // `import {  } from "b";` behind when every name it was asked for was refused.
      let set = this.#bySource.get(source);
      if (!set) {
        set = new Set();
        this.#bySource.set(source, set);
      }
      set.add(name);
    }
  }

  /** Deterministic `import { a, b } from "source";` lines — sources and names both sorted. */
  print(): string {
    return [...this.#bySource.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      // The source through `printString`, which is what every other string this package emits goes
      // through: a specifier carrying a quote closed the string early and left the rest as code.
      .map(([source, names]) => `import { ${[...names].sort().join(", ")} } from ${printString(source)};`)
      .join("\n");
  }
}
