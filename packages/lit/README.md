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

Because Lit ships web components, this is also the path to Modyra controls
usable from any framework. Status: early (0.1.0) — controller and factory
implemented and tested; ready-made elements are future work.
