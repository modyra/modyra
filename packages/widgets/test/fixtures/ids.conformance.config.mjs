/**
 * A renderer whose only interesting property is which ids it puts on the page.
 *
 * `Multi-instance isolation` reads the ids of two live instances and reports what they share. The
 * four answers it must tell apart are set by `MDY_FIXTURE_IDS`:
 *
 *   none      no id anywhere            nothing could collide, and nothing was established
 *   all       one id per scope          the question was asked and answered
 *   partial   ids for one kind only     answered for that kind, unanswerable for the other
 *   collide   the same id in both       the defect the section exists to catch
 *
 * It draws none of the anatomy a contract asks for, so the other sections report against it. That
 * is not the subject here: what is read is the one section's verdict, not the run's exit code.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const MODE = process.env.MDY_FIXTURE_IDS ?? "none";

export const name = `ids fixture (${MODE})`;
export const kinds = ["text", "checkbox"];

/** Which id this kind carries in this scope, or null when it carries none. */
function idFor(kind, scope) {
  if (MODE === "none") return null;
  if (MODE === "collide") return `${kind}-input`;
  if (MODE === "partial" && kind !== kinds[0]) return null;
  return `${kind}-${scope}-input`;
}

function build(kind, scope) {
  const host = document.createElement("div");
  const control = document.createElement("input");
  const id = idFor(kind, scope);
  if (id !== null) control.id = id;
  host.append(control);
  document.body.append(host);
  return {
    root: host,
    parts: () => ({}),
    drive: () => false,
    settle: () => undefined,
    dispose: () => host.remove(),
  };
}

export const mount = (kind) => build(kind, "one");
export const mountScoped = (kind, scope) => build(kind, scope);
