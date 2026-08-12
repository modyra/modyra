/**
 * Builds a real, running @modyra/core form from a flat Dynamic Form
 * Contract field list — the same logic packages/react/src/dynamic/
 * dynamic-form.ts's buildDynamicFormSchema/applyDynamicValidators use,
 * reimplemented here rather than imported: that file's module also pulls
 * in "react" at the top, which would force a real React dependency onto
 * this zero-dependency package for no functional reason (the logic itself
 * is plain @modyra/core, nothing React-specific).
 */
import {
  array,
  group,
  record,
  assertSafeDynamicFieldNames,
  buildDynamicFieldValidators,
  createForm,
  field,
  mdyEmptyValueFor,
  type MdyDynamicCollection,
  type MdyDynamicField,
  type MdyFormSchema,
  type MdyReactivity,
  type MdyTypedForm,
} from "@modyra/core";

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
export function buildFormSchema(
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

/** Applies each field's Contract validators onto an already-built form, keyed so re-applying replaces rather than accumulates. */
export function applyFieldValidators(form: MdyTypedForm<MdyFormSchema>, fields: ReadonlyArray<MdyDynamicField>): void {
  for (const f of fields) {
    const { validators, marksRequired } = buildDynamicFieldValidators(f);
    form.upsertValidators(f.name, "mdy-plain", validators, marksRequired);
  }
}

/** Builds and activates a real form from a flat field list, sharing one reactivity graph with every field's widget controller. Caller owns disposal via `form.deactivate()`. */
export function buildForm(
  fields: ReadonlyArray<MdyDynamicField>,
  reactivity: MdyReactivity,
  collections: ReadonlyArray<MdyDynamicCollection> = [],
): MdyTypedForm<MdyFormSchema> {
  const form = createForm(buildFormSchema(fields, collections), { reactivity, autoActivate: false });
  applyFieldValidators(form, fields);
  form.activate();
  return form;
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
