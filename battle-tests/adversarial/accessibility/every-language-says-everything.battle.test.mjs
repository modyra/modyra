/**
 * A control's words, in every language the package ships.
 *
 * `MDY_I18N_MESSAGES_DEFAULT` and its four siblings are what a widget shows when it has to speak:
 * the confirm button of a picker, the label of a minute field, the announcement a screen reader
 * reads. They are plain tables, and the way they go wrong is the way tables always go wrong — a
 * message is added to the default and one language does not get it.
 *
 * The failure is quiet and it lands on the people least able to work around it: a key missing from
 * `it` is a control that renders nothing where a word should be, for Italian users only, and nothing
 * in a build objects. So the property is parity — every table carries exactly the default's keys,
 * and every value is a string somebody could read.
 *
 * Three of the messages are functions rather than strings — a view name, an option being created, a
 * step out of a total — and those have a second way to go wrong that a key check cannot see: a
 * translation that dropped the placeholder returns "Schritt von" with no number in it. So each is
 * called and its arguments are looked for in what comes back.
 *
 * `MDY_I18N_PRESETS` is asserted against the tables rather than separately: a preset naming a
 * language whose table is not there is a locale a consumer can select and get nothing from.
 */

import {
  MDY_I18N_MESSAGES_DE,
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_I18N_MESSAGES_ES,
  MDY_I18N_MESSAGES_FR,
  MDY_I18N_MESSAGES_IT,
  MDY_I18N_PRESETS,
} from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const TABLES = Object.freeze([
  ["German", MDY_I18N_MESSAGES_DE],
  ["Spanish", MDY_I18N_MESSAGES_ES],
  ["French", MDY_I18N_MESSAGES_FR],
  ["Italian", MDY_I18N_MESSAGES_IT],
]);

const keysOf = (table) => Object.keys(table ?? {}).sort();

battle(
  {
    claims: ["A11Y-001", "LOC-002"],
    title: "every language ships every message the default ships",
    environments: ["node"],
  },
  async (ctx) => {
    const base = keysOf(MDY_I18N_MESSAGES_DEFAULT);
    ctx.log.note("the default message table", { keys: base.length });

    // The control: there is a table to compare against, and it is not empty. A default that lost
    // its keys would make every comparison below pass.
    expectClaim(base.length > 20, {
      claimIds: ["LOC-002"],
      what: "the default message table is too small to be the one the widgets use",
      detail: String(base.length),
    });

    for (const [language, table] of TABLES) {
      const keys = keysOf(table);
      const missing = base.filter((key) => !keys.includes(key));
      const extra = keys.filter((key) => !base.includes(key));
      ctx.log.note("a language table", { language, keys: keys.length, missing, extra });

      // A message the default has and a language does not is a control that says nothing, in that
      // language only.
      expectEqual(missing, [], {
        claimIds: ["A11Y-001", "LOC-002"],
        what: `${language} is missing a message the default carries`,
      });

      // And one a language has that the default does not is a message nothing will ever read: the
      // key was renamed in the default and left behind here.
      expectEqual(extra, [], {
        claimIds: ["LOC-002"],
        what: `${language} carries a message the default no longer names`,
      });

      // A message is a string or a function of its arguments, and which one it is has to match the
      // default: a language that turned a parameterised message into a bare string drops the value
      // the message exists to carry.
      const wrongKind = keys.filter((key) => typeof table[key] !== typeof MDY_I18N_MESSAGES_DEFAULT[key]);
      expectEqual(wrongKind, [], {
        claimIds: ["LOC-002"],
        what: `${language} carries a message of a different kind from the default's`,
      });

      const unreadable = keys.filter((key) => typeof table[key] === "string" && table[key].trim() === "");
      expectEqual(unreadable, [], {
        claimIds: ["A11Y-001"],
        what: `${language} carries a message that is empty`,
      });

      // And a parameterised message has to put its arguments in the sentence. A translation that
      // lost the placeholder reads "Step of" — grammatical, and missing the only thing it is for.
      const dropped = [];
      for (const key of keys) {
        const message = table[key];
        if (typeof message !== "function") continue;
        const args = Array.from({ length: message.length }, (_, index) => `arg${index}`);
        let produced;
        try {
          produced = message(...args);
        } catch (error) {
          dropped.push(`${key} threw ${error.constructor.name}`);
          continue;
        }
        if (typeof produced !== "string" || produced.trim() === "") dropped.push(`${key} produced nothing`);
        else for (const argument of args) if (!produced.includes(argument)) dropped.push(`${key} left out ${argument}`);
      }
      ctx.log.note("the parameterised messages of a language", { language, dropped });

      expectEqual(dropped, [], {
        claimIds: ["A11Y-001", "LOC-002"],
        what: `${language} has a parameterised message that does not carry what it was given`,
      });
    }

    // A preset is what a consumer selects. One naming a table that is not there is a language a
    // consumer can choose and get nothing from.
    const presets = Object.entries(MDY_I18N_PRESETS ?? {});
    ctx.log.note("the presets a consumer can choose", { names: presets.map(([name]) => name) });

    expectClaim(presets.length >= TABLES.length, {
      claimIds: ["LOC-002"],
      what: "there are fewer presets than there are message tables",
      detail: JSON.stringify(presets.map(([name]) => name)),
    });

    for (const [name, table] of presets) {
      expectEqual(keysOf(table), base, {
        claimIds: ["LOC-002", "A11Y-001"],
        what: `the preset "${name}" does not carry the messages the default names`,
      });
    }
  },
);
