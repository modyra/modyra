/**
 * A calendar begins its week where its user's locale does.
 *
 * The rule lives in `@modyra/widgets/testing` and is derived from `Intl`, so this renderer cannot
 * satisfy it by agreeing with itself. It is not part of the canonical snapshot because the
 * expectation depends on the locale rather than on the contract alone — but it is exactly the class
 * of difference Milestone C exists to catch: two renderers can disagree here while both produce a
 * well-formed, correctly-labelled grid.
 *
 * Driven through `MDY_DATE_LOCALE`, which is how a host configures this adapter's locale. Two
 * locales with opposite week starts, because one proves nothing: a renderer with the week start
 * hardcoded is correct in exactly the locale whose value it hardcoded, and a suite that only ever
 * runs there is measuring its own environment.
 */
import "@angular/compiler";
import { TestBed } from "@angular/core/testing";
import { buildDateLocale } from "@modyra/core/datetime";
import { inspectCalendarWeekStart } from "@modyra/widgets/testing";
import { MDY_DATE_LOCALE } from "../core/date-locale";
import { mountStateFixture } from "./catalog-host.spec";

describe("the calendar's first day follows the locale", () => {
  for (const locale of ["en-US", "it-IT"]) {
    for (const kind of ["datepicker", "daterange"] as const) {
      it(`${kind} starts the week where ${locale} starts it`, () => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          providers: [{ provide: MDY_DATE_LOCALE, useValue: buildDateLocale(locale) }],
        });

        const mounted = mountStateFixture(kind);
        mounted.settle?.();
        mounted.drive?.("open");
        mounted.settle?.();

        const rendered = Array.from(
          mounted.root.querySelectorAll(".mdy-datepicker__weekday"),
        ).map((node) => (node.textContent ?? "").trim());

        expect(rendered.length).toBeGreaterThan(0);
        expect(inspectCalendarWeekStart(rendered, locale)).toEqual([]);

        mounted.dispose();
      });
    }
  }
});
