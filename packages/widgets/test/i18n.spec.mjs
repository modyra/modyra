/**
 * Which words a locale gets, decided once.
 *
 * The tables had one consumer while they sat in the engine, and the two renderers that could not
 * reach them wrote their own English instead — three spellings of one button. A resolver is what
 * stops the next renderer inventing a fourth, so it is asserted rather than assumed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_I18N_DEFAULT_TAGS,
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_I18N_PRESETS,
  messagesForLocale,
} from "../dist/index.js";

test("a region does not change what a button says", () => {
  for (const [locale, tag] of Object.entries(MDY_I18N_DEFAULT_TAGS)) {
    assert.equal(messagesForLocale(tag), MDY_I18N_PRESETS[locale], `${tag} should resolve to ${locale}`);
    assert.equal(messagesForLocale(locale), MDY_I18N_PRESETS[locale], "the bare subtag resolves too");
  }
  assert.equal(messagesForLocale("IT-it"), MDY_I18N_PRESETS.it, "a tag is matched case-insensitively");
});

test("an unknown or absent tag answers in English, never in blanks", () => {
  for (const tag of ["pt-BR", "zz", "", undefined, null]) {
    assert.equal(messagesForLocale(tag), MDY_I18N_MESSAGES_DEFAULT, `${tag} should fall back`);
  }
});

test("every preset answers every message the default declares", () => {
  // A table missing a key would render `undefined` where a word belongs, and only in that language.
  for (const [locale, messages] of Object.entries(MDY_I18N_PRESETS)) {
    for (const [key, fallback] of Object.entries(MDY_I18N_MESSAGES_DEFAULT)) {
      assert.equal(typeof messages[key], typeof fallback, `${locale} is missing ${key}`);
      if (typeof fallback === "string") {
        assert.ok(messages[key].length > 0, `${locale}.${key} is empty`);
      }
    }
  }
});
