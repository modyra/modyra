/**
 * What an attack is made of: a serializable operation.
 *
 * An operation carries data only. Nothing here holds a function, a handle or a live object, because
 * the same sequence has to survive being written to a failure report, read back by the replay
 * command and shrunk into a smaller one. An operation that cannot be written down is a break nobody
 * can reproduce.
 */

/** Bumped when the shape of an operation changes; a report states the version it was written at. */
export const MDY_OPERATION_VERSION = 1;

export const MDY_OPERATION_TYPES = Object.freeze([
  "record.upsert",
  "record.remove",
  "record.rename",
  "record.patch",
  "record.setAll",
  "field.set",
  "field.touch",
  "field.dirty",
  "field.disable",
  "field.enable",
  "mount",
  "unmount",
  "submit",
  "reset",
  "undo",
  "redo",
  "draft.save",
  "draft.restore",
  "async.resolve",
  "async.reject",
  "flush",
  "destroy",
]);

/** The fields each operation type requires, beyond `type`. */
const REQUIRED = Object.freeze({
  "record.upsert": ["path", "key"],
  "record.remove": ["path", "key"],
  "record.rename": ["path", "from", "to"],
  "record.patch": ["path", "value"],
  "record.setAll": ["path", "value"],
  "field.set": ["path"],
  "field.touch": ["path"],
  "field.dirty": ["path"],
  "field.disable": ["path"],
  "field.enable": ["path"],
  mount: ["paths"],
  unmount: ["paths"],
  submit: [],
  reset: [],
  undo: [],
  redo: [],
  "draft.save": [],
  "draft.restore": [],
  "async.resolve": ["token"],
  "async.reject": ["token", "message"],
  flush: [],
  destroy: [],
});

/**
 * Structural changes are the operations worth generating around: a campaign that only edits values
 * never crosses the boundary where declaration, mounting and async work disagree.
 */
export const MDY_STRUCTURAL_OPERATIONS = Object.freeze([
  "record.upsert",
  "record.remove",
  "record.rename",
  "record.setAll",
  "draft.restore",
  "undo",
  "redo",
  "reset",
]);

export function isStructural(operation) {
  return MDY_STRUCTURAL_OPERATIONS.includes(operation?.type);
}

/** True when the value survives a JSON round trip unchanged in shape. */
function isSerializable(value, seen = new Set()) {
  if (value === null) return true;
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean" || type === "undefined") {
    return true;
  }
  if (type !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.every((entry) => isSerializable(entry, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return false;
  }
  return Object.values(value).every((entry) => isSerializable(entry, seen));
}

/** The reason this operation is not usable, or `null`. */
export function operationProblem(operation) {
  if (operation === null || typeof operation !== "object") return "operation is not an object";
  const required = REQUIRED[operation.type];
  if (!required) return `unknown operation type ${JSON.stringify(operation.type)}`;
  for (const key of required) {
    if (!(key in operation)) return `${operation.type} is missing ${key}`;
  }
  if ("paths" in operation && !Array.isArray(operation.paths)) {
    return `${operation.type}.paths is not an array`;
  }
  if (!isSerializable(operation)) return `${operation.type} carries a non-serializable member`;
  return null;
}

export function assertOperation(operation) {
  const problem = operationProblem(operation);
  if (problem) throw new Error(`invalid battle operation: ${problem}`);
  return operation;
}

/** One line, stable enough to appear in a report and be read by a person. */
export function describeOperation(operation) {
  switch (operation.type) {
    case "record.upsert":
      return `upsert ${operation.path}.${operation.key}`;
    case "record.remove":
      return `remove ${operation.path}.${operation.key}`;
    case "record.rename":
      return `rename ${operation.path}.${operation.from} -> ${operation.to}`;
    case "record.patch":
      return `patch ${operation.path} {${Object.keys(operation.value ?? {}).join(",")}}`;
    case "record.setAll":
      return `setAll ${operation.path} {${Object.keys(operation.value ?? {}).join(",")}}`;
    case "field.set":
      return `set ${operation.path} = ${JSON.stringify(operation.value)}`;
    case "mount":
    case "unmount":
      return `${operation.type} ${operation.paths.join(", ")}`;
    case "async.resolve":
      return `resolve ${operation.token}`;
    case "async.reject":
      return `reject ${operation.token} (${operation.message})`;
    default:
      return operation.path ? `${operation.type} ${operation.path}` : operation.type;
  }
}
