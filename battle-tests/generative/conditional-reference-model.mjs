/**
 * What a row with a conditional section means, written a second time and much more simply.
 *
 * A row here is a flat bag of cells and one rule: the cells behind the branch count when the
 * deciding cell holds the deciding value, and do not when it does not. There is no engine, no
 * condition composer, no inactive-path bookkeeping — the branch is an `if` over a plain object,
 * evaluated at read time, and that is the point.
 *
 * The one thing worth stating about the semantics, because it is the whole reason a branch is not
 * just a delete: a closed branch **keeps** what was typed into it, and reopening it brings the
 * values back. That is the shape the contract already gives `disabled` — a value taken out of the
 * payload is still a value the form holds — so the branch applies to a submit and not to the edit
 * state. The model holds every cell always and decides only what a *submit* can see, which is a
 * different design from anything the engine does and is what makes the comparison worth making.
 *
 * What it deliberately does not model, for the same reasons the keyed model gives: undo and redo,
 * validation beyond which cells exist, and mounting except to record it.
 */

/**
 * @param spec.cells   Cells outside the branch, as `{ name: initialValue }`.
 * @param spec.branch  `{ prefix, when: { field, equals }, cells }` — the section and its rule.
 */
export function createConditionalModel({ cells, branch } = {}) {
  const flatNames = Object.keys(cells);
  const branchNames = Object.keys(branch.cells);
  const template = () => ({ ...cells, ...branch.cells });

  /** Declaration order is data: it is the order `keys()` promises. */
  let order = [];
  const rows = new Map();
  const mounted = new Map();
  const touched = new Set();
  const disabled = new Set();

  const isMounted = (path) => (mounted.get(path) ?? 0) > 0;
  const keyOf = (path) => path.split(".")[1];
  const local = (path) => path.slice("rows.".length);

  /** Whether the row's branch applies, read from the row itself. */
  const open = (row) => row?.[branch.when.field] === branch.when.equals;

  const declare = (key, value) => {
    if (!rows.has(key)) order.push(key);
    rows.set(key, value);
  };

  const forget = (key) => {
    order = order.filter((each) => each !== key);
    rows.delete(key);
    for (const path of [...touched]) if (path.startsWith(`${key}.`)) touched.delete(path);
    for (const path of [...disabled]) {
      if (path.startsWith(`${key}.`) && !isMounted(path)) disabled.delete(path);
    }
  };

  /** A row from a partial value: what is given wins, what is not takes the template's. */
  const rowFrom = (value) => {
    const row = template();
    if (value && typeof value === "object") {
      for (const name of [...flatNames, ...branchNames]) {
        if (name in value) row[name] = value[name];
      }
      // The branch's cells may also arrive nested under the section's own name.
      const section = value[branch.prefix];
      if (section && typeof section === "object") {
        for (const name of branchNames) if (name in section) row[name] = section[name];
      }
    }
    return row;
  };

  /**
   * What a read of one row shows.
   *
   * The branch is applied to a submit and not to the edit state, which is the same shape the
   * contract already gives `disabled`: a value taken out of the payload is still a value the form
   * holds and the user can see. So `getValue` shows the branch whether it applies or not, and only
   * `submitValue` leaves it out — and reopening a branch cannot lose anything, because nothing was
   * ever removed.
   */
  const shownRow = (key, { forSubmit = false } = {}) => {
    const row = rows.get(key);
    const shown = {};
    for (const name of flatNames) {
      if (forSubmit && disabled.has(`${key}.${name}`)) continue;
      shown[name] = row[name];
    }
    if (forSubmit && !open(row)) return shown;
    const section = {};
    for (const name of branchNames) {
      if (forSubmit && disabled.has(`${key}.${branch.prefix}.${name}`)) continue;
      section[name] = row[name];
    }
    if (Object.keys(section).length > 0) shown[branch.prefix] = section;
    return shown;
  };

  const shown = (options) => {
    const out = {};
    for (const key of order) out[key] = shownRow(key, options);
    return out;
  };

  return {
    keys: () => [...order],
    value: () => shown(),
    submitted: () => shown({ forSubmit: true }),
    touchedPaths: () => [...touched].sort(),
    disabledPaths: () => [...disabled].sort(),

    apply(operation) {
      switch (operation.type) {
        case "record.upsert": {
          const { key, value } = operation;
          if (value === undefined) {
            // A row declared without a value is the row the template describes.
            if (!rows.has(key)) declare(key, template());
          } else {
            declare(key, rowFrom(value));
          }
          break;
        }
        case "record.remove":
          forget(operation.key);
          break;
        case "record.rename": {
          const { from, to } = operation;
          if (!rows.has(from) || rows.has(to)) break;
          const value = { ...rows.get(from) };
          // A rename moves the row, and what belongs to the row moves with it — the marks a user
          // made and the exclusions its consumer set alike. ADR 0044 decided that; before it, only
          // the value travelled and a renamed row silently submitted a cell that had been taken out.
          const marks = [...touched].filter((path) => path.startsWith(`${from}.`));
          const exclusions = [...disabled].filter((path) => path.startsWith(`${from}.`));
          forget(from);
          declare(to, value);
          for (const path of marks) touched.add(path.replace(`${from}.`, `${to}.`));
          for (const path of exclusions) disabled.add(path.replace(`${from}.`, `${to}.`));
          break;
        }
        case "field.set": {
          const key = keyOf(operation.path);
          const cell = local(operation.path).slice(`${key}.`.length);
          const name = cell.startsWith(`${branch.prefix}.`) ? cell.slice(branch.prefix.length + 1) : cell;
          if (!rows.has(key)) break;
          if (![...flatNames, ...branchNames].includes(name)) break;
          rows.set(key, { ...rows.get(key), [name]: operation.value });
          break;
        }
        case "field.touch":
          if (rows.has(keyOf(operation.path))) touched.add(local(operation.path));
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
            const held = (mounted.get(name) ?? 0) - 1;
            if (held > 0) mounted.set(name, held);
            else mounted.delete(name);
          }
          break;
        default:
          break;
      }
    },
  };
}
