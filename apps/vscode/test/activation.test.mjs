import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";

/**
 * Loads the shipped bundle with the editor stubbed out.
 *
 * `extension.ts` is the one file no unit test reaches, and it is where the hover decides whether the
 * string under the cursor is a `kind`'s value — hand-written, and the likeliest thing here to be
 * wrong. Requiring the CommonJS bundle also checks the thing a passing build does not: that the host
 * can load it at all, with `vscode` as its only external.
 */

const registered = { hover: undefined, definition: undefined };

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

const vscodeStub = {
  languages: {
    registerHoverProvider: (_selector, provider) => void (registered.hover = provider) ?? { dispose() {} },
    registerDefinitionProvider: (_selector, provider) => void (registered.definition = provider) ?? { dispose() {} },
  },
  Hover: class {
    constructor(contents, range) {
      this.contents = contents;
      this.range = range;
    }
  },
  MarkdownString: class {
    constructor(value) {
      this.value = value;
    }
  },
  Location: class {
    constructor(uri, range) {
      this.uri = uri;
      this.range = range;
    }
  },
  Range,
  Position,
};

// The bundle reaches for `vscode` when a provider runs, not when it loads, so the stub stays
// installed for the life of the process. Restoring it after the require would leave the real
// resolver in place for every call the tests actually make.
const load = Module._load;
Module._load = (request, parent, isMain) =>
  request === "vscode" ? vscodeStub : load(request, parent, isMain);

const extension = createRequire(import.meta.url)("../dist/extension.cjs");

/** A document standing in for the editor's, backed by the text it was given. */
const documentOf = (text) => ({
  uri: "file:///contract.json",
  getText: (range) => (range ? text.slice(range.start.character, range.end.character) : text),
  lineAt: (line) => ({ text: text.split("\n")[line] }),
  offsetAt: (position) => position.character,
  positionAt: (offset) => new Position(0, offset),
  getWordRangeAtPosition: (position, pattern) => {
    for (const match of text.matchAll(new RegExp(pattern.source, "g"))) {
      const start = match.index;
      const end = start + match[0].length;
      if (position.character >= start && position.character <= end) {
        return new Range(new Position(0, start), new Position(0, end));
      }
    }
    return undefined;
  },
});

test("activation registers both providers and disposes through subscriptions", () => {
  const context = { subscriptions: [] };
  extension.activate(context);

  assert.ok(registered.hover, "no hover provider registered");
  assert.ok(registered.definition, "no definition provider registered");
  assert.equal(context.subscriptions.length, 2, "a provider was registered without being disposable");
});

test("hovering a kind's value describes that kind", () => {
  const line = '  "kind": "select",';
  const document = documentOf(line);
  const hover = registered.hover.provideHover(document, new Position(0, line.indexOf('"select"') + 2));

  assert.ok(hover, "hovering a kind produced nothing");
  assert.match(hover.contents.value, /`select`/);
  assert.match(hover.contents.value, /\*\*Parts\*\*/);
});

test("hovering a string that is not a kind's value produces nothing", () => {
  // The same word, under a key that does not name a widget. Without the key check this reads as a
  // kind and a label starts explaining a listbox.
  const line = '  "label": "select",';
  const document = documentOf(line);
  assert.equal(registered.hover.provideHover(document, new Position(0, line.indexOf('"select"') + 2)), undefined);
});

test("hovering a kind the catalogue does not have produces nothing", () => {
  const line = '  "kind": "richtext",';
  const document = documentOf(line);
  assert.equal(registered.hover.provideHover(document, new Position(0, line.indexOf('"richtext"') + 2)), undefined);
});

test("the definition provider hands back a location in the same document", () => {
  const text = '{"version":2,"fields":[{"name":"street","kind":"text"}],"layout":[{"kind":"section","id":"s","children":["street"]}]}';
  const document = documentOf(text);
  const at = text.lastIndexOf('"street"') + 1;

  const location = registered.definition.provideDefinition(document, new Position(0, at));
  assert.ok(location, "a layout child resolved to nothing through the provider");
  assert.equal(location.uri, document.uri);
  assert.ok(location.range.start.character < text.indexOf('"layout"'));
});

test("deactivate holds nothing", () => {
  assert.equal(extension.deactivate(), undefined);
});
