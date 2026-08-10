# The UI toolkit in Angular

`@modyra/angular/ui` is Angular's rendered catalogue. It draws the same seventeen widget kinds as
every other renderer — [the shared definition is here](./ui-toolkit.md) — with Angular's components,
inputs and template syntax.

Controls are standalone: importing one does not pull in the catalogue.

## Component catalog

| Selector                  | Component                     | Value type                                                       |
| :------------------------ | :---------------------------- | :--------------------------------------------------------------- |
| `mdy-control-text`        | `MdyTextComponent`            | `string`                                                         |
| `mdy-control-textarea`    | `MdyTextareaComponent`        | `string`                                                         |
| `mdy-control-number`      | `MdyNumberComponent`          | `number \| null`                                                 |
| `mdy-control-checkbox`    | `MdyCheckboxComponent`        | `boolean`                                                        |
| `mdy-control-toggle`      | `MdyToggleComponent`          | `boolean`                                                        |
| `mdy-control-radio`       | `MdyRadioGroupComponent`      | `TValue \| null`                                                 |
| `mdy-control-segmented`   | `MdySegmentedButtonComponent` | `TValue \| null`                                                 |
| `mdy-control-slider`      | `MdySliderComponent`          | `number`                                                         |
| `mdy-control-select`      | `MdySelectComponent`          | `TValue \| null`                                                 |
| `mdy-control-multiselect` | `MdyMultiselectComponent`     | `TValue[]`                                                       |
| `mdy-control-datepicker`  | `MdyDatePickerComponent`      | `string` (ISO `yyyy-MM-dd`, a calendar date — no timezone)       |
| `mdy-control-daterange`   | `MdyDateRangePickerComponent` | `MdyDateRange`                                                   |
| `mdy-control-timepicker`  | `MdyTimepickerComponent`      | `string` (`"HH:mm AM/PM"`, or `"HH:mm"` 24h with `format="24h"`) |
| `mdy-control-colors`      | `MdyColorsComponent`          | `string` (hex)                                                   |
| `mdy-control-file`        | `MdyFileComponent`            | `File \| File[] \| null`                                         |

## UI enhancements

### Prefixes & suffixes

```html
<mdy-control-text name="price" label="Price">
  <span mdyPrefix>$</span>
  <span mdySuffix>.00</span>
</mdy-control-text>
```

### Floating labels & supporting text

```html
<mdy-form [mdyFloatingLabels]="true" [mdyFloatingLabelsDensity]="-2">
  <mdy-control-text name="email" label="Email">
    <small mdySupportingText>We'll never share your email.</small>
  </mdy-control-text>
</mdy-form>
```

### Inline errors

```html
<mdy-control-text name="password" label="Password" mdyInlineErrors />
```

## Enterprise select — server-side search & tagging

```html
<mdy-control-select
  name="city"
  searchable
  allowCreate
  [mdyLoadOptions]="searchCities"
  [mdyLoadOptionsDebounce]="300"
  (optionCreated)="addCity($event)"
/>
```

`[mdyLoadOptions]` calls `(query) => Promise<MdySelectOption[]>` on every
debounced query change (including the initial empty query) with the loading
spinner driven for the whole window and last-wins semantics on out-of-order
responses — works on select and multiselect. `allowCreate` adds a
"Create «query»" row when no option label matches (keyboard: Enter with no
active option): pick it and `optionCreated` fires with the query.

### Conditional options

```html
<mdy-control-select name="country" [options]="countries" />
<mdy-control-select
  name="province"
  [mdyDependsOn]="'country'"
  [mdyOptionsMap]="provincesByCountry"
/>
```

## Rendering from a contract

```ts
readonly fields: MdyDynamicField[] = [
  { kind: "text", name: "fullName", label: "Full name", validators: { required: true, minLength: 2 } },
  { kind: "select", name: "topic", label: "Topic", options: [{ value: "sales", label: "Sales" }] },
  { kind: "slider", name: "score", label: "Score", min: 0, max: 10 },
];
```

```html
<mdy-dynamic-form [fields]="fields" (submitted)="save($event)">
  <button type="submit">Send</button>
</mdy-dynamic-form>
```

Projected content — the submit button here — lands inside the generated `<mdy-form>`, and the inner
form is exposed as a view child.

**Parse the document first when it came from the network.** TypeScript types do not validate runtime
data; see [forms as data](./ai-generated-forms.md).

## See also

- [The UI toolkit](./ui-toolkit.md) — the catalogue, theming and accessibility, for every renderer
- [Usage modes in Angular](./usage-modes-angular.md) — typed, declarative and explicit-adapter
- [Reactive Forms interop](./interop.md) — using a renderer as a `ControlValueAccessor`
