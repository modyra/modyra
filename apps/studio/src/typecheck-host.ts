/** Provides an in-memory TypeScript compiler host for generated files. */
import ts from "typescript";

export interface VirtualFile {
  readonly path: string;
  readonly content: string;
}

/** Bare module specifiers this host can resolve, and where their vendored .d.ts root lives. */
const KNOWN_MODULE_ROOTS: Record<string, string> = {
  "@modyra/core": "/vendor/core/index.d.ts",
  "@modyra/react": "/vendor/react/index.d.ts",
};

function posixDirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

function posixJoin(dir: string, relative: string): string {
  const segments = `${dir}/${relative}`.split("/");
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") out.pop();
    else out.push(segment);
  }
  return `/${out.join("/")}`;
}

/**
 * True only when every bare (non-relative) import across `files` is one
 * this host actually has a vendored .d.ts root for in `assets` — e.g.
 * Angular's generated form.ts imports "@modyra/angular/adapter", which
 * is never vendored (see generate-typecheck-assets.mjs's doc comment),
 * so its artifacts correctly fall back to syntax-only checking instead
 * of a false "cannot find module" diagnostic.
 */
export function supportsSemanticCheck(assets: Readonly<Record<string, string>>, files: readonly VirtualFile[]): boolean {
  const specifiers = new Set<string>();
  for (const file of files) {
    const source = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specifiers.add(node.moduleSpecifier.text);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        specifiers.add(node.argument.literal.text);
      } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")) {
          specifiers.add(node.arguments[0].text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const specifier of specifiers) {
    if (specifier.startsWith(".")) continue;
    const root = KNOWN_MODULE_ROOTS[specifier];
    if (!root || !(root in assets)) return false;
  }
  return true;
}

/** Real semantic diagnostics for `files` against `assets` — call `supportsSemanticCheck` first. */
export function checkTypes(assets: Readonly<Record<string, string>>, files: readonly VirtualFile[]): readonly ts.Diagnostic[] {
  const fileMap = new Map<string, string>(Object.entries(assets));
  const rootNames: string[] = [];
  for (const file of files) {
    const path = `/project/${file.path}`;
    fileMap.set(path, file.content);
    rootNames.push(path);
  }

  function resolveOne(moduleText: string, containingFile: string): string | undefined {
    const knownRoot = KNOWN_MODULE_ROOTS[moduleText];
    if (knownRoot) return fileMap.has(knownRoot) ? knownRoot : undefined;
    if (!moduleText.startsWith(".")) return undefined;
    const base = posixJoin(posixDirname(containingFile), moduleText);
    const candidates = [
      base,
      base.replace(/\.js$/, ".ts"),
      base.replace(/\.js$/, ".d.ts"),
      `${base}.ts`,
      `${base}.d.ts`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
    `${base}/index.d.ts`,
    ];
    return candidates.find((candidate) => fileMap.has(candidate));
  }

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  };

  const host: ts.CompilerHost = {
    getSourceFile(fileName, languageVersion) {
      const content = fileMap.get(fileName);
      return content === undefined ? undefined : ts.createSourceFile(fileName, content, languageVersion, true);
    },
    getDefaultLibFileName: () => "/lib/lib.es2022.d.ts",
    writeFile: () => undefined,
    getCurrentDirectory: () => "/",
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (fileName) => fileMap.has(fileName),
    readFile: (fileName) => fileMap.get(fileName),
    resolveModuleNameLiterals(moduleLiterals, containingFile) {
      return moduleLiterals.map((literal) => {
        const resolvedFileName = resolveOne(literal.text, containingFile);
        if (!resolvedFileName) return { resolvedModule: undefined };
        const extension = resolvedFileName.endsWith(".d.ts") ? ts.Extension.Dts : ts.Extension.Ts;
        return { resolvedModule: { resolvedFileName, extension, isExternalLibraryImport: false } };
      });
    },
  };

  const program = ts.createProgram({ rootNames, options, host });
  return [...program.getGlobalDiagnostics(), ...program.getSemanticDiagnostics()];
}
