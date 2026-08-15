/**
 * Five languages a widget speaks, and the key that only four of them learn.
 *
 * The locale coverage matrix promises built-in UI strings for en, it, de, fr and es, and the widgets
 * publish one table each. Every string a control shows that is not the application's own comes from
 * there: a picker's Cancel, a search box's placeholder, the word for an empty result.
 *
 * A missing key is the quiet kind of regression. Adding a message to the default table and to the
 * component that shows it makes a feature work in development, in English, and ships four languages
 * showing an English word — or `undefined`, depending on how the lookup is written. Nothing fails,
 * nothing warns, and the only way to see it is to run the form in a language nobody on the team
 * reads.
 *
 * So the tables are compared as sets rather than checked one by one: whatever the default knows,
 * every declared language knows. A string that is legitimately the same word in two languages is
 * left alone — `OK` is `OK` in all five, `Minute` is German and French as well as English — because
 * a battle that demanded difference would demand a wrong translation.
 *
 * `messagesForLocale` is pinned alongside them: a region falls back to its language, and anything
 * unknown falls back to the default rather than to nothing.
 */

import {
  MDY_I18N_DEFAULT_TAGS,
  MDY_I18N_MESSAGES_DE,
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_I18N_MESSAGES_ES,
  MDY_I18N_MESSAGES_FR,
  MDY_I18N_MESSAGES_IT,
  messagesForLocale,
} from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The published table for each language the matrix promises. */
const TABLES = Object.freeze({
  en: MDY_I18N_MESSAGES_DEFAULT,
  it: MDY_I18N_MESSAGES_IT,
  de: MDY_I18N_MESSAGES_DE,
  fr: MDY_I18N_MESSAGES_FR,
  es: MDY_I18N_MESSAGES_ES,
});

/**
 * Argument shapes a parameterised message might take.
 *
 * The parts a caller supplies are already in the reader's language — a month name, a word they typed,
 * the files a field turned away — so any placeholder does. What varies is the *shape*: one string,
 * two, a list of them. Rather than keep a table of which key takes which, the shapes are tried in
 * order and the first that renders is the one every language is then held to.
 *
 * That is the stronger property. A table would have to be edited each time a message gains an
 * argument, and the edit is exactly what nobody does — this battle went red when `fileRejected`
 * arrived taking a list, because it assumed one string forever.
 */
const ARGUMENT_SHAPES = Object.freeze([["one"], ["one", "two"], [["one"]], [["one", "two"]], [1], [1, 2]]);

/**
 * What a message shows for a given argument shape, or `null` when it shows nothing.
 */
function renderedWith(message, argument) {
  if (typeof message === "string") return message.trim() === "" ? null : message;
  if (typeof message !== "function") return null;
  try {
    const shown = message(...argument);
    return typeof shown === "string" && shown.trim() !== "" ? shown : null;
  } catch {
    return null;
  }
}

/** The first shape that makes `message` say something, or `null` when none does. */
function shapeThatWorks(message) {
  if (typeof message === "string") return message.trim() === "" ? null : [];
  return ARGUMENT_SHAPES.find((shape) => renderedWith(message, shape) !== null) ?? null;
}

battle(
  {
    claims: ["LOC-002", "A11Y-002"],
    title: "every language knows every word the default knows",
    environments: ["node"],
  },
  async (ctx) => {
    // The languages are taken from what the widgets declare, so a sixth one added later is held to
    // the same completeness without this battle being edited.
    const declared = Object.keys(MDY_I18N_DEFAULT_TAGS);
    ctx.log.note("languages the widgets declare", { declared, tables: Object.keys(TABLES) });

    expectEqual([...declared].sort(), Object.keys(TABLES).sort(), {
      claimIds: ["LOC-002"],
      what: "the declared languages and the tables this battle holds have drifted apart",
    });

    const expected = Object.keys(TABLES.en).sort();

    expectClaim(expected.length > 0, {
      claimIds: ["LOC-002"],
      what: "the default table is empty, so completeness below means nothing",
    });

    for (const [tag, table] of Object.entries(TABLES)) {
      expectEqual(Object.keys(table).sort(), expected, {
        claimIds: ["LOC-002", "A11Y-002"],
        what: `the ${tag} table does not hold the same keys as the default, so a control shows nothing where it holds nothing`,
      });

      // A key present and empty is the same silence with a different shape. Some messages take
      // parameters — a month already in the reader's language, a typed word, the files a field turned
      // away — so those are rendered rather than read, with the shape the default table established.
      const blank = Object.entries(table)
        .filter(([key, message]) => {
          const shape = shapeThatWorks(TABLES.en[key]);
          return shape === null || renderedWith(message, shape) === null;
        })
        .map(([key]) => key);

      expectEqual(blank, [], {
        claimIds: ["A11Y-002"],
        what: `the ${tag} table holds a message that renders to nothing for the arguments its own default takes, so a control built from it is unlabelled`,
      });
    }
  },
);

battle(
  {
    claims: ["LOC-002"],
    title: "a locale nobody translated falls back to one somebody did",
    environments: ["node"],
  },
  async (ctx) => {
    /** Which table `messagesForLocale` answered with, identified by a message rather than by identity. */
    const chosen = (tag) => {
      const messages = messagesForLocale(tag);
      return Object.entries(TABLES).find(([, table]) => table.noResults === messages.noResults)?.[0] ?? null;
    };

    for (const [tag, language] of [
      ["it-IT", "it"],
      ["de-AT", "de"],
      ["fr-CA", "fr"],
      ["pt-BR", "en"],
      ["zz", "en"],
      ["", "en"],
      [null, "en"],
      [undefined, "en"],
    ]) {
      const answered = chosen(tag);
      ctx.log.note("a locale asked for its words", { tag, answered });

      expectEqual(answered, language, {
        claimIds: ["LOC-002"],
        what: `${JSON.stringify(tag)} was answered with the ${answered} table`,
      });
    }

    // The control: a locale that is translated is not answered with the default, so the fallbacks
    // above are a choice rather than one table for everybody.
    expectClaim(messagesForLocale("it").noResults !== TABLES.en.noResults, {
      claimIds: ["LOC-002"],
      what: "a translated locale was answered with the default table",
    });
  },
);
