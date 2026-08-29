/**
 * Every kind, driven into the states where defects hide.
 *
 * A control at rest is the state a screenshot catches and the one nothing goes wrong in. What goes
 * wrong is the combination: failing *and* out of play, read-only *and* reachable, required *and*
 * untouched. Four toggles drive all seventeen kinds at once, because a rule that holds for the
 * datepicker and not the timepicker is exactly the shape this library keeps producing.
 */
import { createForm, field as mdyField, group as mdyGroup, required as mdyRequired } from "@modyra/core";
import { renderField } from "@modyra/plain";
import { KINDS } from "./kinds.js";
import { fieldAccessibleName, focusIsInsideField, nameIsAFallback, sliderTrack } from "@modyra/widgets";
import { grid, paintedAsFailing, readoutPrinter, toggle, toolbar } from "./shell.js";

export const statesPanel = {
  id: "states",
  title: "Kind × state",
  blurb:
    "The seventeen kinds the catalogue declares, driven together. Every field is required, so `invalid` is a state the widget can actually be in — a field with no rule can never fail, and a panel that looks right about an unreachable state proves nothing.",
  /**
   * The public names this panel drives.
   *
   * Declared rather than inferred: `audit-coverage-and-demo` used to search the demo sources for
   * a name, which counted an import line as a demonstration and made almost everything look
   * covered. What a panel exercises is a claim its own browser test checks.
   */
  exercises: [
    "MDY_CONTRACT_VOCABULARIES",
    // The legend on every panel prints the keys each kind answers to, and this is the one binding
    // whose key is not a key: it renders as words rather than as the token, because a
    // legend is read by somebody deciding what to press. (Said without quoting the words, because
    // this tool reads every quoted string in the block as a declared name — comments included.)
    "MDY_ANY_PRINTABLE_KEY",
    "MDY_FIELD_KINDS",
    "createCommandRuntime",
    "createForm",
    "field",
    "group",
    "required",
    "renderField",
    "observerFor",
    "shownErrors",
    "showsAsInvalid",
    "sliderTrack",
    "nameIsAFallback",
    "fieldAccessibleName",
    // Which field the keyboard is in, printed live: a panel drawn outside its field still belongs to
    // it, and the readout says so while the pointer or the keyboard is inside one.
    "focusIsInsideField",
    "errorsVisible",
    "shownErrorsOf",
    // The calendar's three views: a date picker that only pages a month at a time puts a birth date
    // thirty clicks away, and which view is showing is state the contract owns.
    "MDY_CALENDAR_VIEW_MODES",
    "calendarViewAfterPick",
    "projectCalendarViewA11y",
    "projectCalendarPeriodCellA11y",
    // Every kind is mounted here and driven into each state, so every kind's controller runs and
    // the projection it composes reaches the DOM. Named one by one rather than in bulk, because a
    // kind whose renderer stops consuming its controller should make this list wrong.
    "createBooleanFieldController",
    "createTextFieldController",
    "createOptionFieldController",
    "createMultiselectFieldController",
    "createSelectController",
    "createDatepickerFieldController",
    "createDaterangeFieldController",
    "createTimepickerFieldController",
    "projectFieldShellA11y",
    // Drawn by every toggle the panel mounts — the calendar button, the clock, the chevrons.
    // Only the geometry: the grid, the spans and the stroke are read by the themes and the
    // conformance kit, not by this renderer, and claiming them here would inflate the number this
    // metric exists to keep honest.
    "MDY_ICONS",
  ],

  invariant:
    "Out of play, no verdict. A field the form is not asking about shows no error class, no aria-invalid and no error text — and loses neither its value nor its errors, which return the moment it is back in play.",

  mount(work, readout) {
    const form = createForm({
      inPlay: mdyField(true),
      all: mdyGroup(
        Object.fromEntries(KINDS.map(([kind, empty]) => [kind, mdyField(empty, [mdyRequired()])])),
        { when: (_section, value) => value.inPlay === true },
      ),
    });

    const bar = toolbar(work);
    const area = grid(work);
    // Each renderer hands back its own teardown. Dropping it leaves an effect observing a form that
    // has been destroyed, which is silent until the next panel mounts and the console fills.
    const rendered = KINDS.map(([kind, , extra]) => {
      const cell = document.createElement("div");
      area.append(cell);
      return renderField(cell, { name: `all.${kind}`, kind, ...extra }, form.f.all[kind], form.reactivity);
    });

    // `setDisabled`/`setReadonly` take a predicate the form re-reads, so a toggle states the rule
    // rather than pushing a value once and leaving the form to disagree with the checkbox.
    toggle(bar, "Disabled", (on) => { for (const [kind] of KINDS) form.setDisabled(`all.${kind}`, () => on); });
    toggle(bar, "Read-only", (on) => { for (const [kind] of KINDS) form.setReadonly(`all.${kind}`, () => on); });
    toggle(bar, "Touched", (on) => { if (on) form.markAllTouched(); });
    toggle(bar, "Out of play", (on) => form.f.inPlay.set(!on));

    const print = readoutPrinter(readout, () => ({
      formValid: form.state.valid(),
      inPlay: form.f.inPlay.value(),
      submitted: Object.keys(form.submitValue()),
      // What the form still holds for a field it is not asking about: the errors are not forgotten,
      // they are not being shown to someone who cannot act on them.
      errorsHeld: KINDS.reduce((n, [kind]) => n + form.f.all[kind].errors().length, 0),
      partsPaintedAsFailing: paintedAsFailing(area),
      // Which field the keyboard is in, asked of the contract rather than of the document tree. A
      // panel drawn outside its field — to escape a scrolling ancestor — is still part of that
      // field, and the link that says so is the opener's `aria-controls`. Open a picker, put the
      // keyboard inside it, and the field named here is still the one that opened it.
      focusIsInside: KINDS
        .map(([kind]) => kind)
        .filter((kind) => {
          const root = area.querySelector(`[data-mdy-field="${kind}"]`);
          return root !== null && focusIsInsideField(root, work.ownerDocument.activeElement);
        }),
      // The track a slider is drawn on, printed beside what the form holds. A slider spans something
      // whether or not a document declares a range, and the default is not a licence to
      // misrepresent: a value past it widens the track rather than moving the thumb somewhere the
      // form is not. The two numbers here have to agree.
      sliderHolds: form.f.all.slider.value(),
      sliderTrack: sliderTrack(form.f.all.slider.constraints(), form.f.all.slider.value()),
      // What names each control, and whether the name is one somebody wrote or the field's own. A
      // document may leave a label out, and a control with no name is announced as its role alone.
      namedByTheField: KINDS
        .filter(([, , extra]) => nameIsAFallback({ label: extra?.label }))
        .map(([kind]) => kind),
      // And the name each control ends up carrying — what a screen reader announces.
      controlNames: Object.fromEntries(
        KINDS.map(([kind, , extra]) => [kind, fieldAccessibleName({ label: extra?.label, name: kind })]),
      ),
    }));

    const effect = form.reactivity.effect(() => {
      form.state.valid();
      form.f.inPlay.value();
      for (const [kind] of KINDS) form.f.all[kind].errors();
      print();
    });

    return () => { effect.destroy(); print.cancel(); for (const d of rendered) d?.(); form.destroy(); };
  },
};
