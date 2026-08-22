/**
 * The legend a demo puts above its controls, shared by every example that has any.
 *
 * Written once and in plain DOM, so the React, Vue, Lit, Svelte, Solid, Preact and framework-free
 * demos all show the same thing: they differ in how they mount a form, not in what a form is.
 */
/**
 * The legend that sits above a panel's controls.
 *
 * A panel shows sixteen controls and a reader has to guess which one is which, what each is supposed
 * to answer, and whether a key that did nothing was a key the control ever claimed. The legend says
 * all three, so a report can name the control and the key instead of describing them.
 *
 * **It reads the controls off the page and the rest off the published contract.** The kinds come from
 * the `mdy-renderer--<kind>` class every root carries, the parts and keys from `MDY_WIDGET_CONTRACTS`
 * and `MDY_WIDGET_KEYBOARD`. Nothing about a control is written here, so the legend cannot describe a
 * page that is no longer the one being shown — a legend with its own copy goes stale on the first
 * release and then misleads with authority, which is the failure this page exists to catch one layer
 * down.
 *
 * Reading the DOM rather than a declared list is also what makes it work unchanged in a panel that
 * builds its fields some other way, and in a demo written for another framework: every renderer draws
 * that class because the contract says so.
 *
 * The second column says **renderer**, not kind, and the difference is the contract's rather than this
 * page's: `email`, `password` and `text` all declare `mdy-renderer--text` on their root, because they
 * are one renderer driven three ways. So the page can tell you which renderer drew a control and
 * cannot tell you which kind was declared. Calling that column `Kind` would be a legend that lies
 * about three of seventeen rows.
 *
 * Call it **after** the controls are mounted, with the panel's work area; it finds the block the
 * controls are in and puts itself directly above that, so it reads as a heading for them rather than
 * as another thing on the page.
 */
export function legend(host, { contracts, keyboard, title = "The controls on this page" } = {}) {
  paintLegendOnce();
  const roots = Array.from(host.querySelectorAll('[class*="mdy-renderer--"]'));
  const seen = [];
  for (const root of roots) {
    const kind = (root.className.toString().match(/mdy-renderer--([a-z]+)/) ?? [])[1];
    if (kind === undefined) continue;
    const label = root.querySelector(".mdy-label")?.textContent?.trim();
    seen.push([kind, label === undefined || label === "" ? kind : label]);
  }

  const box = document.createElement("details");
  box.className = "legend";
  const summary = document.createElement("summary");
  summary.textContent = `${title} — ${seen.length} control${seen.length === 1 ? "" : "s"}`;
  box.append(summary);

  if (seen.length === 0) {
    const empty = document.createElement("p");
    // Saying so beats printing an empty table: a panel with no controls is a fact about the panel.
    empty.textContent = "No controls on this panel.";
    box.append(empty);
  } else {
    const table = document.createElement("table");
    const head = document.createElement("thead");
    head.innerHTML = "<tr><th>Control</th><th>Renderer</th><th>Keys it claims</th><th>Parts it draws</th></tr>";
    const body = document.createElement("tbody");

    for (const [kind, label] of seen) {
      const contract = contracts?.[kind];
      const keys = (keyboard?.[kind] ?? []).map((binding) => {
        const key = binding.key === " " ? "Space" : binding.key;
        const when = binding.when === undefined || binding.when === null ? "" : ` (${binding.when})`;
        // `requires` names a capability the field opts into, and it is off unless a document asked
        // for it. Without this the legend listed the reordering keys exactly like the others, so a
        // reader tried them on a demo that had never turned `reorderable` on and concluded the
        // feature was broken. A key the control will not answer must not look like one it will.
        const needs = binding.requires === undefined || binding.requires === null
          ? ""
          : ` [needs ${binding.requires}]`;
        return `${key}${when} → ${binding.intent}${needs}`;
      });

      const row = document.createElement("tr");
      row.dataset.legendKind = kind;
      const cell = (text, className) => {
        const td = document.createElement("td");
        td.textContent = text;
        if (className !== undefined) td.className = className;
        row.append(td);
      };
      cell(label);
      cell(kind, "legend__kind");
      cell(keys.length === 0 ? "none declared" : keys.join(" · "), "legend__keys");
      cell(
        contract === undefined
          ? "the contract does not describe this kind"
          : `${Object.keys(contract.parts).length}: ${Object.keys(contract.parts).join(" ")}`,
        "legend__parts",
      );
      body.append(row);
    }

    table.append(head, body);
    box.append(table);
  }

  // One legend per host. A framework demo re-renders its tree, and a legend inserted on every pass
  // stacks up; removing the previous one is cheaper than tracking whether this is the first call.
  host.querySelector(":scope > .legend")?.remove();

  // Above the controls, not above the panel: the toolbar that drives them stays where a reader
  // expects it, and the legend sits between the controls and whatever changes them.
  const anchor = roots[0] === undefined ? null : (() => {
    let node = roots[0];
    while (node.parentElement !== null && node.parentElement !== host) node = node.parentElement;
    return node.parentElement === host ? node : null;
  })();
  if (anchor === null) host.prepend(box); else host.insertBefore(box, anchor);
  return box;
}



/**
 * The legend's own styling, injected once per document.
 *
 * Seven demos in six frameworks share this component; putting the rules in each page's stylesheet
 * would be six copies to keep in step, and the first one to fall behind would be the page nobody
 * opened that week. The selectors are all under `.legend`, so nothing here can reach a control.
 */
function paintLegendOnce() {
  if (document.getElementById("mdy-legend-style") !== null) return;
  const style = document.createElement("style");
  style.id = "mdy-legend-style";
  style.textContent = `
.legend { margin: 0 0 1.25rem; border: 1px solid currentColor; border-radius: 0.4rem; padding: 0.5rem 0.75rem; opacity: 0.9; }
.legend summary { cursor: pointer; font-weight: 600; }
.legend table { width: 100%; border-collapse: collapse; margin-top: 0.6rem; font-size: 0.82rem; }
.legend th, .legend td { text-align: left; vertical-align: top; padding: 0.25rem 0.5rem 0.25rem 0; border-bottom: 1px solid rgba(128,128,128,0.35); }
.legend th { font-weight: 600; opacity: 0.75; }
.legend__kind, .legend__keys, .legend__parts { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.legend__keys, .legend__parts { opacity: 0.8; }
/* Reference, not the subject: the legend must never push the controls off the first screen. */
.legend[open] table { display: block; max-height: 18rem; overflow: auto; }
`;
  document.head.append(style);
}

/**
 * The same legend, for a demo whose controls arrive when a framework decides they do.
 *
 * The framework-free page mounts its fields inside a call and can put the legend up straight
 * afterwards. React, Vue, Solid, Preact, Svelte and Lit do not offer that moment to a plain script, so
 * this watches the host until controls appear and then draws the legend once, redrawing it if the tree
 * is replaced.
 *
 * It gives up after a while rather than observing forever: a demo with no controls is a fact, and a
 * watcher left running on every example page is a cost paid for nothing.
 */
export function legendWhenReady(selector, options = {}) {
  const host = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (host === null || host === undefined) return () => {};

  let drawn = 0;
  const draw = () => {
    if (host.querySelector('[class*="mdy-renderer--"]') === null) return false;
    legend(host, options);
    drawn += 1;
    return true;
  };

  if (draw()) return () => {};

  const observer = new MutationObserver(() => { if (draw()) observer.disconnect(); });
  observer.observe(host, { childList: true, subtree: true });
  // Ten seconds is far past any of these demos' first paint; past it, there is nothing to describe.
  const giveUp = setTimeout(() => observer.disconnect(), 10_000);
  return () => { observer.disconnect(); clearTimeout(giveUp); };
}
