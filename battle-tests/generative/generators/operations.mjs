/**
 * Sequences of operations worth running.
 *
 * Uniform noise mostly produces sequences that do nothing interesting: writes to rows that do not
 * exist, removals of keys nobody declared. What finds breaks is a sequence that keeps crossing the
 * boundaries — declare, mount, edit, remove while mounted, re-declare the same key, undo across the
 * lot — so the generator tracks enough state to aim at those transitions and weights them.
 *
 * The generator knows nothing about Modyra. It reads the state the reference model keeps, which is
 * why a generated sequence is meaningful without being derived from the implementation under attack.
 */

import { generatePartialRow, generateRowValue, generateTextValue } from "./field-values.mjs";
import { generateSafeKey } from "./safe-keys.mjs";

/**
 * @param model    The reference model, read for what is declared right now.
 * @param options  `collectionPath`, `cells`, and whether history/undo operations may be generated.
 */
export function generateOperation(rng, model, { collectionPath = "rows", cells, withHistory = false } = {}) {
  const declared = model.keys();
  const anyDeclared = declared.length > 0;

  const choices = [
    ["upsert-new", anyDeclared ? 4 : 10],
    ["upsert-existing", anyDeclared ? 3 : 0],
    ["upsert-valueless", 2],
    ["patch", anyDeclared ? 3 : 1],
    ["set-all", 1],
    ["remove-declared", anyDeclared ? 4 : 0],
    ["remove-absent", 1],
    ["rename-free", anyDeclared ? 3 : 0],
    ["rename-occupied", declared.length > 1 ? 2 : 0],
    ["set-cell", anyDeclared ? 5 : 0],
    ["set-cell-absent", 2],
    ["touch", anyDeclared ? 2 : 0],
    ["mount", 4],
    ["unmount", 3],
    ["disable", anyDeclared ? 2 : 0],
    ["enable", anyDeclared ? 1 : 0],
    ["undo", withHistory ? 2 : 0],
    ["redo", withHistory ? 1 : 0],
    ["reset", 1],
  ].filter(([, weight]) => weight > 0);

  const kind = rng.weighted(choices);
  const key = anyDeclared ? rng.pick(declared) : generateSafeKey(rng);
  const cell = rng.pick(cells);

  switch (kind) {
    case "upsert-new":
      return {
        type: "record.upsert",
        path: collectionPath,
        key: generateSafeKey(rng, { taken: declared }),
        value: generateRowValue(rng, cells),
      };
    case "upsert-existing":
      return { type: "record.upsert", path: collectionPath, key, value: generateRowValue(rng, cells) };
    case "upsert-valueless":
      return { type: "record.upsert", path: collectionPath, key: generateSafeKey(rng, { taken: declared }) };
    case "patch":
      return {
        type: "record.patch",
        path: collectionPath,
        value: { [key]: generatePartialRow(rng, cells) },
      };
    case "set-all": {
      const kept = declared.filter(() => rng.bool(0.5));
      const added = rng.bool(0.6) ? [generateSafeKey(rng, { taken: declared })] : [];
      return {
        type: "record.setAll",
        path: collectionPath,
        value: Object.fromEntries([...kept, ...added].map((each) => [each, generateRowValue(rng, cells)])),
      };
    }
    case "remove-declared":
      return { type: "record.remove", path: collectionPath, key };
    case "remove-absent":
      return { type: "record.remove", path: collectionPath, key: generateSafeKey(rng, { taken: declared }) };
    case "rename-free":
      return {
        type: "record.rename",
        path: collectionPath,
        from: key,
        to: generateSafeKey(rng, { taken: declared }),
      };
    case "rename-occupied": {
      const other = rng.pick(declared.filter((each) => each !== key));
      return { type: "record.rename", path: collectionPath, from: key, to: other };
    }
    case "set-cell":
      return { type: "field.set", path: `${collectionPath}.${key}.${cell}`, value: generateTextValue(rng) };
    case "set-cell-absent":
      return {
        type: "field.set",
        path: `${collectionPath}.${generateSafeKey(rng, { taken: declared })}.${cell}`,
        value: generateTextValue(rng),
      };
    case "touch":
      return { type: "field.touch", path: `${collectionPath}.${key}.${cell}` };
    case "mount":
      return { type: "mount", paths: [`${collectionPath}.${key}.${cell}`] };
    case "unmount":
      return { type: "unmount", paths: [`${collectionPath}.${key}.${cell}`] };
    case "disable":
      return { type: "field.disable", path: `${collectionPath}.${key}.${cell}` };
    case "enable":
      return { type: "field.enable", path: `${collectionPath}.${key}.${cell}` };
    case "undo":
      return { type: "undo" };
    case "redo":
      return { type: "redo" };
    case "reset":
      return { type: "reset" };
    default:
      return { type: "flush" };
  }
}

/**
 * A whole campaign run: operations applied to the reference model as they are drawn, so each one is
 * generated against the state the previous ones produced.
 */
export function generateSequence(rng, model, { length, ...options }) {
  const operations = [];
  for (let index = 0; index < length; index += 1) {
    const operation = generateOperation(rng, model, options);
    operations.push(operation);
    model.apply(operation);
  }
  return operations;
}
