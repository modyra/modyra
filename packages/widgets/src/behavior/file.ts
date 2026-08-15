/** Which candidates a file field takes, how many, and what it refuses. */
export interface MdyFileCandidate {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export interface MdyFileSelectionOptions {
  readonly accept?: string;
  readonly multiple: boolean;
  readonly maxFileSize?: number;
  readonly maxFiles?: number;
}

export interface MdyFileSelectionTransition<TFile extends MdyFileCandidate> {
  /** What the field holds: always a list, as `MDY_VALUE_CONTRACTS.file` declares. */
  readonly value: readonly TFile[] | null | undefined;
  readonly accepted: readonly TFile[];
  readonly rejected: readonly TFile[];
  readonly touched: boolean;
}

/** Shared picker/drop policy. `undefined` means no accepted candidate and preserves the committed value. */
export function fileSelectionTransition<TFile extends MdyFileCandidate>(
  candidates: readonly TFile[],
  options: MdyFileSelectionOptions,
): MdyFileSelectionTransition<TFile> {
  if (candidates.length === 0) {
    return { value: undefined, accepted: [], rejected: [], touched: false };
  }
  const tokens = (options.accept ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const matchesAccept = (file: TFile): boolean => tokens.length === 0 || tokens.some((token) => {
    if (token.startsWith(".")) return file.name.toLowerCase().endsWith(token);
    // The token that means *any file* is a bare star, and a star over a star. Both took the wildcard
    // branch below and asked whether a file's type began with a star — which nothing does, so the
    // most permissive value a form can declare was the only one that accepted nothing.
    if (token === "*" || token === "*/*") return true;
    if (token.endsWith("/*")) return file.type.toLowerCase().startsWith(token.slice(0, -1));
    return file.type.toLowerCase() === token;
  });
  const maxSize = options.maxFileSize ?? 0;
  let accepted = candidates.filter((file) => matchesAccept(file) && (maxSize <= 0 || file.size <= maxSize));
  const rejected = candidates.filter((file) => !accepted.includes(file));
  const maxFiles = options.maxFiles ?? 0;
  if (options.multiple && maxFiles > 0 && accepted.length > maxFiles) {
    rejected.push(...accepted.slice(maxFiles));
    accepted = accepted.slice(0, maxFiles);
  }
  if (!options.multiple && accepted.length > 1) {
    rejected.push(...accepted.slice(1));
    accepted = accepted.slice(0, 1);
  }
  return {
    // Always a list, whatever `multiple` says. `MDY_VALUE_CONTRACTS.file` declares `file[]` and is
    // not nullable, so a bare file is a shape the engine's own `matchesValueShape` refuses — and a
    // single-file field was invalid for every file a person could choose, in any renderer that did
    // not wrap the value on its way past. Whether one file or several may be chosen is what
    // `accepted` was already narrowed by; it is not a second answer about what the field holds.
    value: accepted.length === 0 ? undefined : accepted,
    accepted,
    rejected,
    touched: accepted.length > 0,
  };
}

export function clearFileSelection<TFile extends MdyFileCandidate>(): MdyFileSelectionTransition<TFile> {
  return { value: null, accepted: [], rejected: [], touched: false };
}
