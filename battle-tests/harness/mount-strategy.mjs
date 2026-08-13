/**
 * How much of a form is on screen, as something a test can vary.
 *
 * A renderer decides what to mount, and that decision is supposed to be invisible to the data: the
 * same operations must produce the same value, validity and submission whether every cell is bound,
 * one column is, a moving window is, or nothing is. These strategies exist so the same operation log
 * can be run under each of them and the results compared.
 *
 * A strategy is not a mount list. It is a rule applied after every operation, because the interesting
 * strategies react to structure — mounting a cell before its row is declared, or keeping a control
 * bound after its row is gone.
 */

/** The strategy names, in the order a comparison should report them. */
export const MOUNT_STRATEGIES = Object.freeze([
  "none",
  "full",
  "one-column",
  "rotating",
  "early",
  "retained",
]);

/**
 * @param collectionPath  Which keyed collection the strategy mounts cells of.
 * @param cells           The leaf names inside a row.
 * @param anticipatedKeys Keys the renderer knows about before they are declared — what "early"
 *                        mounts, and what a real table does when it renders a placeholder row.
 */
export function createMountStrategy(name, { collectionPath, cells, anticipatedKeys = [] }) {
  if (!MOUNT_STRATEGIES.includes(name)) {
    throw new Error(`unknown mount strategy ${JSON.stringify(name)}`);
  }

  let step = 0;
  const everMounted = new Set();

  const pathsFor = (keys, chosenCells) =>
    keys.flatMap((key) => chosenCells.map((cell) => `${collectionPath}.${key}.${cell}`));

  const desired = (declaredKeys) => {
    switch (name) {
      case "none":
        return [];
      case "full":
        return pathsFor(declaredKeys, cells);
      case "one-column":
        return pathsFor(declaredKeys, [cells[0]]);
      case "rotating":
        // A moving window: which column is bound changes as the attack proceeds.
        return declaredKeys.map(
          (key, index) => `${collectionPath}.${key}.${cells[(step + index) % cells.length]}`,
        );
      case "early":
        // Controls for rows that may never arrive, bound before anything declares them.
        return pathsFor([...new Set([...declaredKeys, ...anticipatedKeys])], cells);
      case "retained": {
        // Nothing is ever released: a control outlives the row it was bound to.
        for (const path of pathsFor(declaredKeys, cells)) everMounted.add(path);
        return [...everMounted];
      }
      default:
        return [];
    }
  };

  return {
    name,

    /**
     * Bring the mount set in line with the strategy, through the interpreter so the mounts and
     * unmounts are logged like any other operation.
     */
    async reconcile(context) {
      step += 1;
      const declaredKeys = [...context.collections[collectionPath].keys()];
      const target = desired(declaredKeys);
      const current = context.mountedPaths();

      const toUnmount = current.filter((path) => !target.includes(path));
      const toMount = target.filter((path) => !current.includes(path));

      if (toUnmount.length > 0) await context.execute({ type: "unmount", paths: toUnmount });
      if (toMount.length > 0) await context.execute({ type: "mount", paths: toMount });
    },
  };
}

/**
 * Run one operation log under one strategy and hand back the final public state.
 *
 * The strategy reconciles after every operation, which is what a renderer does: structure changes,
 * the view follows. Reconciling before would let the test mount rows the log has not declared yet
 * and quietly turn every strategy into "early".
 */
export async function runUnderStrategy({ ctx, spec, operations, strategy, formOptions = {} }) {
  const context = ctx.open(spec, formOptions);
  for (const operation of operations) {
    await context.execute(operation);
    await strategy.reconcile(context);
  }
  return { context, observation: context.observe(`strategy:${strategy.name}`) };
}
