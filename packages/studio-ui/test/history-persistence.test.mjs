/**
 * The command history belongs to one project, and the session store is best-effort but not mute:
 * replacing the project ends the history, a late restore never overwrites work, and a failed
 * save or a throwing undo is reported in the status bar.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { installDomGlobals, createHost } from "./support/dom-env.mjs";

installDomGlobals();

const { mountStudio } = await import("../dist/index.js");
const { CommandHistory } = await import("../../studio-editor/dist/index.js");
const { serializeProject } = await import("../../studio-model/dist/index.js");
const { createCheckoutProject } = await import("../../studio-model/test/fixtures/checkout.fixture.mjs");

const click = (element) => element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const change = (element) => element.dispatchEvent(new window.Event("change", { bubbles: true }));
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const status = (host) => host.querySelector("footer[role=status]").textContent;

function openDock(host) {
  click(host.querySelector("[data-dock-toggle]"));
  return host;
}

/** Commits one real edit through the header's form-name editor. */
function edit(host, name) {
  const input = host.querySelector("[data-form-name]");
  input.value = name;
  change(input);
}

/** A minimal IndexedDB: one `sessions` slot, a gate on reads, and a switch that fails writes. */
function installFakeIndexedDb({ stored, failSave = false, gate = Promise.resolve() } = {}) {
  const state = { stored, saves: 0 };
  globalThis.indexedDB = {
    open() {
      const request = {};
      const db = {
        objectStoreNames: { contains: () => true },
        close() {},
        transaction() {
          const tx = {
            objectStore: () => ({
              put(value) {
                state.saves += 1;
                queueMicrotask(() => {
                  if (failSave) {
                    tx.error = new Error("quota exceeded");
                    tx.onerror?.();
                  } else {
                    state.stored = value;
                    tx.oncomplete?.();
                  }
                });
              },
              get() {
                const read = {};
                gate.then(() => {
                  read.result = state.stored;
                  read.onsuccess?.();
                });
                return read;
              },
            }),
          };
          return tx;
        },
      };
      queueMicrotask(() => {
        request.result = db;
        request.onsuccess?.();
      });
      return request;
    },
  };
  return state;
}

afterEach(() => {
  delete globalThis.indexedDB;
});

test("New blank project ends the history of the project it replaces", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());
  openDock(host);
  edit(host, "Renamed");
  assert.equal(host.querySelector("[data-undo]").disabled, false);

  click(host.querySelector("[data-new]"));

  assert.equal(host.querySelector("[data-undo]").disabled, true);
  assert.equal(host.querySelector("[data-redo]").disabled, true);
});

test("Import ends the history of the project it replaces", async () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());
  openDock(host);
  edit(host, "Renamed");
  assert.equal(host.querySelector("[data-undo]").disabled, false);

  const input = host.querySelector("[data-import]");
  const text = serializeProject(createCheckoutProject());
  Object.defineProperty(input, "files", { value: [{ text: async () => text }], configurable: true });
  change(input);
  await settle();

  assert.match(status(host), /Imported/);
  assert.equal(host.querySelector("[data-undo]").disabled, true);
  assert.equal(host.querySelector("[data-redo]").disabled, true);
});

test("a restored session starts with an empty history", async () => {
  installFakeIndexedDb({ stored: createCheckoutProject() });
  const host = createHost();
  mountStudio(host);
  await settle();

  assert.match(status(host), /Restored last session/);
  openDock(host);
  assert.equal(host.querySelector("[data-undo]").disabled, true);
});

test("a restore that arrives after an edit does not overwrite the edit", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  installFakeIndexedDb({ stored: createCheckoutProject(), gate });
  const host = createHost();
  mountStudio(host);
  openDock(host);

  edit(host, "Typed before the restore");
  release();
  await settle();

  assert.doesNotMatch(status(host), /Restored last session/);
  assert.equal(host.querySelector("[data-form-name]").value, "Typed before the restore");
  assert.equal(host.querySelector("[data-undo]").disabled, false);
});

test("a restore after New blank project does not bring the old session back", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  installFakeIndexedDb({ stored: createCheckoutProject(), gate });
  const host = createHost();
  mountStudio(host);
  openDock(host);

  click(host.querySelector("[data-new]"));
  release();
  await settle();

  assert.match(status(host), /New blank project/);
});

test("an undo that throws is reported in the status bar and does not escape the handler", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());
  openDock(host);
  edit(host, "Renamed");

  const original = CommandHistory.prototype.undo;
  const uncaught = [];
  const onError = (event) => uncaught.push(event.error ?? event.message);
  window.addEventListener("error", onError);
  CommandHistory.prototype.undo = () => {
    throw new Error("inverse failed");
  };
  try {
    click(host.querySelector("[data-undo]"));
  } finally {
    CommandHistory.prototype.undo = original;
    window.removeEventListener("error", onError);
  }

  assert.deepEqual(uncaught, []);
  assert.match(status(host), /inverse failed/);
});

test("a redo that throws is reported in the status bar", () => {
  const host = createHost();
  mountStudio(host, createCheckoutProject());
  openDock(host);
  edit(host, "Renamed");
  click(host.querySelector("[data-undo]"));

  const original = CommandHistory.prototype.redo;
  CommandHistory.prototype.redo = () => {
    throw new Error("command failed");
  };
  try {
    click(host.querySelector("[data-redo]"));
  } finally {
    CommandHistory.prototype.redo = original;
  }

  assert.match(status(host), /command failed/);
});

test("a session that cannot be saved is reported in the status bar", async () => {
  installFakeIndexedDb({ failSave: true });
  const host = createHost();
  mountStudio(host, createCheckoutProject());

  edit(host, "Renamed");
  await settle();

  assert.match(status(host), /could not be saved/i);
  assert.match(status(host), /quota exceeded/);
});

test("a session that saves leaves the status of the edit alone", async () => {
  const db = installFakeIndexedDb({});
  const host = createHost();
  mountStudio(host, createCheckoutProject());

  edit(host, "Renamed");
  await settle();

  assert.equal(db.saves, 1);
  assert.doesNotMatch(status(host), /could not be saved/i);
});

test("a browser without IndexedDB tells the user once, not after every edit", async () => {
  delete globalThis.indexedDB;
  const host = createHost();
  mountStudio(host, createCheckoutProject());

  edit(host, "Renamed");
  await settle();
  assert.match(status(host), /could not be saved/i);
  assert.match(status(host), /no IndexedDB/);

  edit(host, "Renamed again");
  await settle();
  assert.equal(status(host), "Rename form to Renamed again", "the second edit keeps its own status");
});
