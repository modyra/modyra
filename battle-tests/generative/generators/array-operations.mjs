/**
 * Sequences aimed at what makes a positional collection different: the rows below the one you
 * touched change their names.
 *
 * The weights push towards the places where that matters — a write to an index while a row is being
 * inserted above it, a move that carries a mounted control's path away from the row it was showing,
 * a removal at the boundary. Indices are drawn in range most of the time and out of range sometimes,
 * because "a write to a row that does not exist is a write to nothing" is a claim.
 */

import { generatePartialRow, generateRowValue, generateTextValue } from "./field-values.mjs";

export function generateArrayOperation(rng, model, { collectionPath = "items", cells } = {}) {
  const length = model.length();
  const has = length > 0;

  const kind = rng.weighted(
    [
      ["push", has ? 4 : 10],
      ["insert", has ? 4 : 2],
      ["insert-out-of-range", 1],
      ["remove", has ? 4 : 0],
      ["remove-out-of-range", 1],
      ["move", length > 1 ? 4 : 0],
      ["move-out-of-range", length > 0 ? 1 : 0],
      ["set-all", 2],
      ["set-cell", has ? 5 : 0],
      ["set-cell-out-of-range", 2],
      ["touch", has ? 2 : 0],
      // Mounting is not generated here. What a control binds to in a *positional* collection — a
      // position that outlives the rows passing through it, or a row that takes the binding with it
      // when it ends — is an open question, pinned in
      // adversarial/collections/array-claim-creates-rows.battle.test.mjs. Generating mounts makes
      // every campaign rediscover that one instead of looking for the next thing.
      ["disable", has ? 2 : 0],
      ["enable", has ? 1 : 0],
      ["reset", 1],
    ].filter(([, weight]) => weight > 0),
  );

  const index = has ? rng.int(length) : 0;
  const beyond = length + rng.int(3);
  const cell = rng.pick(cells);

  switch (kind) {
    case "push":
      return { type: "array.push", path: collectionPath, value: generateRowValue(rng, cells) };
    case "insert":
      return { type: "array.insert", path: collectionPath, index, value: generateRowValue(rng, cells) };
    case "insert-out-of-range":
      return { type: "array.insert", path: collectionPath, index: beyond, value: generatePartialRow(rng, cells) };
    case "remove":
      return { type: "array.remove", path: collectionPath, index };
    case "remove-out-of-range":
      return { type: "array.remove", path: collectionPath, index: beyond };
    case "move": {
      const to = rng.int(length);
      return { type: "array.move", path: collectionPath, from: index, to };
    }
    case "move-out-of-range":
      return { type: "array.move", path: collectionPath, from: index, to: beyond };
    case "set-all": {
      const rows = Array.from({ length: rng.int(4) }, () => generateRowValue(rng, cells));
      return { type: "array.setAll", path: collectionPath, value: rows };
    }
    case "set-cell":
      return { type: "field.set", path: `${collectionPath}.${index}.${cell}`, value: generateTextValue(rng) };
    case "set-cell-out-of-range":
      return { type: "field.set", path: `${collectionPath}.${beyond}.${cell}`, value: generateTextValue(rng) };
    case "touch":
      return { type: "field.touch", path: `${collectionPath}.${index}.${cell}` };
    case "disable":
      return { type: "field.disable", path: `${collectionPath}.${index}.${cell}` };
    case "enable":
      return { type: "field.enable", path: `${collectionPath}.${index}.${cell}` };
    case "reset":
      return { type: "reset" };
    default:
      return { type: "flush" };
  }
}

export function generateArraySequence(rng, model, { length, ...options }) {
  const operations = [];
  for (let index = 0; index < length; index += 1) {
    const operation = generateArrayOperation(rng, model, options);
    operations.push(operation);
    model.apply(operation);
  }
  return operations;
}
