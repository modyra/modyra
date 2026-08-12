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
  readonly value: TFile | readonly TFile[] | null | undefined;
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
    value: accepted.length === 0 ? undefined : options.multiple ? accepted : accepted[0]!,
    accepted,
    rejected,
    touched: accepted.length > 0,
  };
}

export function clearFileSelection<TFile extends MdyFileCandidate>(): MdyFileSelectionTransition<TFile> {
  return { value: null, accepted: [], rejected: [], touched: false };
}
