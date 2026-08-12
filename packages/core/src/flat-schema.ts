/**
 * Building a form from a **flat** field list, which is what a document over a wire produces.
 *
 * `buildDynamicFormSchema` in the parser next door takes a *nested* node and is a different function
 * with the same job. That name meant two things across this workspace and the flat one existed three
 * times — twice under two names, once inlined — so it is named for what it takes.
 *
 * A name here is a path, and the engine turns a dotted key into the structure it describes (ADR 0031).
 * What a path cannot say is which **kind** of collection it passed through: `lines.0` reads as the key
 * `"0"` whether the document declared an array or a record keyed by digits. So the collections are
 * passed in rather than guessed — `parseDynamicForm` reports them — and a document's array reads back
 * as a list instead of an object keyed "0", "1".
 */
import {
  array,
  field,
  group,
  record,
  type MdyFormSchema,
} from "./typed-form.js";
import type { MdyFormRegistry } from "./contracts/form-registry.js";
import {
  assertSafeDynamicFieldNames,
  buildDynamicFieldValidators,
  mdyEmptyValueFor,
  type MdyDynamicCollection,
  type MdyDynamicField,
} from "./dynamic-config.js";

/**
 * Builds the (validator-free) schema for a flat field list — every field gets its default value;
 * validators come from {@link applyFieldValidators}.
 *
 * A name here is a path, and the engine turns a dotted key into the structure it describes
 * (ADR 0031). What a path cannot say is which **kind** of collection it passed through: `lines.0`
 * reads as the key `"0"` whether the document declared an array or a record keyed by digits. So the
 * collections are passed in rather than guessed — `parseDynamicForm` reports them — and a document's
 * array reads back as a list instead of an object keyed "0", "1".
 */
export function buildFlatFormSchema(
  fields: ReadonlyArray<MdyDynamicField>,
  collections: ReadonlyArray<MdyDynamicCollection> = [],
): MdyFormSchema {
  // Every name here becomes part of a schema, so the rules a name has to satisfy are checked where
  // it is read — not left to surface as a mismatched shape on the first read.
  assertSafeDynamicFieldNames(fields);
  if (collections.length === 0) {
    const flat: Record<string, unknown> = {};
    for (const f of fields) flat[f.name] = field(mdyEmptyValueFor(f) as never, []);
    return flat as MdyFormSchema;
  }

  // Deepest first, so a collection inside a collection is built before the one that holds it.
  const declared = [...collections].sort((a, b) => b.path.length - a.path.length);
  const rowOf = (prefix: string): { item: unknown; rows: Set<string> } => {
    const rows = new Set<string>();
    const item: Record<string, unknown> = {};
    for (const f of fields) {
      if (!f.name.startsWith(`${prefix}.`)) continue;
      const rest = f.name.slice(prefix.length + 1);
      const [key, ...tail] = rest.split(".");
      rows.add(key!);
      // Every row has the same shape, so the first one describes the item and the rest confirm it.
      const within = tail.join(".");
      if (within.length === 0) return { item: field(mdyEmptyValueFor(f) as never, []), rows };
      if (!(within in item)) item[within] = field(mdyEmptyValueFor(f) as never, []);
    }
    return { item: group(nest(item)), rows };
  };

  const schema: Record<string, unknown> = {};
  const claimed = new Set<string>();
  for (const { path, kind } of declared) {
    const { item, rows } = rowOf(path);
    for (const f of fields) if (f.name.startsWith(`${path}.`)) claimed.add(f.name);
    // Each row carries its own values: the flattened fields hold them one leaf at a time, and a row
    // seeded from the item descriptor alone would repeat the first row's data down the whole list.
    const seedOf = (key: string): unknown => {
      const prefix = `${path}.${key}`;
      const leaf = fields.find((f) => f.name === prefix);
      if (leaf) return mdyEmptyValueFor(leaf);
      const row: Record<string, unknown> = {};
      for (const f of fields) {
        if (!f.name.startsWith(`${prefix}.`)) continue;
        row[f.name.slice(prefix.length + 1)] = mdyEmptyValueFor(f);
      }
      return nestValue(row);
    };
    const seeded = [...rows];
    schema[path] = kind === "array"
      ? array(item as never, { initial: seeded.map(seedOf) })
      : record(item as never, { initial: Object.fromEntries(seeded.map((key) => [key, seedOf(key)])) });
  }
  for (const f of fields) {
    if (claimed.has(f.name)) continue;
    schema[f.name] = field(mdyEmptyValueFor(f) as never, []);
  }
  return schema as MdyFormSchema;
}

/** Turns the dotted keys of a row's fields into the nested shape they describe. */
function nest(flat: Record<string, unknown>): MdyFormSchema {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const segments = key.split(".");
    let level = out;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) { level[segment] = value; return; }
      const held = level[segment] as { kind?: string; children?: Record<string, unknown> } | undefined;
      if (held?.kind === "group") { level = held.children!; return; }
      const children: Record<string, unknown> = {};
      level[segment] = group(children as MdyFormSchema);
      level = children;
    });
  }
  return out as MdyFormSchema;
}

/**
 * Applies each field's Contract validators onto an already-built form.
 *
 * Keyed, so re-applying replaces rather than accumulates: a document edited twice must not leave the
 * first edition's rules behind. The key is the caller's because two consumers on one form must be
 * able to own their own rules — the default names this function rather than any one host.
 *
 * The parameter is the one method this uses, not a whole form. A host that registers validators is
 * not always a `MdyTypedForm` — one of the three callers passes a component that owns one — and a
 * signature that asks for more than it needs turns a working call into a cast.
 */
export function applyFlatValidators(
  form: Pick<MdyFormRegistry, "upsertValidators">,
  fields: ReadonlyArray<MdyDynamicField>,
  key = "mdy-flat",
): void {
  for (const f of fields) {
    const { validators, marksRequired } = buildDynamicFieldValidators(f);
    form.upsertValidators(f.name, key, validators, marksRequired);
  }
}


/** The nested value dotted keys describe — the value counterpart of {@link nest}. */
function nestValue(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const segments = key.split(".");
    let level = out;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) { level[segment] = value; return; }
      const held = level[segment];
      if (held && typeof held === "object" && !Array.isArray(held)) { level = held as Record<string, unknown>; return; }
      const next: Record<string, unknown> = {};
      level[segment] = next;
      level = next;
    });
  }
  return out;
}
