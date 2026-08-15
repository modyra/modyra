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
 *   - **undo/redo** unless asked for. Pass `history: true` and the model keeps its own stack of
 *     value snapshots. An entry exists because something changed: a write that lands the value a
 *     cell already held, a removal of a key that is not there and a rename onto itself record
 *     nothing. Undo and redo restore the value and which rows exist — touched, dirty and bindings
 *     are not in a snapshot, which is what "only the value is recorded" means.
 *   - **validation**, beyond which cells are required, because a verdict is the validator's word.
 *   - **mounting**, except to record it: what is mounted is exactly what must not matter.
 */

/**
 * @param spec.cells      The row template, as `{ cellName: initialValue }`.
 * @param spec.initial    Rows the collection starts with.
 */
export function createReferenceModel({ cells, initial = {}, history = false } = {}) {
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
  /**
   * Paths a binder has stated are *editable*.
   *
   * The other half of a binding, and the half a model that tracks only refusals loses: a row that
   * carries a permission onto a key where a refusal waits leaves the cell editable, and a model
   * without this reports the refusal instead. Measured; ADR 0044 says what releases a binding and
   * not which of two competing ones wins.
   */
  const enabled = new Set();
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
    // Both halves of a binding end with the row, unless a control still claims the path. Dropping
    // only the refusals leaves a permission behind for a row that is gone, and the next rename
    // carries it onto a row that never had it.
    for (const set of [disabled, enabled]) {
      for (const path of [...set]) {
        if (path.startsWith(`${key}.`) && !isMounted(path)) set.delete(path);
      }
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

  /** Snapshots of what a snapshot holds: which rows there are, in order, and what is in them. */
  const past = [];
  const future = [];
  const takeSnapshot = () => ({ order: [...order], rows: new Map([...rows].map(([key, row]) => [key, { ...row }])) });
  const putSnapshot = (snapshot) => {
    // A row the restored past does not contain has ended, and what belonged to it ends with it:
    // marks, edits and — unless a control still claims the path — what a binder said about a cell.
    // That is the same rule a removal follows, and it is why a row brought back by a redo comes
    // back untouched rather than as the consumer last left it.
    for (const key of [...order]) if (!snapshot.rows.has(key)) forget(key);

    // A key that arrives is declared last — the rule the collection follows everywhere, including a
    // rename, which ends one key and declares another. A row brought back by an undo arrives, so it
    // arrives at the end rather than at the position it held. Measured, not promised: nothing states
    // what an undo does to declaration order.
    const kept = order.filter((key) => snapshot.rows.has(key));
    order = [...kept, ...snapshot.order.filter((key) => !kept.includes(key))];
    rows.clear();
    for (const key of order) rows.set(key, { ...snapshot.rows.get(key) });
  };

  const model = {
    cellNames,

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

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

    /**
     * Apply one operation, recording a history entry when it changed the value.
     *
     * Undo and redo are not operations on the collection: they move between snapshots of it, so
     * they never record one of their own.
     */
    apply(operation) {
      if (history && (operation.type === "undo" || operation.type === "redo")) {
        const from = operation.type === "undo" ? past : future;
        const to = operation.type === "undo" ? future : past;
        if (from.length > 0) {
          to.push(takeSnapshot());
          putSnapshot(from.pop());
        }
        return model;
      }

      if (!history) return model.applyOperation(operation);

      const before = takeSnapshot();
      const valueBefore = JSON.stringify(model.value());
      model.applyOperation(operation);
      if (JSON.stringify(model.value()) !== valueBefore) {
        past.push(before);
        // A step taken after an undo is the branch the redo stack no longer describes.
        future.length = 0;
      }
      return model;
    },

    /** The operation itself, with no history bookkeeping. */
    applyOperation(operation) {
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
          // A binding is a statement either way: a permission travels exactly as a refusal does, and
          // what the row carries replaces whatever was waiting at the key it lands on.
          const carriedRefusals = [...disabled].filter((path) => path.startsWith(`${from}.`));
          const carriedPermissions = [...enabled].filter((path) => path.startsWith(`${from}.`));
          forget(from);
          declare(to, value);
          for (const path of carriedMarks) touched.add(path.replace(`${from}.`, `${to}.`));
          for (const path of carriedEdits) dirty.add(path.replace(`${from}.`, `${to}.`));
          for (const [carried, set] of [[carriedRefusals, disabled], [carriedPermissions, enabled]]) {
            for (const path of carried) {
              const moved = path.replace(`${from}.`, `${to}.`);
              disabled.delete(path);
              enabled.delete(path);
              disabled.delete(moved);
              enabled.delete(moved);
              set.add(moved);
            }
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
          enabled.delete(local(operation.path));
          break;
        case "field.enable":
          disabled.delete(local(operation.path));
          enabled.add(local(operation.path));
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
