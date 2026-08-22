/**
 * What a page says about itself, asked the same way by every host.
 *
 * These four read the document and nothing else: no form, no framework, no handle. A dangling
 * reference is dangling whoever rendered it, and where focus sits is a fact about the page. They
 * belong to no adapter, and there is exactly one right answer to each — which is why they are here
 * rather than three times over.
 *
 * They lived in the plain host alone. Lit and Angular published neither, so every spec that asks a
 * page these questions could only ask one renderer, and the two that could not answer were left out
 * of the file rather than reported as unable — which is how a suite goes quiet about a whole adapter
 * without anyone deciding to.
 */

/** Every ARIA reference that names an id no element carries. */
export function danglingReferences() {
  const dangling = [];
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of [
      "for",
      "aria-controls",
      "aria-describedby",
      "aria-labelledby",
      "aria-errormessage",
      "aria-activedescendant",
    ]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      // An IDREF list is space-separated, so a reference with a space inside one of its ids is two
      // broken references rather than one working one.
      for (const id of value.split(/\s+/)) {
        if (id && !document.getElementById(id)) {
          dangling.push(`${element.tagName.toLowerCase()}[${attribute}="${id}"]`);
        }
      }
    }
  }
  return dangling;
}

/**
 * Ids more than one element carries.
 *
 * The browser accepts them without complaint, and every IDREF then resolves to whichever element the
 * document reaches first — so a duplicate is a reference pointing at the wrong thing rather than at
 * nothing, which is the harder half to see.
 */
export function duplicateIds() {
  const counts = new Map();
  for (const element of document.querySelectorAll("[id]")) {
    counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

/** Where focus is, and whether that element is still in the document. */
export function focusState() {
  const active = document.activeElement;
  return {
    tag: active?.tagName.toLowerCase() ?? null,
    id: active?.id ?? null,
    connected: active ? active.isConnected : false,
    isBody: active === document.body,
  };
}

/** How many controls the stage holds, for a spec asking whether a teardown left any behind. */
export function controlCount() {
  return document.querySelectorAll("#stage input, #stage select, #stage button").length;
}

/**
 * Say something in a live region, through the published helper.
 *
 * Framework-free by construction — `createMdyAnnouncer` takes a region id and a string — so a host
 * that could not offer it was withholding a widgets helper rather than an adapter's behaviour.
 */
export function announceThrough(createMdyAnnouncer) {
  return (regionId, message) => createMdyAnnouncer(regionId).announce(message);
}

/** The four together, for a host to spread into the object it publishes. */
export const documentProbes = { danglingReferences, duplicateIds, focusState, controlCount };
