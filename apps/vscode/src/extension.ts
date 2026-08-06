import * as vscode from "vscode";
import { describeKind } from "./catalog-hover.js";
import { declarationAt } from "./slot-definition.js";

/**
 * Registration only.
 *
 * Everything that decides anything lives in `catalog-hover` and `slot-definition`, which know
 * nothing about the editor and are tested without one. What is left here is the part no test can
 * reach — turning an offset into a `Position` and a string into a `MarkdownString` — so it is kept
 * small enough to read in one go.
 */

const KIND_KEYS = new Set(["kind"]);

export function activate(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [
    { language: "json", scheme: "file" },
    { language: "jsonc", scheme: "file" },
  ];

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, /"[^"]*"/);
        if (!range) return undefined;

        // The word under the cursor has to be a `kind`'s value, not any string spelling a kind.
        const line = document.lineAt(position.line).text;
        const key = /"([^"]+)"\s*:\s*"[^"]*"\s*,?\s*$/.exec(line.slice(0, range.end.character + 1));
        if (!key || !KIND_KEYS.has(key[1])) return undefined;

        const markdown = describeKind(document.getText(range).slice(1, -1));
        return markdown ? new vscode.Hover(new vscode.MarkdownString(markdown), range) : undefined;
      },
    }),

    vscode.languages.registerDefinitionProvider(selector, {
      provideDefinition(document, position) {
        const found = declarationAt(document.getText(), document.offsetAt(position));
        if (!found) return undefined;
        return new vscode.Location(
          document.uri,
          new vscode.Range(
            document.positionAt(found.offset),
            document.positionAt(found.offset + found.length),
          ),
        );
      },
    }),
  );
}

export function deactivate(): void {
  // Both providers are disposed through `context.subscriptions`; nothing else is held.
}
