# DevTools — live form inspector

"Why is my form invalid?" answered in one panel. There are two flavors of
the same inspector: the **Angular overlay** (`mdyDevtools`, hotkey-driven,
most of this guide) and the **framework-agnostic headless panel**
(`mountMdyDevtools`, works with any binding — see the last section).

## Angular: the hotkey overlay

Mark a form as inspectable and press **Ctrl+Shift+D**:

```html
<mdy-form [form]="form" mdyDevtools>…</mdy-form>
```

The hotkey opens a **draggable overlay** on the *selected* form — the
registered form containing the focused element, falling back to the last
registered one. Drag it by the title bar; close with ✕ or Escape (focus is
returned to where it was). The overlay is a `role="dialog"` and receives
focus when it opens.

## What the panel shows

- Form state signals: `valid`, `pending`, `submitting`, `submitCount`,
  `canSubmit`.
- A per-field table — rows derived automatically from the registered fields —
  with columns **field / value / valid / touched / dirty / pending / errors**.
- Each error is prefixed with its origin: `[validation]`, `[async]`,
  `[cross-field]`, `[server]`.
- The live JSON value and the last submit errors.
- Click a field path to copy it to the clipboard.
- Filter rows by name, or show only invalid fields.

## Sensitive values are masked

Values of fields whose path looks sensitive (contains `password`, `token`,
`secret`, `card`, `cvv`, `ssn`, `iban`, …) are replaced with `•••` in both
the table and the JSON view. Add your own paths with:

```html
<mdy-forms-devtools [form]="form" [maskFields]="['legacyPwd']" />
```

File contents are never shown — `File` values render as
`[File: name (size)]` metadata only.

## Embedding and programmatic use

```html
<mdy-forms-devtools [form]="form" />                     <!-- inline panel -->
<mdy-forms-devtools [form]="form" [fields]="[form.f.email]" expanded />
```

```ts
inject(MdyFormsDevtoolsService).toggle(form); // open/close the overlay
```

## React, Vue, Lit (or plain JS): the headless panel

The same inspector ships in `@modyra/core` as a DOM panel mountable
anywhere — no Angular involved. The `examples/{react,vue,lit}` apps use it:

```ts
import { mountMdyDevtools } from "@modyra/react"; // or core / vue / lit

const unmount = mountMdyDevtools(form, document.getElementById("panel")!);
// re-renders on an interval; call unmount() to dispose
```

It shows the same masked state/value table and is styled by the same theme
variables (`mdy-devtools` class).

## Hotkey configuration

```ts
providers: [
  { provide: MDY_DEVTOOLS_HOTKEY, useValue: "ctrl+alt+i" }, // rebind
  // or disable entirely (toggle() still works):
  { provide: MDY_DEVTOOLS_HOTKEY, useValue: null },
];
```

The default `ctrl+shift+d` collides with a built-in shortcut in some
browsers — rebind it if that matters to your team.

## Production builds

The devtools ship no providers and are only bundled when your code imports
`MdyDevtoolsDirective` / `MdyFormsDevtoolsComponent` — standard tree
shaking, nothing magic. To keep them out of production, guard the import
site (e.g. render behind `isDevMode()` or an environment flag): an import
that exists in shipped code is bundled like any other component.
