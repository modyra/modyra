/**
 * A positional row holding two collections of different kinds, written simply.
 *
 * `batches → readings` and `batches → tags`: a list whose rows each hold *both* a list and a map.
 * The other models cover one child per row; this is the shape where a row carries two children that
 * disagree about what identity means — an index on one side, a key on the other — and where moving
 * the row has to carry both without either learning anything about the other.
 *
 * The model is an array of objects, each holding a plain array and a `Map`. The rule the shape adds
 * is one sentence: a child lives while its row does, and a change to the row carries both children
 * whole. Everything a single collection means is what the single-level models already say.
 */

export function createSiblingCollectionsReferenceModel({ rowCells, readingCells, tagCells } = {}) {
  const rowNames = Object.keys(rowCells);
  const readingNames = Object.keys(readingCells);
  const tagNames = Object.keys(tagCells);

  /** @type {Array<{ cells: Record<string, unknown>, readings: Array<Record<string, unknown>>, tags: Map<string, Record<string, unknown>> }>} */
  let rows = [];

  const cellsFrom = (names, template, partial) => {
    const built = { ...template };
    for (const name of names) {
      if (partial !== undefined && partial !== null && name in partial) built[name] = partial[name];
    }
    return built;
  };

  const readingFrom = (value) => cellsFrom(readingNames, readingCells, value);
  const tagFrom = (value) => cellsFrom(tagNames, tagCells, value);

  const rowFrom = (value) => ({
    cells: cellsFrom(rowNames, rowCells, value),
    readings: Array.isArray(value?.readings) ? value.readings.map(readingFrom) : [],
    tags: new Map(
      value?.tags && typeof value.tags === "object"
        ? Object.entries(value.tags).map(([key, tag]) => [key, tagFrom(tag)])
        : [],
    ),
  });

  /** `batches.2.readings` and `batches.2.tags` → the row they belong to, or undefined. */
  const rowAt = (path) => {
    const [, index] = String(path).split(".");
    return rows[Number(index)];
  };

  const model = {
    length: () => rows.length,
    readingCount: (index) => rows[index]?.readings.length ?? 0,
    tagKeys: (index) => [...(rows[index]?.tags.keys() ?? [])],

    value: () =>
      rows.map((row) => ({
        ...row.cells,
        readings: row.readings.map((reading) => ({ ...reading })),
        tags: Object.fromEntries([...row.tags.entries()].map(([key, tag]) => [key, { ...tag }])),
      })),

    apply(operation, { rootPath = "batches" } = {}) {
      // A write to a cell names a field rather than a collection, so it is routed by its own path
      // before anything asks which collection an operation is addressed to.
      if (operation.type === "field.set") {
        const [, index, second, third, fourth] = String(operation.path).split(".");
        const row = rows[Number(index)];
        if (!row) return model;
        if (second === "readings") {
          const reading = row.readings[Number(third)];
          if (reading && readingNames.includes(fourth)) reading[fourth] = operation.value;
          return model;
        }
        if (second === "tags") {
          const tag = row.tags.get(third);
          if (tag && tagNames.includes(fourth)) tag[fourth] = operation.value;
          return model;
        }
        if (rowNames.includes(second)) row.cells[second] = operation.value;
        return model;
      }

      // The row list itself.
      if (operation.path === rootPath) {
        switch (operation.type) {
          case "array.push":
            rows.push(rowFrom(operation.value));
            break;
          case "array.insert":
            rows.splice(Math.max(0, Math.min(rows.length, operation.index)), 0, rowFrom(operation.value));
            break;
          case "array.remove":
            if (operation.index >= 0 && operation.index < rows.length) rows.splice(operation.index, 1);
            break;
          case "array.move": {
            const { from, to } = operation;
            if (from < 0 || from >= rows.length) break;
            const [moved] = rows.splice(from, 1);
            rows.splice(Math.max(0, Math.min(rows.length, to)), 0, moved);
            break;
          }
          case "array.setAll":
            rows = (operation.value ?? []).map(rowFrom);
            break;
          default:
            break;
        }
        return model;
      }

      // One of the two children. A write addressed through a row that is not there reaches nothing.
      const row = rowAt(operation.path);
      if (!row) return model;
      const onReadings = String(operation.path).endsWith("readings");

      if (onReadings) {
        const list = row.readings;
        switch (operation.type) {
          case "array.push":
            list.push(readingFrom(operation.value));
            break;
          case "array.insert":
            list.splice(Math.max(0, Math.min(list.length, operation.index)), 0, readingFrom(operation.value));
            break;
          case "array.remove":
            if (operation.index >= 0 && operation.index < list.length) list.splice(operation.index, 1);
            break;
          case "array.move": {
            const { from, to } = operation;
            if (from < 0 || from >= list.length) break;
            const [moved] = list.splice(from, 1);
            list.splice(Math.max(0, Math.min(list.length, to)), 0, moved);
            break;
          }
          case "array.setAll":
            row.readings = (operation.value ?? []).map(readingFrom);
            break;
          default:
            break;
        }
        return model;
      }

      // The keyed sibling. Re-declaring a key replaces what it names, which is the record manager's
      // own rule and the one a merge would quietly contradict.
      switch (operation.type) {
        case "record.upsert":
          row.tags.set(operation.key, tagFrom(operation.value));
          break;
        case "record.remove":
          row.tags.delete(operation.key);
          break;
        // A rename onto a key that is taken is refused, not resolved: one key names one tag, and
        // the engine will not decide which of two tags that is. `rename-onto-occupied` pins it.
        case "record.rename": {
          const moving = row.tags.get(operation.from);
          if (!moving || row.tags.has(operation.to)) break;
          const next = new Map();
          for (const [key, tag] of row.tags) {
            if (key === operation.from) next.set(operation.to, moving);
            else next.set(key, tag);
          }
          row.tags = next;
          break;
        }
        case "record.patch":
          for (const [key, patch] of Object.entries(operation.value ?? {})) {
            const tag = row.tags.get(key);
            if (!tag) continue;
            for (const name of tagNames) {
              if (patch !== null && patch !== undefined && name in patch) tag[name] = patch[name];
            }
          }
          break;
        default:
          break;
      }
      return model;
    },
  };

  return model;
}
