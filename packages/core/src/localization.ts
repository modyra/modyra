/**
 * The words a form shows, and the locale rules behind them.
 *
 * One door for one domain. `./i18n` published the same seven message tables from a second path, and
 * `buildDateLocale` was reachable from here and from `./datetime` — a symbol with two doors is a
 * symbol a reader has to check twice to be sure they are the same thing.
 *
 * Dates live in `./datetime`, which is where the calendar that reads a locale also lives.
 */
export * from "./i18n.js";
