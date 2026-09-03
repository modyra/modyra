import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MDY_WIDGET_KEYBOARD, partClasses, stateClass } from "@modyra/widgets";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyMultiselectComponent } from "./multiselect-renderer.component";

/**
 * The number on an option in an open list can be changed from a keyboard.
 *
 * In counter mode each option carries a quantity between two `±` buttons. Those buttons are
 * `tabindex="-1"` — deliberately, because a stop per button would make Tab a scroll through the
 * list — so until the kind declared a key for them the number on a row could be changed with a
 * pointer and with nothing else. ADR 0198.
 *
 * **Asserted by pressing the key and reading the number, not by reading the element.** The `±`
 * buttons are in the document whatever else is true, so a check that asked whether they existed
 * passed on every day of the defect. The only question that separates the two is whether the
 * quantity moved.
 *
 * The keys and the cursor are read from the contract rather than named here: the declaration and the
 * renderer are one decision, and a bench holding its own copy of either passes while the two
 * disagree.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyMultiselectComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-multiselect
        [field]="form.f.tags"
        [options]="options"
        [mode]="'multi'"
        [ariaLabel]="'Tags'" />
    </mdy-form>
  `,
})
class Host {
  readonly form = mdyForm({ tags: field<readonly string[]>([]) });
  readonly options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
}

const OPTION = partClasses("multiselect", "option" as never)[0]!;
const ACTIVE = stateClass(OPTION, "active");
const COUNT = partClasses("multiselect", "optionCount" as never)[0]!;

/** The two keys the kind declares for the quantity on an option, by the direction each goes. */
function stepKeys(): { up: string; down: string } {
  const bindings = MDY_WIDGET_KEYBOARD.multiselect.filter(
    (one) => one.intent === "step" && one.on === "option" && one.when === "open",
  );
  const up = bindings.find((one) => one.by === 1);
  const down = bindings.find((one) => one.by === -1);
  expect(up && down).toBeTruthy();
  return { up: up!.key, down: down!.key };
}

describe("a quantity on an option in an open list", () => {
  function openCounterList(): { press: (key: string) => void } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector("[aria-expanded]") as HTMLElement | null;
    expect(trigger).toBeTruthy();
    trigger!.focus();
    trigger!.click();
    fixture.detectChanges();
    expect(trigger!.getAttribute("aria-expanded")).toBe("true");

    const press = (key: string): void => {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    // The precondition, and it is the whole subject: this key acts on *the option the cursor is on*.
    // A list opened with a pointer has no cursor, so a run that pressed straight away would report
    // "the quantity did not move" about a press that was never aimed at a row.
    press("ArrowDown");
    expect(document.querySelector(`.${ACTIVE}`)).toBeTruthy();
    return { press };
  }

  /**
   * What the counter on the option the cursor is on reads, as a number.
   *
   * The digits are taken out of the label rather than parsed from the whole of it — the counter
   * reads `×0`, and a `Number` of that is `NaN`, which compares equal to itself under a strict
   * check. An unreadable counter fails here instead of passing as "unchanged".
   */
  function quantityUnderCursor(): number {
    const option = document.querySelector(`.${ACTIVE}`);
    expect(option).toBeTruthy();
    const count = option!.querySelector(`.${COUNT}`);
    expect(count).toBeTruthy();
    const digits = /\d+/.exec(count!.textContent ?? "");
    expect(digits).toBeTruthy();
    return Number(digits![0]);
  }

  it("the key raises the quantity on the option the cursor is on", () => {
    const { press } = openCounterList();
    const before = quantityUnderCursor();

    press(stepKeys().up);

    expect(quantityUnderCursor()).toBe(before + 1);
  });

  it("the other key lowers it again, and stops at nothing chosen", () => {
    const { press } = openCounterList();
    const { up, down } = stepKeys();

    press(up);
    press(up);
    expect(quantityUnderCursor()).toBe(2);

    press(down);
    expect(quantityUnderCursor()).toBe(1);

    press(down);
    press(down);
    expect(quantityUnderCursor()).toBe(0);
  });
});
