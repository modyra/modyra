/**
 * Two positional levels, written simply.
 *
 * `items → parts`: a list whose rows each hold a list. This is the shape that was refused until the
 * nesting limit came off, and the one where the reason for refusing it lived — a descendant's path
 * moves both when its own row moves and when the row above it does.
 *
 * The model is two nested JavaScript arrays. The rule the nesting adds is one sentence: a child row
 * lives while its parent row does, and a change at the outer level carries the whole child list with
 * its row. Everything else is what the single-level model already says.
 */

export function createNestedReferenceModel({ outerCells, innerCells } = {}) {
  const outerNames = Object.keys(outerCells);
  const innerNames = Object.keys(innerCells);

  /** @type {Array<{ cells: Record<string, unknown>, parts: Array<Record<string, unknown>> }>} */
  let rows = [];

  const cellsFrom = (names, template, partial) => {
    const built = { ...template };
    for (const name of names) {
      if (partial !== undefined && partial !== null && name in partial) built[name] = partial[name];
    }
    return built;
  };

  const outerFrom = (value) => ({
    cells: cellsFrom(outerNames, outerCells, value),
    parts: Array.isArray(value?.parts) ? value.parts.map((part) => cellsFrom(innerNames, innerCells, part)) : [],
  });

  /** `items.2.parts` → the row it belongs to, or undefined when that row is not there. */
  const innerOf = (path) => {
    const [, index, tail] = path.split(".");
    return tail === "parts" ? rows[Number(index)] : undefined;
  };

  const model = {
    length: () => rows.length,
    innerLength: (index) => rows[index]?.parts.length ?? 0,

    value: () => rows.map((row) => ({ ...row.cells, parts: row.parts.map((part) => ({ ...part })) })),

    apply(operation, { outerPath = "items" } = {}) {
      // A write to a cell names a field, not a collection, so it is routed by its own path before
      // anything asks which list the operation is addressed to.
      if (operation.type === "field.set") {
        const [, outerIndex, ...rest] = operation.path.split(".");
        const outer = rows[Number(outerIndex)];
        if (!outer) return model;
        if (rest[0] === "parts") {
          const part = outer.parts[Number(rest[1])];
          if (part && innerNames.includes(rest[2])) part[rest[2]] = operation.value;
          return model;
        }
        if (outerNames.includes(rest[0])) outer.cells[rest[0]] = operation.value;
        return model;
      }

      const onOuter = operation.path === outerPath;
      const row = onOuter ? null : innerOf(operation.path ?? "");
      // A write to a child list whose parent row is not there reaches nothing.
      if (!onOuter && row === undefined) return model;
      const list = onOuter ? rows : row.parts;
      const build = onOuter ? outerFrom : (value) => cellsFrom(innerNames, innerCells, value);

      switch (operation.type) {
        case "array.push":
          list.push(build(operation.value));
          break;
        case "array.insert":
          list.splice(Math.max(0, Math.min(list.length, operation.index)), 0, build(operation.value));
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
        case "array.setAll": {
          const next = (operation.value ?? []).map((each) => build(each));
          if (onOuter) rows = next;
          else row.parts = next;
          break;
        }
        default:
          break;
      }
      return model;
    },
  };

  return model;
}
