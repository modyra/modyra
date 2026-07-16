# @modyra/lit

Lit binding for the [Modyra](https://github.com/modyra/modyra) form engine:
`MdyFormController` is a ReactiveController that re-renders the host when
the form state it tracks changes. Structural typing — no hard dependency
on lit itself.

```ts
class SignupForm extends LitElement {
  private form = createLitForm({ email: field("", [required()]) });
  private tracker = new MdyFormController(this, [
    this.form.f.email.value,
    this.form.f.email.errors,
    this.form.state.valid,
  ]);
  render() {
    return html`<input .value=${this.form.f.email.value()}
      @input=${(e: Event) => this.form.f.email.set((e.target as HTMLInputElement).value)} />`;
  }
}
```

## Control catalog

`defineMdyElements()` registers one element per field kind — the same
coverage as the Angular renderer catalog, in Lit syntax:

`<mdy-text-field>` `<mdy-textarea-field>` `<mdy-number-field>`
`<mdy-checkbox-field>` `<mdy-toggle-field>` `<mdy-radio-group-field>`
`<mdy-segmented-field>` `<mdy-select-field>` `<mdy-multiselect-field>`
`<mdy-slider-field>` `<mdy-datepicker-field>` `<mdy-daterange-field>`
`<mdy-timepicker-field>` `<mdy-colors-field>` `<mdy-file-field>`

All bind via `.field=${form.f.…}` (option-based ones also take
`.options`), render in light DOM with the documented theme class
structure — the shipped CSS themes apply unchanged — and wire label,
required marker, `aria-invalid/required/describedby` and the error list
from the shared engine. Validators are the core ones (`required`,
`email`, `minLength`, `crossField`, …).

Value models follow the engine's conventions: ISO `yyyy-MM-dd` dates,
`HH:mm` times, hex colors, `File | File[] | null`. The date/time/color
pickers currently use the platform-native inputs; richer overlay pickers
can replace them without touching the field contract.

Because Lit ships web components, this catalog is also the path to Modyra
controls usable from any framework.
