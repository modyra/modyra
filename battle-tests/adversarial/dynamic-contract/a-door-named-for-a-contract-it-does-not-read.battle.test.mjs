/**
 * An adapter that publishes a door named for the dynamic contract, and never opens it.
 *
 * H-1 of `charter/fable5-hunts.md`, red by construction: the work order names the missing
 * capability, and this is the pin that turns green when it lands.
 *
 * The document path is `parseDynamicForm` → `buildDynamicFormSchema` → `applyDynamicRules`. Two
 * adapters walk it, and one of them advertises a door for it and does not:
 *
 *   @modyra/react    publishes useMdyDynamicForm       names the path 4 times
 *   @modyra/plain    publishes mountMdyForm            names the path 3 times
 *   @modyra/angular  publishes MdyDynamicFormComponent names it 0 times
 *   lit, vue, svelte, solid, preact                    publish no such door, name it 0 times
 *
 * The five silent adapters are not in question: an adapter that promises nothing about documents
 * owes nothing. What `MdyDynamicFormComponent` promises is in its name, and what it takes is a
 * `[fields]` input already parsed and already typed — so the host is left holding the untrusted
 * half. `mdy-dynamic-form.component.ts:279` takes `layout` the same way, pre-parsed, which is why
 * `ai-generated-forms.md` can truthfully say layout *is* applied by `@modyra/angular` while the
 * path that produces it lives somewhere else.
 *
 * The cost is the one the charter names: two renderers consume a server's document and one cannot,
 * so an application that renders the same contract on both has to write the parse step twice — once
 * as `mountMdyForm(container, result.fields, …)` and once by hand, with the strict-mode diagnostics
 * and the refusal of a partial form as the part most easily forgotten.
 *
 * The assertion guesses nothing about the API that will close it. It asks only that an adapter
 * naming the contract in its published surface also reads it, which any shape of `[contract]` input
 * satisfies.
 *
 * @source-inspection — whether a package *names* a function is a fact about its sources. Angular's
 * published bundle cannot be imported here at all (its JIT compiler runs before any test gets a
 * say), and a door that does not exist is indistinguishable from one that exists and is unused when
 * seen from outside.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const PACKAGES = resolve(HERE, "..", "..", "..", "packages");

const ADAPTERS = Object.freeze(["plain", "react", "angular", "lit", "vue", "svelte", "solid", "preact"]);

/** The three functions that turn an untrusted document into a running form. */
const DOCUMENT_PATH = Object.freeze(["parseDynamicForm", "buildDynamicFormSchema", "applyDynamicRules"]);

/** A door is published when a package exports a name that says "dynamic form". */
const PUBLISHES_A_DOOR = /export\s+(?:class|function|const)\s+[A-Za-z]*[Dd]ynamic[A-Za-z]*/;

function sourcesOf(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourcesOf(path, out);
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

function surveyOf(adapter) {
  const files = sourcesOf(join(PACKAGES, adapter, "src"));
  const text = files.map((file) => readFileSync(file, "utf8")).join("\n");
  return {
    adapter,
    files: files.length,
    publishesADoor: PUBLISHES_A_DOOR.test(text),
    readsTheContract: DOCUMENT_PATH.some((name) => text.includes(name)),
  };
}

battle(
  {
    claims: ["ADP-001", "DYN-001"],
    title: "an adapter that publishes a dynamic-form door reads the dynamic contract",
    environments: ["node"],
  },
  async (ctx) => {
    const survey = ADAPTERS.map(surveyOf);
    ctx.log.note("which adapters publish a door, and which read the contract behind it", survey);

    // The instrument, three ways: the walk found real files, at least one adapter publishes a door,
    // and at least one reads the contract. Without these, "the two agree" would be a statement about
    // a walk that read nothing.
    expectClaim(
      survey.every((row) => row.files > 0) &&
        survey.some((row) => row.publishesADoor) &&
        survey.some((row) => row.readsTheContract),
      {
        claimIds: ["ADP-001"],
        what: "the source walk found nothing, or no adapter does either half, so an empty result below is the walk rather than the adapters",
        detail: JSON.stringify(survey),
      },
    );

    expectEqual(
      survey.filter((row) => row.publishesADoor && !row.readsTheContract).map((row) => row.adapter),
      [],
      {
        claimIds: ["ADP-001", "DYN-001"],
        what: "an adapter publishes a door named for the dynamic contract and never reads it, so an application rendering one server document on two adapters writes the parse step twice",
      },
    );
  },
);
