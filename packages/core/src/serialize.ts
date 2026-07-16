/**
 * mdyFormSerialize utility.
 *
 * Converts a form model value into a JSON-serializable object,
 * specifically mapping native File objects into descriptive strings
 * (e.g. "[File: resume.pdf (12345 bytes)]") to prevent empty {} in JSON.stringify.
 */
export function mdyFormSerialize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  // Handle single File
  if (value instanceof File) {
    return `[File: ${value.name} (${value.size} bytes)]`;
  }

  // Handle Array (recursive)
  if (Array.isArray(value)) {
    return value.map(v => mdyFormSerialize(v));
  }

  // Handle Object (recursive)
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = mdyFormSerialize(val);
  }

  return result;
}
