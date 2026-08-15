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
import { collectSchemaPaths, numericKeysToArrays } from "./schema-utils.js";
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
  // A list of fields, or nothing this can read. Without the check a string reached `.length` and a
  // number was iterated, each producing a `TypeError` naming an internal — three different mistakes
  // answered by one sentence a consumer cannot tell from a defect in this library.
  if (!Array.isArray(fields)) {
    throw new Error(
      `[modyra] buildFlatFormSchema takes a list of fields, received ${
        fields === null ? "null" : `a ${typeof fields}`
      }.`,
    );
  }
  // Every name here becomes part of a schema, so the rules a name has to satisfy are checked where
  // it is read — not left to surface as a mismatched shape on the first read.
  assertSafeDynamicFieldNames(fields);
  if (collections.length === 0) {
    const flat: Record<string, unknown> = {};
    for (const f of fields) flat[f.name] = field(mdyEmptyValueFor(f) as never, []);
    return flat as MdyFormSchema;
  }

  const declared = [...collections];
  const isUnder = (name: string, prefix: string): boolean => name.startsWith(`${prefix}.`);

  /**
   * The item a collection's rows share, and the row keys the fields imply.
   *
   * A declared collection may live *inside* another's row (`orders.o1.lines` inside `orders`), and
   * its path carries the row key it was flattened under. Structurally every row shares one item, so
   * the first row that declares a child describes it — the same convention the fields follow — and
   * the child's subtree becomes a real collection descriptor rather than a group of dotted keys.
   * Values are not read here: each row's own leaves arrive through the parent's initial, one row at
   * a time, exactly as they were flattened.
   */
  const rowOf = (prefix: string): { item: unknown; rows: Set<string> } => {
    const inside = declared.filter((c) => isUnder(c.path, prefix));
    const direct = inside.filter((c) => !inside.some((o) => o.path !== c.path && isUnder(c.path, o.path)));
    // Sub-path within a row → the first row that declares it.
    const children = new Map<string, { kind: "array" | "record"; path: string }>();
    for (const c of direct) {
      const [key, ...sub] = c.path.slice(prefix.length + 1).split(".");
      const within = sub.join(".");
      if (key !== undefined && within.length > 0 && !children.has(within)) {
        children.set(within, { kind: c.kind, path: c.path });
      }
    }
    const claimedByChild = (within: string): boolean =>
      [...children.keys()].some((s) => within === s || within.startsWith(`${s}.`));

    const rows = new Set<string>();
    const item: Record<string, unknown> = {};
    let leaf: unknown = null;
    for (const f of fields) {
      if (!isUnder(f.name, prefix)) continue;
      const rest = f.name.slice(prefix.length + 1);
      const [key, ...tail] = rest.split(".");
      rows.add(key!);
      // Every row has the same shape, so the first one describes the item and the rest confirm it.
      const within = tail.join(".");
      if (within.length === 0) { leaf = field(mdyEmptyValueFor(f) as never, []); continue; }
      if (claimedByChild(within)) continue;
      if (!(within in item)) item[within] = field(mdyEmptyValueFor(f) as never, []);
    }
    // A row may exist only because a child collection was declared under it.
    for (const c of direct) rows.add(c.path.slice(prefix.length + 1).split(".")[0]!);
    if (leaf !== null) return { item: leaf, rows };
    for (const [within, child] of children) {
      const { item: childItem } = rowOf(child.path);
      item[within] = child.kind === "array" ? array(childItem as never) : record(childItem as never);
    }
    return { item: group(nest(item)), rows };
  };

  // Only a collection not inside another one anchors a schema key; nested ones live in their
  // parent's item, where the row that owns them declares them.
  const roots = declared.filter((c) => !declared.some((o) => o.path !== c.path && isUnder(c.path, o.path)));

  const schema: Record<string, unknown> = {};
  const claimed = new Set<string>();
  for (const { path, kind } of roots) {
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
    // A row's own value is flat, so a collection inside it arrives keyed `"0"`, `"1"` — which is
    // what a record holds and not what an array does. The descriptor says which is which at every
    // depth, so the seed is shaped against it rather than against the digits it happens to carry:
    // without this a nested array is seeded with a shape it rejects and starts out with no rows,
    // and every field below it has nowhere to mount.
    const descriptor = kind === "array"
      ? array(item as never)
      : record(item as never);
    const { arrayPaths, recordPaths } = collectSchemaPaths({ [path]: descriptor } as MdyFormSchema);
    const rowValues = Object.fromEntries(seeded.map((key) => [key, seedOf(key)]));
    const initial = numericKeysToArrays({ [path]: rowValues }, arrayPaths, recordPaths)[path];
    schema[path] = kind === "array"
      ? array(item as never, { initial: initial as ReadonlyArray<unknown> })
      : record(item as never, { initial: initial as Readonly<Record<string, unknown>> });
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
