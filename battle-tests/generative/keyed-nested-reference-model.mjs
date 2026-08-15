/**
 * A keyed level above two positional ones, written simply.
 *
 * `orders → lines → allocations`: a map whose rows each hold a list, whose rows each hold a list.
 * This is the geometry the nesting limit opened up, and the campaign searched neither half of it —
 * the two-positional-level model stops one level short, and nothing put a keyed level above it.
 *
 * The model is a `Map` of plain objects. The rules the extra levels add are two sentences:
 *
 *   - a key names an order; renaming it moves the order and everything under it, and the order that
 *     was there under the new name is gone;
 *   - a line lives while its order does, and an allocation lives while its line does — a change at
 *     any level carries whole subtrees rather than paths.
 *
 * Everything else is what the single-level models already say. It is written to be *simpler* than
 * the engine rather than to mirror it: no signals, no identity beyond the key and the index, and no
 * knowledge of how the engine stores any of it.
 */

/** The three levels a path can address, as the names this fixture uses. */
const LINES = "lines";
const ALLOCATIONS = "allocations";

export function createKeyedNestedReferenceModel({ orderCells, lineCells, allocationCells } = {}) {
  const orderNames = Object.keys(orderCells);
  const lineNames = Object.keys(lineCells);
  const allocationNames = Object.keys(allocationCells);

  /** @type {Map<string, { cells: Record<string, unknown>, lines: Array<{ cells: Record<string, unknown>, allocations: Array<Record<string, unknown>> }> }>} */
  let orders = new Map();

  const cellsFrom = (names, template, partial) => {
    const built = { ...template };
    for (const name of names) {
      if (partial !== undefined && partial !== null && name in partial) built[name] = partial[name];
    }
    return built;
  };

  const allocationFrom = (value) => cellsFrom(allocationNames, allocationCells, value);

  const lineFrom = (value) => ({
    cells: cellsFrom(lineNames, lineCells, value),
    allocations: Array.isArray(value?.[ALLOCATIONS]) ? value[ALLOCATIONS].map(allocationFrom) : [],
  });

  const orderFrom = (value) => ({
    cells: cellsFrom(orderNames, orderCells, value),
    lines: Array.isArray(value?.[LINES]) ? value[LINES].map(lineFrom) : [],
  });

  /**
   * The list a path addresses, or undefined when something along the way is not there.
   *
   * `orders.a.lines` is an order's line list; `orders.a.lines.2.allocations` is a line's. A path
   * whose order or line is missing addresses nothing, which is the rule that keeps a write to a
   * removed subtree from creating one.
   */
  const listAt = (path) => {
    const [, key, second, index, third] = String(path).split(".");
    const order = orders.get(key);
    if (!order) return undefined;
    if (second === LINES && index === undefined) return order.lines;
    if (second !== LINES) return undefined;
    const line = order.lines[Number(index)];
    if (!line) return undefined;
    return third === ALLOCATIONS ? line.allocations : undefined;
  };

  /** Which builder a list takes, decided by the same path. */
  const builderAt = (path) => (String(path).endsWith(ALLOCATIONS) ? allocationFrom : lineFrom);

  const model = {
    keys: () => [...orders.keys()],
    lineCount: (key) => orders.get(key)?.lines.length ?? 0,
    allocationCount: (key, index) => orders.get(key)?.lines[index]?.allocations.length ?? 0,

    value: () =>
      Object.fromEntries(
        [...orders.entries()].map(([key, order]) => [
          key,
          {
            ...order.cells,
            [LINES]: order.lines.map((line) => ({
              ...line.cells,
              [ALLOCATIONS]: line.allocations.map((allocation) => ({ ...allocation })),
            })),
          },
        ]),
      ),

    apply(operation, { rootPath = "orders" } = {}) {
      // A write to a cell names a field rather than a collection, so it is routed by its own path
      // before anything asks which list an operation is addressed to.
      if (operation.type === "field.set") {
        const [, key, second, index, third, fourth] = String(operation.path).split(".");
        const order = orders.get(key);
        if (!order) return model;

        if (second === undefined) return model;
        if (second !== LINES) {
          if (orderNames.includes(second)) order.cells[second] = operation.value;
          return model;
        }

        const line = order.lines[Number(index)];
        if (!line) return model;
        if (third === ALLOCATIONS) {
          // `orders.a.lines.0.allocations.0.bin` — the allocation's index is segment five and the
          // cell it names is segment six. Reading the index as the cell drops every write at this
          // depth, silently: the model reports the value the row was declared with for the rest of
          // the run, and the campaign calls the engine wrong for having taken the write.
          const allocation = line.allocations[Number(fourth)];
          const cell = String(operation.path).split(".")[6];
          if (allocation && allocationNames.includes(cell)) allocation[cell] = operation.value;
          return model;
        }
        if (lineNames.includes(third)) line.cells[third] = operation.value;
        return model;
      }

      // The keyed level. A key is an identity, so these say which order rather than which position.
      if (operation.path === rootPath) {
        switch (operation.type) {
          // "Re-declaring replaces what is there" — the record manager's own words. An upsert on a
          // key that already names an order is not a patch: the order it describes is the order
          // there is afterwards, including the lines it does or does not carry.
          case "record.upsert":
            orders.set(operation.key, orderFrom(operation.value));
            break;
          case "record.remove":
            orders.delete(operation.key);
            break;
          // A rename onto a key that is taken is refused, not resolved: one key names one order, and
          // the engine will not decide which of two orders that is. `rename-onto-occupied` pins it.
          case "record.rename": {
            const moving = orders.get(operation.from);
            if (!moving || orders.has(operation.to)) break;
            const next = new Map();
            for (const [key, order] of orders) {
              if (key === operation.from) next.set(operation.to, moving);
              else next.set(key, order);
            }
            orders = next;
            break;
          }
          case "record.patch":
            for (const [key, patch] of Object.entries(operation.value ?? {})) {
              const order = orders.get(key);
              if (!order) continue;
              for (const name of orderNames) {
                if (patch !== null && patch !== undefined && name in patch) order.cells[name] = patch[name];
              }
            }
            break;
          default:
            break;
        }
        return model;
      }

      // A positional level, at whichever depth the path names.
      const list = listAt(operation.path);
      if (list === undefined) return model;
      const build = builderAt(operation.path);

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
          list.length = 0;
          for (const each of next) list.push(each);
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
