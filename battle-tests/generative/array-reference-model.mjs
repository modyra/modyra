/**
 * What a positional collection means, written a second time and much more simply.
 *
 * The keyed model beside this one tracks identity by key. An array's identity is its position, and
 * that is the whole difference: `insert`, `remove` and `move` renumber the rows below them, so a
 * path names a different row after the call than before it. Written as a plain JavaScript array with
 * no engine, no gate and no path registry, this cannot share a mistake with the implementation it
 * checks.
 *
 * The semantics are the contract's, taken from what the public API and its tests state:
 *
 *   - a structural change rebuilds the rows it moves, and **rebuilds them clean** — touched and
 *     dirty do not travel with a row across `insert`, `remove`, `move` or `setAll`;
 *   - a whole-value write states which rows there are; a partial write prunes nothing;
 *   - a write to an index that does not exist is a write to nothing.
 *
 * Not modelled: validation verdicts, history and async, which the campaigns that need them drive
 * themselves.
 */

export function createArrayReferenceModel({ cells, initial = [] } = {}) {
  const cellNames = Object.keys(cells);
  const template = () => ({ ...cells });

  /** @type {Array<Record<string, unknown>>} */
  let rows = [];
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

  /** A row's contents from a partial value: what is given wins, what is not takes the template's. */
  const rowFrom = (partial, base = template()) => {
    const built = { ...base };
    for (const name of cellNames) {
      if (partial !== undefined && partial !== null && name in partial) built[name] = partial[name];
    }
    return built;
  };

  /**
   * What a structural change does to the state a user's interaction produced.
   *
   * Touched and dirty do not travel with a row: what the change *moves*, it rebuilds clean — and
   * only that. Appending a row moves nothing above it, and an index the list does not have is not a
   * removal at all.
   *
   * A binding is a different thing and stays where it was put. In a positional collection a path
   * *is* a position — `items.0.note` is "the note cell of the first row" — so a control bound to it
   * is bound to the first row, whichever row that now is. Removing a row therefore slides the
   * binding onto the row that took its place, which is what a consumer holding a control at that
   * position means by it.
   */
  const rebuildClean = (movedFrom = 0) => {
    for (const path of [...touched]) {
      if (Number(path.split(".")[0]) >= movedFrom) touched.delete(path);
    }
  };

  /**
   * A row ending takes with it what a binder said about its cells.
   *
   * A binding made for a position that never had a row is *not* dropped: it waits, and applies to
   * the row that arrives there, exactly as a binding made before a keyed row is declared does.
   */
  const dropBindingsBeyond = (length, previousLength) => {
    for (const path of [...disabled]) {
      const index = Number(path.split(".")[0]);
      // A control still bound to the path is the binder still saying it, so the binding waits for
      // the next row to arrive there — the same rule a keyed collection follows.
      if (index >= length && index < previousLength && !isMounted(path)) disabled.delete(path);
    }
  };

  /**
   * Carries the bindings with the rows a structural change rearranged.
   *
   * `order[newIndex]` is the index that row had before. A binding is the consumer's word about a
   * row — *this cell is not for editing* — so it travels with the row rather than staying at the
   * index, where it would suppress a cell of whoever arrived.
   */
  const carryBindings = (order) => {
    const carried = [];
    for (const [newIndex, oldIndex] of order.entries()) {
      if (oldIndex === null || oldIndex === newIndex) continue;
      for (const path of disabled) {
        const [index, ...rest] = path.split(".");
        if (Number(index) === oldIndex) carried.push([path, [newIndex, ...rest].join(".")]);
      }
    }
    for (const [from] of carried) disabled.delete(from);
    for (const [, to] of carried) disabled.add(to);
  };

  /** `[0, 1, … length - 1]` — the order before a change rearranged it. */
  const identityOrder = (length) => Array.from({ length }, (_, index) => index);

  const indexOf = (path) => {
    const [, index] = path.split(".");
    return Number(index);
  };
  const cellOf = (path) => path.split(".").slice(2).join(".");
  const localOf = (path) => path.split(".").slice(1).join(".");

  const model = {
    cellNames,

    length: () => rows.length,
    value: () => rows.map((row) => ({ ...row })),

    /**
     * What a submit would carry: every cell except the disabled ones.
     *
     * A row whose every cell is disabled contributes nothing and is absent rather than present and
     * empty — the same shape a keyed collection produces, and the same sharp edge: a server that
     * reads an absent row as a deletion sees a fully disabled one as one.
     */
    submitted() {
      const out = [];
      for (const [index, row] of rows.entries()) {
        const kept = {};
        for (const name of cellNames) {
          if (!disabled.has(`${index}.${name}`)) kept[name] = row[name];
        }
        if (Object.keys(kept).length > 0) out.push(kept);
      }
      return out;
    },

    mountedPaths: () => [...mounted.keys()].sort(),
    touchedPaths: () => [...touched].sort(),
    /**
     * The cells a binding is actually suppressing.
     *
     * A binding stated for a position with no row waits there; until a row arrives, there is no cell
     * to be disabled and nothing a consumer can read.
     */
    disabledPaths: () => [...disabled].filter((path) => Number(path.split(".")[0]) < rows.length).sort(),

    apply(operation) {
      switch (operation.type) {
        case "array.push":
          rows.push(rowFrom(operation.value));
          break;
        case "array.insert": {
          const at = Math.max(0, Math.min(rows.length, operation.index));
          const order = identityOrder(rows.length);
          order.splice(at, 0, null);
          rows.splice(at, 0, rowFrom(operation.value));
          carryBindings(order);
          rebuildClean(at);
          break;
        }
        case "array.remove": {
          if (operation.index < 0 || operation.index >= rows.length) break;
          const before = rows.length;
          const order = identityOrder(rows.length);
          order.splice(operation.index, 1);
          // The row that ended releases its bindings; the rows above it carry theirs down.
          for (const path of [...disabled]) {
            if (Number(path.split(".")[0]) === operation.index) disabled.delete(path);
          }
          rows.splice(operation.index, 1);
          carryBindings(order);
          rebuildClean(operation.index);
          dropBindingsBeyond(rows.length, before);
          break;
        }
        case "array.move": {
          const { from, to } = operation;
          if (from < 0 || from >= rows.length) break;
          const order = identityOrder(rows.length);
          const [moved] = rows.splice(from, 1);
          const at = Math.max(0, Math.min(rows.length, to));
          rows.splice(at, 0, moved);
          const [movedIndex] = order.splice(from, 1);
          order.splice(at, 0, movedIndex);
          carryBindings(order);
          rebuildClean(Math.min(from, at));
          break;
        }
        case "array.setAll": {
          // A whole-value write states which rows there are.
          const before = rows.length;
          rows = (operation.value ?? []).map((each) => rowFrom(each));
          rebuildClean();
          dropBindingsBeyond(rows.length, before);
          break;
        }

        case "field.set": {
          const index = indexOf(operation.path);
          const cell = cellOf(operation.path);
          // A write to a row that does not exist is a write to nothing.
          if (!Number.isInteger(index) || index < 0 || index >= rows.length) break;
          if (!cellNames.includes(cell)) break;
          rows[index] = { ...rows[index], [cell]: operation.value };
          break;
        }
        case "field.touch": {
          const index = indexOf(operation.path);
          if (index >= 0 && index < rows.length) touched.add(localOf(operation.path));
          break;
        }
        case "field.disable":
          disabled.add(localOf(operation.path));
          break;
        case "field.enable":
          disabled.delete(localOf(operation.path));
          break;
        case "mount":
          for (const path of operation.paths) {
            const local = localOf(path);
            mounted.set(local, (mounted.get(local) ?? 0) + 1);
          }
          break;
        case "unmount":
          for (const path of operation.paths) {
            const local = localOf(path);
            const remaining = (mounted.get(local) ?? 0) - 1;
            if (remaining > 0) mounted.set(local, remaining);
            else mounted.delete(local);
          }
          break;
        case "reset": {
          const before = rows.length;
          rows = initial.map((each) => rowFrom(each));
          rebuildClean();
          dropBindingsBeyond(rows.length, before);
          break;
        }
        default:
          break;
      }
      return model;
    },
  };

  rows = initial.map((each) => rowFrom(each));
  return model;
}
