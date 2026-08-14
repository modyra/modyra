/**
 * What a keyed collection means, written a second time and much more simply.
 *
 * This is the independent half of a generated campaign: a plain map of keys to rows, with the
 * semantics taken from the public contract rather than from Modyra's architecture. There is no
 * engine, no reactivity, no gate, no path registry — a row is an entry in an array of keys and an
 * object of values, and that is the point. Two implementations that share a design share their
 * mistakes; this one cannot, because it has no design in common with the thing it checks.
 *
 * What it deliberately does not model:
 *
 *   - **undo/redo**, whose granularity is a property of when snapshots are taken rather than of what
 *     a collection means. A campaign that needs it drives it separately.
 *   - **validation**, beyond which cells are required, because a verdict is the validator's word.
 *   - **mounting**, except to record it: what is mounted is exactly what must not matter.
 */

/**
 * @param spec.cells      The row template, as `{ cellName: initialValue }`.
 * @param spec.initial    Rows the collection starts with.
 */
export function createReferenceModel({ cells, initial = {} } = {}) {
  const cellNames = Object.keys(cells);
  const template = () => ({ ...cells });

  /** Declaration order is data: it is the order `keys()` promises. */
  let order = [];
  const rows = new Map();
  /**
   * How many controls are bound to a path, not whether any is.
   *
   * `claimField` and `removeField` are balanced calls: two controls on one path is two claims, and
   * one of them leaving does not unbind the other. A set would say the path is free after the first
   * `removeField`, and everything that follows from being bound — a binding surviving the row it
   * was made on — would be judged against the wrong state.
   */
  const mounted = new Map();
  const isMounted = (path) => (mounted.get(path) ?? 0) > 0;
  const disabled = new Set();
  const touched = new Set();
  const dirty = new Set();

  const declare = (key, value) => {
    if (!rows.has(key)) order.push(key);
    rows.set(key, value);
  };

  /**
   * The row ends. What ends with it is what belonged to it — its value, and the state a user's
   * interaction put on its cells.
   *
   * What a control said about a cell does not: a control still mounted on the path is still bound,
   * and its binding applies to the row that arrives next under the same key. A binding whose control
   * has gone — nothing mounted there — goes with the row, because nobody is saying it any more.
   */
  const forget = (key) => {
    order = order.filter((each) => each !== key);
    rows.delete(key);
    for (const path of [...touched]) if (path.startsWith(`${key}.`)) touched.delete(path);
    for (const path of [...dirty]) if (path.startsWith(`${key}.`)) dirty.delete(path);
    for (const path of [...disabled]) {
      if (path.startsWith(`${key}.`) && !isMounted(path)) disabled.delete(path);
    }
  };

  /** A row's contents from a partial value: what is given wins, what is not takes the template's. */
  const rowFrom = (partial, base = template()) => {
    const built = { ...base };
    for (const name of cellNames) {
      if (partial !== undefined && partial !== null && name in partial) built[name] = partial[name];
    }
    return built;
  };

  const model = {
    cellNames,

    keys: () => [...order],
    has: (key) => rows.has(key),
    row: (key) => (rows.has(key) ? { ...rows.get(key) } : undefined),

    /** The whole value, keys in declaration order. */
    value() {
      const out = {};
      for (const key of order) out[key] = { ...rows.get(key) };
      return out;
    },

    /**
     * What a submit would carry: every cell except the disabled ones.
     *
     * A row whose every cell is disabled contributes nothing, and so is absent rather than present
     * and empty. That is the observed contract — the submitted value is built from the cells that
     * are sent, and a row with none has no cell to build from — and it is a sharp edge: a consumer
     * whose server treats an absent row as a deletion sees a fully disabled row as one. It is
     * modelled here rather than asserted against, because no public statement promises either shape.
     */
    submitted() {
      const out = {};
      for (const key of order) {
        const row = {};
        for (const name of cellNames) {
          if (!disabled.has(`${key}.${name}`)) row[name] = rows.get(key)[name];
        }
        if (Object.keys(row).length > 0) out[key] = row;
      }
      return out;
    },

    mountedPaths: () => [...mounted.keys()].sort(),
    touchedPaths: () => [...touched].sort(),
    dirtyPaths: () => [...dirty].sort(),
    /**
     * The cells a binding is actually suppressing.
     *
     * A binding may be stated for a row that does not exist — it waits, and applies when the row
     * arrives — but until then there is no cell to be disabled, and nothing a consumer can read.
     * What is compared is what a consumer sees.
     */
    disabledPaths: () => [...disabled].filter((path) => rows.has(path.split(".")[0])).sort(),

    /** Apply one operation. Unknown or inapplicable operations are no-ops, as the contract says. */
    apply(operation) {
      const local = (path) => path.split(".").slice(1).join("."); // "rows.a.code" → "a.code"
      const keyOf = (path) => path.split(".")[1];

      switch (operation.type) {
        case "record.upsert": {
          const { key, value } = operation;
          if (value === undefined) {
            // Declaring without stating contents: the template's row, or what the row already holds.
            declare(key, rows.has(key) ? { ...rows.get(key) } : template());
          } else {
            declare(key, rowFrom(value));
          }
          break;
        }
        case "record.remove":
          if (rows.has(operation.key)) forget(operation.key);
          break;
        case "record.rename": {
          const { from, to } = operation;
          // Refused on both sides: a rename onto an occupied key would replace a row nobody removed,
          // and one from a key that does not exist has nothing to move.
          if (!rows.has(from) || rows.has(to)) break;
          const value = { ...rows.get(from) };
          const carriedMarks = [...touched].filter((path) => path.startsWith(`${from}.`));
          const carriedEdits = [...dirty].filter((path) => path.startsWith(`${from}.`));
          // What a binder said about a cell is the row's, like its value and its marks: a rename
          // moves the row, so the exclusion moves with it rather than staying on a key nobody holds.
          const carriedBindings = [...disabled].filter((path) => path.startsWith(`${from}.`));
          forget(from);
          declare(to, value);
          for (const path of carriedMarks) touched.add(path.replace(`${from}.`, `${to}.`));
          for (const path of carriedEdits) dirty.add(path.replace(`${from}.`, `${to}.`));
          for (const path of carriedBindings) {
            disabled.delete(path);
            disabled.add(path.replace(`${from}.`, `${to}.`));
          }
          break;
        }
        case "record.patch":
          for (const [key, partial] of Object.entries(operation.value ?? {})) {
            declare(key, rowFrom(partial, rows.has(key) ? { ...rows.get(key) } : template()));
          }
          break;
        case "record.setAll": {
          const named = Object.keys(operation.value ?? {});
          for (const key of [...order]) if (!named.includes(key)) forget(key);
          for (const key of named) declare(key, rowFrom(operation.value[key]));
          break;
        }
        case "field.set": {
          const key = keyOf(operation.path);
          const cell = local(operation.path).split(".").slice(1).join(".");
          // A write to a row that does not exist is a write to nothing: existence is the owner's word.
          if (!rows.has(key) || !cellNames.includes(cell)) break;
          rows.set(key, { ...rows.get(key), [cell]: operation.value });
          break;
        }
        case "field.touch":
          if (rows.has(keyOf(operation.path))) touched.add(local(operation.path));
          break;
        // A mark like `touched`, made by a different gesture and carried the same way: what a
        // control said about a cell belongs to the row, so a rename moves it and a removal ends it.
        case "field.dirty":
          if (rows.has(keyOf(operation.path))) dirty.add(local(operation.path));
          break;
        case "field.disable":
          disabled.add(local(operation.path));
          break;
        case "field.enable":
          disabled.delete(local(operation.path));
          break;
        case "mount":
          for (const path of operation.paths) {
            const name = local(path);
            mounted.set(name, (mounted.get(name) ?? 0) + 1);
          }
          break;
        case "unmount":
          for (const path of operation.paths) {
            const name = local(path);
            const remaining = (mounted.get(name) ?? 0) - 1;
            if (remaining > 0) mounted.set(name, remaining);
            else mounted.delete(name);
          }
          break;
        case "reset":
          // The form's own state goes back to what the schema declared. What a renderer mounted is
          // not the form's to reset, and the rows end the way any removal ends them.
          for (const key of [...order]) forget(key);
          touched.clear();
          dirty.clear();
          for (const [key, value] of Object.entries(initial)) declare(key, rowFrom(value));
          break;
        default:
          break;
      }
      return model;
    },
  };

  for (const [key, value] of Object.entries(initial)) declare(key, rowFrom(value));
  return model;
}
