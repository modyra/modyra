/**
 * The smallest sequence that still breaks it.
 *
 * A generated failure is typically forty operations of which four matter. Shrinking is what turns a
 * report nobody reads into one anybody can act on, and it is also a check on the finding itself: a
 * break that survives being cut to three operations is a break, while one that evaporates was a
 * property of the noise around it.
 *
 * The passes run in the order the specification fixes — fewer operations first, then smaller rows,
 * then simpler keys and values — because each later pass is only worth running on a sequence the
 * earlier ones have already made small.
 */

/**
 * @param operations  The failing sequence.
 * @param stillFails  Runs a candidate sequence and answers whether it still breaks the claim.
 *                    It must be side-effect free with respect to the caller: each run builds its own
 *                    form.
 */
export async function shrink(operations, stillFails, { maxRounds = 6 } = {}) {
  let best = [...operations];
  let attempts = 0;

  const tryCandidate = async (candidate) => {
    if (candidate.length >= best.length && sameSequence(candidate, best)) return false;
    attempts += 1;
    if (!(await stillFails(candidate))) return false;
    best = candidate;
    return true;
  };

  for (let round = 0; round < maxRounds; round += 1) {
    const before = best.length;

    // 1. Fewer operations: drop the largest chunks that keep the break, then single operations.
    for (let size = Math.ceil(best.length / 2); size >= 1; size = Math.floor(size / 2)) {
      let index = 0;
      while (index + size <= best.length) {
        const candidate = [...best.slice(0, index), ...best.slice(index + size)];
        if (candidate.length > 0 && (await tryCandidate(candidate))) continue;
        index += size;
      }
      if (size === 1) break;
    }

    // 2. Fewer rows: collapse the keys that are not needed to reach the break.
    for (const key of keysIn(best)) {
      const candidate = best.filter((operation) => !mentionsKey(operation, key));
      if (candidate.length !== best.length) await tryCandidate(candidate);
    }

    // 3. Simpler keys and values: the shape of a key is evidence only if it is load-bearing.
    await tryCandidate(best.map(simplifyOperation));

    if (best.length === before) break;
  }

  return { minimized: best, attempts };
}

function sameSequence(a, b) {
  return a.length === b.length && a.every((operation, index) => operation === b[index]);
}

function keysIn(operations) {
  const keys = new Set();
  for (const operation of operations) {
    if (operation.key) keys.add(operation.key);
    if (operation.from) keys.add(operation.from);
    if (operation.to) keys.add(operation.to);
    for (const path of operation.paths ?? []) {
      const key = path.split(".")[1];
      if (key) keys.add(key);
    }
    if (typeof operation.path === "string" && operation.path.includes(".")) {
      keys.add(operation.path.split(".")[1]);
    }
    for (const key of Object.keys(operation.value ?? {})) keys.add(key);
  }
  return [...keys];
}

function mentionsKey(operation, key) {
  if (operation.key === key || operation.from === key || operation.to === key) return true;
  if ((operation.paths ?? []).some((path) => path.split(".")[1] === key)) return true;
  if (typeof operation.path === "string" && operation.path.split(".")[1] === key) return true;
  return typeof operation.value === "object" && operation.value !== null && key in operation.value;
}

/** Values carry no information once the sequence is minimal; keys keep their shape. */
function simplifyOperation(operation) {
  if (operation.type === "field.set" && typeof operation.value === "string" && operation.value !== "") {
    return { ...operation, value: "x" };
  }
  return operation;
}
