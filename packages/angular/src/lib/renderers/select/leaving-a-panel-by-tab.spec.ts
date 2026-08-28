import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdySelectComponent } from "./select-renderer.component";
import { MdyTextComponent } from "../text/text-renderer.component";

/**
 * Tab from an open list goes to the next field, in one press.
 *
 * Tab means the same thing everywhere, which is why a widget may not spend it: a list that takes the
 * key to choose something has made a trap out of the one key a person trusts. What it may do is
 * close, and then let the key carry on.
 *
 * The order is the whole of it, and it is not a preference. Closing first removes the element focus
 * was on, so the platform hands focus to `<body>` — and the browser then Tabs from the top of the
 * document. Focus goes back to the opener *first*, and the panel is taken away after, so the key
 * moves from a place that knows where the next field is.
 *
 * **What this cannot settle.** There is no native Tab here, so where focus finally lands is not
 * observable: this asserts that the panel closes, that the key is not cancelled, and that the
 * reading position is on the field rather than on the document. Whether the person arrives at the
 * next field in one press — rather than being carried there by the browser and then pulled back — is
 * a browser question and belongs to the browser tier.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdySelectComponent, MdyTextComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-select [field]="form.f.pick" [options]="options" [searchable]="true" [ariaLabel]="'Pick'" />
      <mdy-control-text [field]="form.f.after" [ariaLabel]="'After'" />
    </mdy-form>
  `,
})
class HostComponent {
  readonly options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
  readonly form = mdyForm({ pick: field<string | null>(null), after: field("") });
}

describe("Tab from an open list", () => {
  it("closes it and leaves the reading position on the field, not on the document", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    const opener = page.querySelector("[aria-expanded]") as HTMLElement;
    opener.focus();
    opener.click();
    fixture.detectChanges();
    expect(page.querySelector("[aria-expanded='true']")).not.toBeNull();

    // From wherever opening actually left the reading position. A listbox driven by
    // `aria-activedescendant` keeps focus on the control and moves a marker instead — deliberately,
    // and it is why that pattern exists — so an option is not somewhere focus can be, and a check
    // that put it there would be pressing the key from a state the widget never reaches.
    const controls = opener.getAttribute("aria-controls");
    const panel = controls ? page.ownerDocument.getElementById(controls) : null;
    expect(panel).not.toBeNull();
    const from = page.ownerDocument.activeElement as HTMLElement | null;
    expect(from).not.toBeNull();
    expect(from).not.toBe(page.ownerDocument.body);

    from?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(page.querySelector("[aria-expanded='true']")).toBeNull();
    // The key was not spent. Tab means the same thing everywhere, and a panel that cancels it to
    // choose something has made a trap out of the one key a person trusts.
    expect(from?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }))).toBe(true);
    const landed = page.ownerDocument.activeElement;
    expect(landed).not.toBe(page.ownerDocument.body);
    // On the opener, from which the browser's own Tab reaches the next field. A panel that closed
    // without placing focus leaves the person at the top of the document with nothing said.
    expect(landed).toBe(opener);
  });
});
