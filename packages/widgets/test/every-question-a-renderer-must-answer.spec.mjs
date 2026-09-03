/**
 * Every question a renderer has to answer, and where the contract answers it.
 *
 * A generator writing a renderer from this contract asks a fixed set of questions per kind: which
 * element the control is, which native type it takes, where focus lands when a panel opens, whether
 * the panel keeps `Tab`, which keys the kind declares, what carries the value into a form. A
 * question with no declared answer is one the generator has to guess, and a guess is made once per
 * consumer and differently each time — which is how three renderers came to disagree about the same
 * widget in every arc this cycle has repaired.
 *
 * **This enumerates rather than samples**, because the failures it exists for are invisible one kind
 * at a time: the multiselect's landing looked fine until the select was asked the same question, and
 * the radio's control looked declared until it was read beside its sibling's.
 *
 * **It fails in both directions.** A question that loses its answer fails, and so does a question in
 * the open list that has since been answered — an exemption that outlives its reason is a decision
 * nobody took, read later as one that was.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD, focusPartOnOpen, popupHoldsAnAction, submissionNames,
} from "../dist/index.js";

const KINDS = Object.keys(MDY_WIDGET_CONTRACTS);
const UNANSWERED = "UNANSWERED";

/**
 * The questions that have a declared answer for every kind, and the declaration each reads.
 *
 * Only questions a renderer cannot proceed without. "Which classes" and "which states" are left out
 * deliberately: they are answered by the same `parts` map for every kind, so enumerating them would
 * pad this table with a column that cannot vary.
 */
const QUESTIONS = Object.freeze({
  "which element is the control": (kind) => {
    // Every part whose name says it is one, because a kind may have several: a range has a control
    // per end and a timepicker one per segment. Asking only for `control` reported a kind with two
    // as having none, which is the question being narrower than the anatomy rather than the anatomy
    // being silent.
    const controls = MDY_WIDGET_CONTRACTS[kind].structure.nodes
      .filter((node) => /^(control|.*Control|trigger)$/.test(String(node.part)));
    return controls.length > 0
      ? controls.map((node) => `${node.part} is ${String(node.element)}`).join(", ")
      : UNANSWERED;
  },
  "which native type it takes": (kind) => {
    const declared = MDY_WIDGET_CONTRACTS[kind].controlType;
    if (declared !== undefined) return `controlType ${declared}`;
    // Absence is an answer where the element is not an `<input>`: a textarea says which it is through
    // its semantic, and a kind that draws no native control has no type to take. Absence is *not* an
    // answer where an `input` is declared and nothing says which kind of input it is.
    const inputs = MDY_WIDGET_CONTRACTS[kind].structure.nodes
      .filter((node) => /^(control|.*Control)$/.test(String(node.part)) && String(node.element) === "input");
    if (inputs.length === 0) return "no type: the kind draws no native input";
    return UNANSWERED;
  },
  "where focus lands when it opens": (kind) => {
    if (MDY_WIDGET_CONTRACTS[kind].capabilities.overlay !== true) return "no panel to open";
    const withBox = focusPartOnOpen(kind, { searchable: true });
    const without = focusPartOnOpen(kind, { searchable: false });
    // `null` is an answer where the kind can render the platform's own chooser: there is no panel of
    // ours to put focus into, and saying so is not the same as saying nothing. Read from the
    // variants rather than by naming the kind, so a second kind that grows a native form inherits it.
    const hasNativeVariant = "native" in (MDY_WIDGET_CONTRACTS[kind].variants ?? {});
    const say = (answer) => (answer === null
      ? (hasNativeVariant ? "null: the platform's own chooser has no panel of ours" : UNANSWERED)
      : answer);
    const first = say(without);
    const second = say(withBox);
    return first === UNANSWERED || second === UNANSWERED ? UNANSWERED : `${first} / ${second} with a filter box`;
  },
  "whether the panel keeps Tab": (kind) => (
    MDY_WIDGET_CONTRACTS[kind].capabilities.overlay === true
      ? `popupHoldsAnAction ${popupHoldsAnAction(kind)}`
      : "no panel to keep it"
  ),
  "which keys it declares": (kind) => {
    const keys = MDY_WIDGET_KEYBOARD[kind] ?? [];
    // No keys is an answer for a kind the platform drives: a text field's keyboard is the browser's.
    return keys.length > 0 ? `${keys.length} binding(s)` : "none: the platform drives it";
  },
  "what carries the value into a form": (kind) => {
    const parts = Object.keys(submissionNames(kind, "path"));
    // An empty answer is still an answer, and the table says which: those kinds build their inputs
    // at submit time rather than declaring a part for them.
    return parts.length > 0 ? parts.join(" + ") : "built at submit time, no part carries it";
  },
});

/**
 * Questions with no declared answer, each named with what closes it.
 *
 * Not a suppression list: every entry is a question this suite has asked and the contract has not
 * yet answered, and the check below fails if one is answered while still listed here.
 */
const OPEN = Object.freeze({
  "datepicker · which native type it takes":
    "its `control` is declared an `input` and renders `type=\"text\"` in every renderer, because this "
    + "library parses the date itself rather than handing it to the platform. That is a decision, and "
    + "nothing declares it: a generator reads `input` and guesses between text and date",
  "daterange · which native type it takes":
    "two native inputs, one per end, and both render `type=\"text\"` for the same reason the "
    + "datepicker's does — the library parses the date. Undeclared there too, and `controlType` "
    + "would have to say it once for two controls that happen to agree",
  "timepicker · which native type it takes":
    "three native inputs with two types — `control` renders `text` and the two segments render "
    + "`number` — and `controlType` is one field for a whole kind, so it cannot say this even if "
    + "somebody filled it in. The shape of the answer has to be decided before the answer is",
});

test("every kind answers every question, or the question is one we have written down", () => {
  const unanswered = [];
  const table = [];
  for (const kind of KINDS) {
    for (const [question, ask] of Object.entries(QUESTIONS)) {
      const answer = ask(kind);
      table.push(`${kind} · ${question}: ${answer}`);
      if (answer === UNANSWERED) unanswered.push(`${kind} · ${question}`);
    }
  }
  assert.ok(table.length > 0, "no question was asked of any kind, so this measured nothing");

  const known = Object.keys(OPEN);
  const surprises = unanswered.filter((one) => !known.includes(one));
  assert.deepEqual(
    surprises,
    [],
    `a question no kind's declaration answers, and it is not one we have written down:\n  ${surprises.join("\n  ")}`,
  );

  // The other direction: an entry that has since been answered is a note nobody will read as stale.
  const closed = known.filter((one) => !unanswered.includes(one));
  assert.deepEqual(
    closed,
    [],
    `written down as unanswered and now answered — delete the entry, or the list outlives its `
    + `reason:\n  ${closed.join("\n  ")}`,
  );
});

test("a part that renders an operable control is not declared with a semantic that admits everything", () => {
  // Reported rather than enforced here, because the enforcement is where the elements are: the DOM
  // contract refuses it against a rendered page, which is the only place the claim can be tested.
  // What this asserts is that the count is known — a number that moves without anyone noticing is
  // how `radio` kept a control declared as decoration through every green run.
  const PERMISSIVE = new Set(["root", "group", "presentation", "popup"]);
  const permissive = KINDS.flatMap((kind) => MDY_WIDGET_CONTRACTS[kind].structure.nodes
    .filter((node) => PERMISSIVE.has(String(node.element)))
    .map((node) => `${kind}.${node.part}`));

  assert.equal(
    permissive.length,
    85,
    "the number of parts declared with a semantic that admits every element has moved. That is not a "
    + "defect by itself — boxes, panels and decorations are what those semantics are for — but each "
    + "one is a part whose element nothing can contradict, so the count is worth noticing when it "
    + `changes.\n  ${permissive.join("\n  ")}`,
  );
});
