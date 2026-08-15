/**
 * Driving a clock with the keyboard.
 *
 * A timepicker's dial is a circle of numbers, and `timepickerDialKeyIntent(key, field, format,
 * current)` is what a key does to it. Nothing in this suite had named it, and it carries three things
 * a circle needs and a list does not.
 *
 * It wraps at both ends, because a clock has no first or last hour: down from one is twelve, up from
 * twelve is one. It pages by something meaningful rather than by a screenful — half the face for
 * hours, one dial number for minutes, so `PageDown` from six lands on twelve and from thirty minutes
 * lands on twenty-five. And it answers in the format's own numbers: a twelve-hour face runs 1 to 12
 * with no zero, a twenty-four-hour face runs 0 to 23 with no twelve at the top.
 *
 * The draft holds hours as 1–12 whatever the format and the host converts at the boundary, which is
 * the same arrangement the typed boxes use. Getting the wrap wrong at the seam between those two is
 * the defect this pins: an hour that goes 12 → 13 on a twelve-hour face, or 23 → 24 on a
 * twenty-four-hour one, is one keypress away and looks like nothing in a screenshot.
 */

import { timepickerDialKeyIntent, timepickerDialNumbers } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const intent = (key, field, format, current) => timepickerDialKeyIntent(key, field, format, current);
const valueOf = (key, field, format, current) => intent(key, field, format, current)?.value ?? null;

battle(
  {
    claims: ["UI-002", "LOC-001"],
    title: "a clock face wraps at both ends, in the numbers its format uses",
    environments: ["node"],
  },
  async (ctx) => {
    // Twelve-hour hours have no zero, so both ends wrap past one.
    const twelve = {
      downFromOne: valueOf("ArrowDown", "hour", "12h", 1),
      upFromTwelve: valueOf("ArrowUp", "hour", "12h", 12),
      home: valueOf("Home", "hour", "12h", 5),
      end: valueOf("End", "hour", "12h", 5),
    };
    ctx.log.note("a twelve-hour face at its ends", twelve);

    expectEqual(twelve, { downFromOne: 12, upFromTwelve: 1, home: 1, end: 12 }, {
      claimIds: ["UI-002", "LOC-001"],
      what: "a twelve-hour face left the range 1..12",
    });

    // Twenty-four-hour hours have a zero and no twenty-four.
    const twentyFour = {
      downFromZero: valueOf("ArrowDown", "hour", "24h", 0),
      upFromTwentyThree: valueOf("ArrowUp", "hour", "24h", 23),
      home: valueOf("Home", "hour", "24h", 5),
      end: valueOf("End", "hour", "24h", 5),
    };
    ctx.log.note("a twenty-four-hour face at its ends", twentyFour);

    expectEqual(twentyFour, { downFromZero: 23, upFromTwentyThree: 0, home: 0, end: 23 }, {
      claimIds: ["UI-002", "LOC-001"],
      what: "a twenty-four-hour face left the range 0..23",
    });

    // Minutes are the same circle with sixty numbers on it.
    expectEqual(
      [valueOf("ArrowDown", "minute", "12h", 0), valueOf("ArrowUp", "minute", "12h", 59)],
      [59, 0],
      {
        claimIds: ["UI-002"],
        what: "the minutes did not wrap at the top of the hour",
      },
    );
  },
);

battle(
  {
    claims: ["UI-002", "A11Y-002"],
    title: "a page on a clock is half a face, and a step is a step",
    environments: ["node"],
  },
  async (ctx) => {
    // Left and right are the same movement as down and up: a circle has one axis, however it is
    // drawn, and a reader turning it with either pair must not get two different clocks.
    for (const [back, forward] of [["ArrowDown", "ArrowUp"], ["ArrowLeft", "ArrowRight"]]) {
      expectEqual(
        [valueOf(back, "hour", "12h", 3), valueOf(forward, "hour", "12h", 3)],
        [2, 4],
        {
          claimIds: ["UI-002"],
          what: `${back} and ${forward} did not move one hour either way`,
        },
      );
    }

    // A page is a meaningful piece of the face rather than a screenful: half a clock, one dial mark.
    const pages = {
      hourUp: valueOf("PageUp", "hour", "12h", 3),
      hourDown: valueOf("PageDown", "hour", "12h", 3),
      minuteUp: valueOf("PageUp", "minute", "12h", 30),
      minuteDown: valueOf("PageDown", "minute", "12h", 30),
    };
    ctx.log.note("what a page is worth on each face", pages);

    expectEqual(pages, { hourUp: 6, hourDown: 12, minuteUp: 35, minuteDown: 25 }, {
      claimIds: ["UI-002"],
      what: "a page on the dial is no longer half a face for hours and one dial number for minutes",
    });

    // A key that is not a movement moves nothing, so Enter can mean confirm.
    for (const key of ["Enter", " ", "Escape", "a", "Tab"]) {
      expectEqual(intent(key, "hour", "12h", 3), null, {
        claimIds: ["UI-002"],
        what: `${JSON.stringify(key)} was read as a movement on the dial`,
      });
    }

    // And the face a reader sees carries the numbers the keyboard walks: twelve marks for hours and
    // for minutes, the minutes labelled every five with a leading zero.
    const hours = timepickerDialNumbers("hour", "12h");
    const minutes = timepickerDialNumbers("minute", "12h");
    ctx.log.note("what is drawn on each face", {
      hours: hours.map((each) => each.label),
      minutes: minutes.map((each) => each.label),
    });

    expectEqual(hours.map((each) => each.value), [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], {
      claimIds: ["A11Y-002"],
      what: "an hour face is not the twelve hours starting at the top",
    });

    expectEqual(minutes.map((each) => each.label), ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"], {
      claimIds: ["A11Y-002"],
      what: "a minute face is not the twelve five-minute marks, written as a clock writes them",
    });

    expectClaim(timepickerDialNumbers("hour", "24h").length === 24, {
      claimIds: ["LOC-001"],
      what: "a twenty-four-hour face does not carry twenty-four hours",
      detail: String(timepickerDialNumbers("hour", "24h").length),
    });
  },
);
