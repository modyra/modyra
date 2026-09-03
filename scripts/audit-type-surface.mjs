#!/usr/bin/env node
/**
 * The exported type surface of the 1.0 packages, snapshotted so a change to it is a diff.
 *
 *   node scripts/audit-type-surface.mjs           # compare against the baseline
 *   node scripts/audit-type-surface.mjs --write   # accept the current surface
 *   node scripts/audit-type-surface.mjs --since <ref>   # compare against the surface at a ref
 *
 * `contract-diff` snapshots the widget *catalogue* — parts, relations, states, capabilities. It has
 * never seen a TypeScript type, so every public interface in `@modyra/core` and `@modyra/widgets`
 * has been outside classification: adding a required field to one, or removing a member, reported
 * `patch` because the differ had nothing to compare. That is finding **K**, and it has been hit four
 * times: a projection's shape, an added root export, a form-contract field, and a reactivity field
 * that four adapters implement.
 *
 * This reads the *generated* declarations rather than the source, because what a consumer sees is
 * what was emitted — a type that is internal in the source and exported in `dist` is exactly the
 * kind of thing nobody notices until it cannot be changed.
 *
 * What it records per exported interface or type alias is its member names, sorted, and whether each
 * is optional. Not the member *types*: a widening from `string` to `string | number` is a real
 * change this cannot see, and pretending otherwise would be worse than saying so.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import ts from "typescript";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const BASELINE = resolve(ROOT, "packages/widgets/contract-baseline/type-surface.json");
/**
 * Where a shape is *declared*, and separately, whether a consumer can *reach* it.
 *
 * These are two different questions and reading only one of them gets the surface wrong in both
 * directions. Reading `index.d.ts` alone captured 38 shapes and missed `MdyFormError`, which is
 * declared in `types.d.ts` and only re-exported — so the shapes have to be gathered from every
 * emitted declaration. But gathering them from every declaration and stopping there counted 623
 * "public" shapes when a consumer can reach 26 subpaths: `FieldRecord`, `Hct`, `define` and
 * `MdyWidgetShape` were all reported as public and none of them is on an entry.
 *
 * So: shapes from everywhere, filtered by the names the declared `exports` map actually publishes.
 */
const PACKAGES = ["core", "widgets", "angular"];
const PACKAGE_DIRS = PACKAGES.map((name) => `packages/${name}/dist`);

/**
 * Every scannable package is built, checked before anything reads a file.
 *
 * A directory that is missing, or that exists and holds no declaration, is the same absence wearing
 * two faces — and the second is the dangerous one: the scan finds nothing, records nothing, and the
 * baseline then says the package publishes no surface rather than that nobody looked. It fails
 * today either way, on whatever file the manifest reader reaches for next, with a stack that names
 * none of this.
 *
 * Placed here rather than beside the scan because `publicNames()` reads a manifest first and dies
 * before the scan is reached, so a check further down is a check that never runs.
 */
for (const [index, dir] of PACKAGE_DIRS.entries()) {
  const pkg = PACKAGES[index];
  const full = resolve(ROOT, dir);
  const declarations = existsSync(full)
    ? (function count(at) {
        let found = 0;
        for (const entry of readdirSync(at)) {
          const child = join(at, entry);
          found += statSync(child).isDirectory() ? count(child) : (entry.endsWith(".d.ts") ? 1 : 0);
          if (found > 0) return found;
        }
        return found;
      })(full)
    : 0;
  if (declarations === 0) {
    console.error(`packages/${pkg}/dist holds no declaration file — build it before recording a `
      + "surface, or the baseline says this package publishes nothing when nobody looked.");
    process.exit(2);
  }
}

/**
 * Every name a consumer can import, from every subpath the package declares.
 *
 * Resolved through the checker rather than by reading the entry's own text: an entry that says
 * `export * from "./types.js"` names nothing, and the whole point is what that expands to.
 */

/**
 * Split a type at the top level on one separator, ignoring anything nested or quoted.
 *
 * `A | B<C | D>` is two members and not three. A naive split on the separator reads the inner `|` as a
 * boundary and produces members that are not types, which then sort into an order that has nothing to
 * do with the original — so the normalisation below would report a change where there is none, which
 * is the defect it exists to remove, arriving by another road.
 */
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let at = 0; at < text.length; at += 1) {
    const ch = text[at];
    if (quote !== null) {
      if (ch === quote && text[at - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "<" || ch === "(" || ch === "{" || ch === "[") depth += 1;
    else if (ch === ">" || ch === ")" || ch === "}" || ch === "]") depth -= 1;
    else if (ch === separator && depth === 0) { parts.push(text.slice(start, at)); start = at + 1; }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

/**
 * The same type, written the same way — so that two spellings of one type compare equal.
 *
 * **A union is a set and a record is a record; neither has an order a consumer can observe.** The
 * differ compared them as text, so adding one part to one contract reshuffled a union on nine Angular
 * components and each reshuffle was reported `major`; adding an *optional input* to an Angular
 * component rewrote its whole `ɵcmp` declaration and that was reported `major` too. Sixteen of those
 * in one batch, every one additive.
 *
 * The cost is not the noise. `contract:diff` is the authority on what ships, and an authority that is
 * wrong sixteen times in a batch spends the attention it needs for the seventeenth — which is the one
 * that will be real.
 *
 * This normalises order and nothing else. **A member added to a union still changes the normalised
 * form**, so a widened return type or a new object member is still reported: what stops being reported
 * is the same members in a different sequence.
 */
/**
 * An object-literal type as its members, or `null` when the text is not one.
 *
 * **Why the shape matters and the text does not.** A type written `{ readonly a: string; readonly
 * b: string }` that gains a key is additive: every consumer reading `a` still reads `a`. Compared as
 * a string it is simply *different*, and different was reported `major` — the fourth false major of
 * this family, after unions reshuffled by order, `ɵcmp` rewritten by an optional input, and a
 * reworded doc comment. Each was additive; each spent the attention the real one will need.
 *
 * Split at depth zero, not on every `;`: a nested object or a generic carries its own separators, and
 * a naive split would tear one member into two and report both halves as changed.
 */
function objectMembers(text) {
  const body = text.trim();
  if (!body.startsWith("{") || !body.endsWith("}")) return null;
  const inner = body.slice(1, -1);
  const members = new Map();
  let depth = 0;
  let current = "";
  const flush = () => {
    const part = current.trim();
    current = "";
    if (part === "") return;
    const colon = splitAtTopLevelColon(part);
    if (colon === -1) return members.set(part, "");
    const key = part.slice(0, colon).replace(/^readonly\s+/, "").replace(/\?$/, "").trim();
    members.set(key, part.slice(colon + 1).trim());
  };
  for (const ch of inner) {
    if (ch === "{" || ch === "(" || ch === "[" || ch === "<") depth += 1;
    else if (ch === "}" || ch === ")" || ch === "]" || ch === ">") depth -= 1;
    if ((ch === ";" || ch === ",") && depth === 0) { flush(); continue; }
    current += ch;
  }
  flush();
  return members.size === 0 ? null : members;
}

/** The first `:` that separates a member's name from its type, ignoring any inside brackets. */
function splitAtTopLevelColon(part) {
  let depth = 0;
  for (let i = 0; i < part.length; i += 1) {
    const ch = part[i];
    if (ch === "{" || ch === "(" || ch === "[" || ch === "<") depth += 1;
    else if (ch === "}" || ch === ")" || ch === "]" || ch === ">") depth -= 1;
    else if (ch === ":" && depth === 0) return i;
  }
  return -1;
}

function normaliseType(text) {
  // Documentation is not surface. A doc comment sits inside an inline object type in the emitted
  // declaration, so rewording one changed the compared string and was reported **major** on a type
  // whose members had not moved — the tool reading the text where the relation is what it is for.
  // A comment cannot break a consumer; a member can, and members survive this.
  const inner = String(text).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
  const union = splitTopLevel(inner, "|");
  if (union.length > 1) return union.map(normaliseType).sort().join(" | ");
  const object = /^\{([\s\S]*)\}$/.exec(inner);
  if (object !== null) {
    const members = splitTopLevel(object[1], ";").map((member) => member.trim()).sort();
    return `{ ${members.join("; ")} }`;
  }
  // **And inside a generic**, which is where the real ones live: the union that reshuffled was
  // `MdyWidgetDefinition<"errors" | "root" | …>`, so a normalisation that only reached the top level
  // left every reported case exactly as it found it. The first version of this did, and passed six of
  // seven invented examples while covering none of the four hundred real ones.
  const generic = /^([\w$.]+)\s*<([\s\S]*)>$/.exec(inner);
  if (generic !== null) {
    const args = splitTopLevel(generic[2], ",").map(normaliseType);
    return `${generic[1]}<${args.join(", ")}>`;
  }
  return inner;
}


/**
 * The newest modification time under a directory, or 0 where there is nothing to read.
 *
 * Used to answer one question — is the artifact this audit reads older than the source it was built
 * from — so it walks for a maximum rather than collecting anything.
 */
function newestUnder(dir) {
  if (!existsSync(dir)) return 0;
  let newest = 0;
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else newest = Math.max(newest, statSync(full).mtimeMs);
    }
  };
  walk(dir);
  return newest;
}

/**
 * A built artifact older than its own source measures the past.
 *
 * This audit compares declarations, and for a package that emits them through a build it reads the
 * build. Nothing in the suite that runs this rebuilds them, so a package whose `dist/` was written
 * weeks ago is compared against itself and reported unchanged — the exact answer a consumer would
 * get from a gate that had not run at all, delivered with a gate's authority. Three weeks of one
 * package's public surface went unwatched that way, including a removed member.
 *
 * Refused rather than rebuilt: building here would make an audit that reads a tree also write one,
 * and the command that repairs it belongs to whoever runs the audit.
 */
function refuseStaleArtifacts() {
  const stale = [];
  for (const pkg of PACKAGES) {
    const dist = resolve(ROOT, `packages/${pkg}/dist`);
    if (!existsSync(resolve(dist, "package.json"))) continue;
    const source = newestUnder(resolve(ROOT, `packages/${pkg}/src`));
    const built = newestUnder(dist);
    if (source > built) stale.push({ pkg, behindBy: source - built });
  }
  if (stale.length === 0) return;
  console.error("\nSTALE BUILD — this audit reads declarations that are older than their source.\n");
  for (const { pkg, behindBy } of stale) {
    const days = behindBy / 86_400_000;
    const how = days >= 1 ? `${Math.round(days)} day(s)` : "less than a day";
    console.error(`  packages/${pkg}/dist is ${how} behind packages/${pkg}/src`);
  }
  console.error("\nRebuild the package, then run this again. Comparing a stale build reports"
    + "\n\"unchanged\" for changes it cannot see.\n");
  process.exit(1);
}

function publicNames() {
  refuseStaleArtifacts();
  const reachable = new Set();
  for (const pkg of PACKAGES) {
    // A package that builds into `dist/` publishes a manifest there, and that one is the truth about
    // what a consumer imports: the source manifest's paths are relative to the package root and the
    // built files are not. `@modyra/angular` is built by ng-packagr and is the reason this matters —
    // its every entry was skipped in silence, so nothing Angular exports was ever compared against
    // anything, and a rename of a component member no gate could see was a consumer's build breaking.
    const builtManifest = resolve(ROOT, `packages/${pkg}/dist/package.json`);
    const usingDist = existsSync(builtManifest);
    const base = usingDist ? `packages/${pkg}/dist` : `packages/${pkg}`;
    const manifest = JSON.parse(readFileSync(usingDist ? builtManifest : resolve(ROOT, `packages/${pkg}/package.json`), "utf8"));
    const entries = [];
    for (const target of Object.values(manifest.exports ?? {})) {
      // `types` first where a manifest states it, because a declaration is what this audit reads and a
      // package is entitled to put it somewhere its runtime entry does not imply.
      const declared = typeof target === "object" && target !== null ? target.types : undefined;
      const js = typeof target === "string" ? target : (target.import ?? target.default ?? "");
      // `.mjs` as well as `.js`. Skipping it was not a decision: the check was written for packages
      // that emit `.js` and quietly excluded every one that does not.
      const guess = /\.m?js$/.test(String(js)) ? String(js).replace(/\.m?js$/, ".d.ts") : "";
      for (const candidate of [declared, guess]) {
        if (!candidate) continue;
        const declaration = resolve(ROOT, base, String(candidate));
        if (existsSync(declaration)) { entries.push(declaration); break; }
      }
    }
    if (entries.length === 0) continue;
    const program = ts.createProgram(entries, { allowJs: false, noResolve: false });
    const checker = program.getTypeChecker();
    for (const entry of entries) {
      const source = program.getSourceFile(entry);
      if (!source) continue;
      const symbol = checker.getSymbolAtLocation(source);
      if (!symbol) continue;
      for (const exported of checker.getExportsOfModule(symbol)) reachable.add(exported.getName());
    }
  }
  return reachable;
}

const PUBLIC = publicNames();

function declarationFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(".d.ts")) out.push(full);
    }
  };
  walk(dir);
  return out;
}

const ENTRIES = PACKAGE_DIRS.flatMap((dir, index) => {
  const pkg = PACKAGES[index];
  const full = resolve(ROOT, dir);
  if (!existsSync(full)) {
    console.error(`Missing ${dir} — build the packages first.`);
    process.exit(2);
  }
  return declarationFiles(full).map((file) => ({ pkg, file: relative(ROOT, file) }));
});

/**
 * Every member a consumer can read off a type: its name, whether they may omit it, and the type it
 * is declared with.
 *
 * The type is recorded as its written text with whitespace collapsed, not as a resolved type. That
 * is a deliberate limit and it cuts both ways: renaming an alias without changing what it means
 * reports as a change, and two spellings of one type are two entries. The alternative is a full type
 * checker over the emitted declarations, which resolves both — and would make this audit depend on
 * the resolution behaviour it exists to observe from outside.
 *
 * A member with no annotation records `(inferred)`. Recording nothing there would make a member that
 * loses its annotation look unchanged.
 */
function membersOf(node) {
  const members = [];
  for (const member of node.members ?? []) {
    const name = member.name && ts.isIdentifier(member.name)
      ? member.name.text
      : member.name?.getText?.();
    if (!name) continue;
    const type = member.type?.getText?.().replace(/\s+/g, " ").trim() ?? "(inferred)";
    members.push(`${name}${member.questionToken ? "?" : ""}: ${type}`);
  }
  return members.sort();
}

/**
 * The literal members of a union alias, sorted. A union that is not made of literals — a union of
 * object types, or an alias of another type entirely — records `["(opaque)"]`: enough for the alias
 * being withdrawn to fail, and no claim about what is inside it.
 */
/** One line, single spaces: a declaration reflowed by a printer is not a changed declaration. */
function normaliseSpacing(text) {
  return text.replace(/\s+/g, " ").trim();
}

function unionMembersOf(type, sourceFile) {
  // `(typeof SOME_TUPLE)[number]` — a union derived from the array that declares it rather than
  // written out beside it. Read as syntax it is an indexed access and nothing else, so the members
  // read as removed the moment a union stops being spelled twice, which is the opposite of what the
  // change did. Resolved here from the tuple in the same file: the members are right there.
  if (ts.isIndexedAccessTypeNode(type) && type.indexType?.kind === ts.SyntaxKind.NumberKeyword) {
    // The parentheses in `(typeof X)[number]` are a node of their own, and they are not optional in
    // the emitted declaration — indexing an unparenthesised `typeof` does not parse.
    const object = ts.isParenthesizedTypeNode(type.objectType) ? type.objectType.type : type.objectType;
    if (ts.isTypeQueryNode(object)) {
      const members = tupleMembersNamed(object.exprName.getText?.(), sourceFile);
      if (members) return members;
    }
  }
  // A union narrowed to one member stops being a union node. Recording it as a single literal keeps
  // the last step of a narrowing readable as what it is, rather than as the alias going opaque.
  if (ts.isLiteralTypeNode(type)) return [type.literal.getText?.() ?? String(type.literal.text)];
  // An alias of one named type records what it points at. `(opaque)` would say only that the alias
  // still exists, and re-pointing it at something else is the change most worth seeing.
  if (ts.isTypeReferenceNode(type)) return [`-> ${type.typeName.getText?.() ?? "(unnamed)"}`];
  if (!ts.isUnionTypeNode(type)) return ["(opaque)"];
  const members = [];
  for (const member of type.types) {
    if (ts.isLiteralTypeNode(member)) {
      members.push(member.literal.getText?.() ?? String(member.literal.text));
      continue;
    }
    // An arm that is not a literal is recorded as its own text rather than collapsing the whole
    // union to `(opaque)`.
    //
    // Collapsing lost everything: `MdyMultiselectOverlayAction` was stored as the single string
    // "(opaque)", so a variant added to it compared "(opaque)" against "(opaque)" and passed without
    // a line — and so would a variant **removed**, which is major. Seventy-seven exported types were
    // recorded that way. The text of an arm is not a resolved type and this does not pretend it is:
    // it is what a reader of the `.d.ts` sees, which is the standard the rest of this file holds to.
    const text = normaliseSpacing(member.getText?.() ?? "(unreadable)");
    // Keyed by its discriminant, because the comparison splits an entry at its first `": "` and an
    // arm carries colons of its own — recorded raw, `{ readonly type: "step"; … }` became the member
    // *name* `{ readonly type`, and the rest became its type.
    //
    // The discriminant is what a consumer switches on, so it is also the identity that matters: an
    // arm whose shape changes under the same discriminant is a retype, an arm that disappears is a
    // removal. Where there is none, the member names stand in — stable under reordering, which the
    // text is not.
    const discriminant = text.match(/\btype\s*:\s*("[^"]*"|'[^']*')/)?.[1];
    const shape = [...text.matchAll(/(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??\s*:/g)].map(([, key]) => key).sort();
    const key = discriminant !== undefined
      ? `variant ${discriminant}`
      : `variant of ${shape.join("+") || "an unnamed shape"}`;
    members.push(`${key}: ${text}`);
  }
  return members.sort();
}

/**
 * The literals in `export const NAME = [...] as const`, or null when there is no such tuple.
 *
 * Syntax again, deliberately: this audit reads declarations rather than asking the checker, so that
 * what it records is what a reader of the `.d.ts` sees. The tuple is in the same file as the alias
 * that indexes it, because that is the only form this resolves.
 */
function tupleMembersNamed(name, sourceFile) {
  if (!name || !sourceFile) return null;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText?.() !== name) continue;
      // `readonly [...]` is an operator wrapping the tuple, and every `as const` array declares one.
      const declared = declaration.type;
      const type = declared && ts.isTypeOperatorNode(declared) ? declared.type : declared;
      if (!type || !ts.isTupleTypeNode(type)) return null;
      const members = [];
      for (const member of type.elements) {
        if (!ts.isLiteralTypeNode(member)) return null;
        members.push(member.literal.getText?.() ?? String(member.literal.text));
      }
      return members.sort();
    }
  }
  return null;
}

/**
 * A class's members, from outside.
 *
 * Classes were outside this audit entirely: it walked interfaces, type aliases and functions, so
 * `MdyTypedForm`'s thirty-odd methods, `MdyFormEngine`'s and every error class's were under no
 * classification at all. Adding, renaming or removing one of them reported `patch`, which is
 * finding K's shape one level further out than the unions were.
 *
 * A method records its signature rather than its name, for the reason `signatureOf` gives: a method
 * that gains a required parameter breaks every caller and would otherwise read as unchanged.
 *
 * `protected` is recorded and marked. A plain consumer never sees one, but `MdyTypedFormBase` is
 * built to be extended and an adapter that extends it depends on those members exactly as a
 * consumer depends on a public one — while the mark keeps the two readable apart in a diff.
 */
function classMembersOf(node) {
  const members = [];
  for (const member of node.members ?? []) {
    const modifiers = member.modifiers ?? [];
    if (modifiers.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword)) continue;
    // `#name` is private at the language level and never reaches a declaration a consumer reads.
    if (member.name && ts.isPrivateIdentifier(member.name)) continue;
    if (ts.isConstructorDeclaration(member)) {
      members.push(`constructor${signatureOf(member)}`);
      continue;
    }
    const name = member.name && ts.isIdentifier(member.name)
      ? member.name.text
      : member.name?.getText?.();
    if (!name) continue;
    const scope = modifiers.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword) ? "protected " : "";
    if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      members.push(`${scope}${name}${signatureOf(member)}`);
      continue;
    }
    const type = member.type?.getText?.().replace(/\s+/g, " ").trim() ?? "(inferred)";
    members.push(`${scope}${name}${member.questionToken ? "?" : ""}: ${type}`);
  }
  return members.sort();
}

/**
 * A recorded entry back into name, optionality and declared type.
 *
 * Entries come in two shapes, because two kinds of thing are recorded: `name?: type` for a member of
 * an interface or type literal, and a bare literal such as `"single"` for a member of a union. The
 * second has no declared type of its own, which is what `null` means here — not "unknown".
 */
/**
 * A member the Angular compiler emitted about a class, rather than a member of it.
 *
 * `ɵcmp`, `ɵfac`, `ɵdir` and `ɵprov` are Angular's own marker for *not public API* — the framework
 * prefixes them so that nobody reaches for them, and nobody does. They are a mirror of the class's
 * real surface: `MdyCalendarCellComponent.ɵcmp` restates every input the class already declares by
 * name, so **comparing them says a second time what the public members already say**.
 *
 * That duplication is not free. Adding one optional input rewrote a whole `ɵcmp` declaration and the
 * differ reported it `major` — four of those in one batch, every one additive, and the same input was
 * *also* reported once, correctly, as `cellId was added (optional)`. A hundred and twenty-two of these
 * sit in the surface, and every Angular change churns the ones it touches.
 *
 * They are skipped on both sides rather than removed from the baseline, so no baseline is rewritten to
 * make this true — a rewrite would bake in whatever else is uncommitted at that moment, which is a
 * mistake this audit has already been used to make once.
 */
const isCompilerArtefact = (name) => name.startsWith("\u03B5") || name.startsWith("ɵ");

function parseMembers(entries) {
  const parsed = new Map();
  for (const entry of entries) {
    if (isCompilerArtefact(entry)) continue;
    const split = entry.indexOf(": ");
    if (split === -1) {
      parsed.set(entry, { optional: false, type: null });
      continue;
    }
    const head = entry.slice(0, split);
    const optional = head.endsWith("?");
    parsed.set(optional ? head.slice(0, -1) : head, { optional, type: entry.slice(split + 2) });
  }
  return parsed;
}

/**
 * A function's public shape: each parameter, and what it returns.
 *
 * Recorded as written text for the same reason members are — see `membersOf`. A parameter is keyed by
 * its position as well as its name, because renaming a parameter breaks nobody while reordering two
 * of the same type breaks every caller silently, and keying by name alone cannot tell those apart.
 */
function signatureOf(node) {
  const entries = node.parameters.map((parameter, index) => {
    const name = parameter.name?.getText?.() ?? `arg${index}`;
    const optional = parameter.questionToken || parameter.initializer ? "?" : "";
    const type = parameter.type?.getText?.().replace(/\s+/g, " ").trim() ?? "(inferred)";
    return `(${index}) ${name}${optional}: ${type}`;
  });
  const returns = node.type?.getText?.().replace(/\s+/g, " ").trim() ?? "(inferred)";
  entries.push(`-> returns: ${returns}`);
  return entries;
}

const surface = {};
const classNames = new Set();
for (const { pkg, file: entry } of ENTRIES) {
  const file = resolve(ROOT, entry);
  if (!existsSync(file)) {
    console.error(`Missing ${entry} — build the packages first.`);
    process.exit(2);
  }
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

  // Names a file exports through a grouped statement rather than a modifier.
  //
  // A bundler that flattens a package writes `declare class X {}` and then one `export { X, Y, Z }` at
  // the end — ng-packagr does, so every `@modyra/angular` declaration carries no `export` keyword and
  // this audit saw none of them. The count said "839 public names, 638 shapes", and the 201 it could
  // not shape were the whole Angular surface: found, dropped, and reported as a number that looked
  // like coverage.
  const grouped = new Set();
  ts.forEachChild(source, (node) => {
    if (!ts.isExportDeclaration(node) || node.moduleSpecifier !== undefined) return;
    const clause = node.exportClause;
    if (clause === undefined || !ts.isNamedExports(clause)) return;
    for (const element of clause.elements) grouped.add((element.propertyName ?? element.name).text);
  });

  const visit = (node) => {
    const exported = (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      || grouped.has(node.name?.text ?? "\u0000"))
      // Exported from its module *and* published by an entry. A module's own `export` keyword says
      // the package can use it across files; the `exports` map says a consumer can have it.
      && PUBLIC.has(node.name?.text ?? "");
    if (exported && ts.isInterfaceDeclaration(node)) {
      surface[`${pkg}:${node.name.text}`] = membersOf(node);
    } else if (exported && ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      surface[`${pkg}:${node.name.text}`] = membersOf(node.type);
    } else if (exported && ts.isTypeAliasDeclaration(node)) {
      // A union of literals is a public surface a consumer switches on, and withdrawing one of its
      // members — or the alias itself — is exactly as breaking as removing an interface member.
      // Reading only interfaces and type literals left every such union outside classification,
      // which is finding K's shape one level down: the audit reported a number that looked like
      // coverage. Anything that is not a union of literals is recorded as present but opaque, so
      // its disappearance is still caught while its contents make no claim.
      surface[`${pkg}:${node.name.text}`] = unionMembersOf(node.type, node.getSourceFile());
    } else if (exported && ts.isClassDeclaration(node) && node.name) {
      surface[`${pkg}:${node.name.text}`] = classMembersOf(node);
      classNames.add(`${pkg}:${node.name.text}`);
    } else if (ts.isVariableStatement(node)
      && node.declarationList.declarations.some((one) => ts.isIdentifier(one.name) && PUBLIC.has(one.name.text))) {
      // **An exported constant is public surface and no index held it.** This scan recorded
      // interfaces, aliases, classes and functions, so a `export const` could enter the published
      // surface and leave it again with nothing reporting either: `test:type-surface` said
      // UNCHANGED because it compares *types*, and `contract:diff` looks at the widget contract's
      // parts. The only thing naming such a name was a changeset written by hand — discipline
      // rather than a gate.
      //
      // What is recorded is the declared type where the declaration carries one, and the fact of the
      // name where it does not. A constant's *value* is deliberately not recorded: a number that
      // changes is not a surface change, and a baseline that moved on every tuned threshold would be
      // re-accepted without reading, which is how a diff stops being read at all.
      for (const one of node.declarationList.declarations) {
        if (!ts.isIdentifier(one.name) || !PUBLIC.has(one.name.text)) continue;
        // **The type is a value to compare, not part of the member's name.** Written `const-> T` it
        // carried no `": "`, so the whole string became the member key — and renaming a type *inside*
        // the declaration made the old key vanish and a new one appear: one type change reported as a
        // removal and an addition, of a key nobody can read, classified major twice. Written `const: T`
        // it parses the way every other member does, so the same change reads as what it is.
        surface[`${pkg}:${one.name.text}`] = [
          `const: ${one.type ? one.type.getText(source) : "(inferred)"}`,
        ];
      }
    } else if (exported && ts.isFunctionDeclaration(node) && node.name) {
      // A function is public surface too, and the projections made that concrete: each returns an
      // inline type literal naming which parts it hands back, so "which parts does this projection
      // return" was a fact the declarations already carried and nothing read. Withdrawing one, or
      // changing what a renderer receives, classified as patch.
      surface[`${pkg}:${node.name.text}`] = signatureOf(node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
}

/**
 * Which recorded shapes are classes.
 *
 * Derived from the current declarations rather than stored in the baseline: the baseline is a flat
 * map of names to members, and the distinction only matters when comparing, where the current
 * surface is in hand anyway.
 */
const names = Object.keys(surface).sort();
const current = Object.fromEntries(names.map((name) => [name, surface[name]]));

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Type surface written: ${relative(ROOT, BASELINE)} — ${names.length} shapes reachable from a declared entry (of ${PUBLIC.size} public names).`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`No baseline at ${relative(ROOT, BASELINE)} — run with --write to record it.`);
  process.exit(1);
}

/**
 * Which recorded surface this run is judged against.
 *
 * Without `--since` it is the committed baseline, and the question that answers is *did somebody
 * forget to record a change* — useful, and not the question everybody asks. Comparing against the
 * working baseline can only ever catch an edit that skipped the update: once the baseline is
 * accepted the two agree again and the change is invisible.
 *
 * `--since <ref>` reads the baseline as it stood at a ref, which is the only way to answer *what
 * changed since the release*. `contract-diff.mjs` learned this first and for the same reason; a tool
 * that cannot be asked it will be asked it anyway, and will answer something else.
 */
const sinceFlag = process.argv.indexOf("--since");
const since = sinceFlag === -1 ? null : process.argv[sinceFlag + 1];
if (sinceFlag !== -1 && (since === undefined || since.startsWith("--"))) {
  console.error("audit-type-surface: --since needs a git ref");
  process.exit(2);
}

const baselinePath = relative(ROOT, BASELINE);
let baseline;
if (since === null) {
  baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
} else {
  try {
    // git's own complaint is suppressed: it names the object and not the question, and two errors
    // for one cause send the reader to the wrong one.
    baseline = JSON.parse(execFileSync("git", ["show", `${since}:${baselinePath}`],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    console.error(`audit-type-surface: no ${baselinePath} at ${since}`);
    process.exit(2);
  }
  console.log(`Compared against the surface recorded at ${since}.`);
}
const changes = [];

for (const name of Object.keys(baseline)) {
  if (!(name in current)) {
    changes.push(["major", `${name} is no longer exported`]);
    continue;
  }
  const was = parseMembers(baseline[name]);
  const now = parseMembers(current[name]);

  // A type the baseline recorded as `(opaque)` and this run reads as members has not changed: the
  // snapshot learned to look inside it. Reporting that as a removal plus a dozen additions describes
  // the instrument and reads as a contract change — and the verdict travels into a changeset, where
  // nobody can tell afterwards. It is the one moment the tool knows it is the cause, so it says so.
  const wasOpaque = was.size === 1 && was.has("(opaque)");
  if (wasOpaque && now.size > 0 && !now.has("(opaque)")) {
    changes.push(["minor", `${name}: ${now.size} member(s) now recorded — new to this snapshot, not to the type`]);
    continue;
  }

  for (const [member, before] of was) {
    const after = now.get(member);
    if (!after) {
      changes.push(["major", `${name}.${member} was removed`]);
      continue;
    }
    // Optionality and type are separate losses and are reported separately: a member that both
    // became required and changed type is two facts, and collapsing them hides one.
    if (before.optional && !after.optional) changes.push(["major", `${name}.${member} is now required`]);
    if (!before.optional && after.optional) changes.push(["minor", `${name}.${member} is now optional`]);
    // Compared after normalising order, so the same members in a different sequence are the same type.
    if (normaliseType(before.type) !== normaliseType(after.type)) {
      // Two object-literal types are compared by their members, because that is what a consumer
      // reads. Keys gained break nobody; keys lost or retyped break everyone who read them.
      const wasMembers = objectMembers(before.type);
      const nowMembers = objectMembers(after.type);
      if (wasMembers && nowMembers) {
        const gone = [...wasMembers.keys()].filter((key) => !nowMembers.has(key));
        const retyped = [...wasMembers.entries()]
          .filter(([key, type]) => nowMembers.has(key) && normaliseType(nowMembers.get(key)) !== normaliseType(type))
          .map(([key]) => key);
        const gained = [...nowMembers.keys()].filter((key) => !wasMembers.has(key));
        if (gone.length > 0 || retyped.length > 0) {
          changes.push(["major", `${name}.${member} lost or retyped ${[...gone, ...retyped].join(", ")}`
            + ` — is now \`${after.type}\`, was \`${before.type}\``]);
        } else if (gained.length > 0) {
          changes.push(["minor", `${name}.${member} gained ${gained.join(", ")}`]);
        }
        continue;
      }
      changes.push(["major", `${name}.${member} is now \`${after.type}\`, was \`${before.type}\``]);
    }
  }
  for (const [member, after] of now) {
    if (was.has(member)) continue;
    // A member appearing on a class is additive: nobody implements `MdyFormEngine`, so a new method
    // breaks no caller. On an interface it is not — a consumer implements one, and a required member
    // appearing means their implementation no longer satisfies it.
    //
    // A method whose signature grew is not this case: the signature is part of the recorded name, so
    // it reads as one member removed and another added, and the removal is already major. That is
    // the half that breaks a caller, and it stays reported as such.
    const additive = classNames.has(name) || after.optional;
    changes.push([
      additive ? "minor" : "major",
      `${name}.${member} was added${after.optional ? " (optional)" : classNames.has(name) ? "" : " (required)"}`,
    ]);
  }
}
for (const name of Object.keys(current)) {
  if (!(name in baseline)) changes.push(["minor", `${name} is newly exported`]);
}

console.log(`Exported shapes compared: ${names.length}`);
if (changes.length === 0) {
  console.log("TYPE SURFACE UNCHANGED");
  process.exit(0);
}

const major = changes.filter(([level]) => level === "major");
for (const [level, what] of changes) console.log(`  ${what}  [${level}]`);
console.log(`\nclassification: ${major.length > 0 ? "major" : "minor"}`);
console.log("TYPE SURFACE MOVED — review the classification above, then accept it with --write.");
process.exit(1);
