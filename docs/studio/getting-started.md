# Getting started with Studio

## Launch it

Open [modyra.github.io/modyra/studio/app/](https://modyra.github.io/modyra/studio/app/)
for the full-screen editor, or run it locally from the repo:

```sh
npm run studio:dev
```

This builds every Studio package and starts a static server at
`http://127.0.0.1:4322`. Studio is local-first: your project auto-saves to
IndexedDB in your own browser and restores automatically on reload —
nothing is sent anywhere.

## Build a first field

1. Click **Text** in the palette (left) — it drops a text field at the
   root of the form.
2. Select it, and open the **Field** tab (right). Give it a label.
3. Open the **Validation** section and add a **Required** validator.

That's the whole loop: click or drag an element from the palette, edit it
from the inspector.

## Nest it into a group

Drag **Group** onto the canvas, then drag your text field *inside* it (the
canvas shows a "Drop inside" zone). Groups map to dotted paths — a `city`
field inside a `shipping` group becomes `shipping.city` everywhere: in
validators, in the Preview tab, and in every exported target.

Prefer the keyboard? See [Drag-and-drop editing](drag-and-drop.md) for the
full keyboard-only equivalent — every pointer action has one.

## Try it live

Open the **Preview** tab. It builds a real, running `@modyra/core` form
from your schema — not a static description of one. Type into your field:
the Required error appears and clears exactly as it would in a shipped
app. If you add a server validator, Preview runs it against a configurable
mock (see [Validators](validators.md)) so you can test the whole
pending/error flow without a backend.

## Export it

Open the **Export** tab, pick a target, click **Generate**:

- **Contract + Studio JSON** — the portable Dynamic Form Contract v2, plus
  the raw project.
- **Core (createForm)** — a real `@modyra/core` form definition.
- **Angular (mdyForm)** — the same schema via `@modyra/angular/adapter`.
- **React (useMdyForm)** — the same schema wrapped in a hook.

Every generated file has a **Preview** disclosure (see the real content
inline) and a **Copy** button, next to **Download**. See
[Target generation](target-generation.md) for what each target actually
emits and why.

## Save your work

Studio auto-saves continuously — there is nothing to click. To move a
project between browsers or machines, use **Export** → the JSON target's
`project.mdy-studio.json`, then **Import** (top-right of the header) on
the other side. See [Project format](project-format.md) for exactly
what's in that file.
