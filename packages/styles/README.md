# @modyra/styles

Framework-agnostic CSS themes for [Modyra](https://github.com/modyra/modyra)
UI components — one class structure, five themes, every adapter (Angular
renderers, Lit elements, custom renderers built on `@modyra/widgets`).

## Install

```bash
npm install @modyra/styles
```

## Style entry points

- `@modyra/styles/default.css`
- `@modyra/styles/material.css`
- `@modyra/styles/ios.css`
- `@modyra/styles/ionic.css`
- `@modyra/styles/base.css` — structural styles only, bring your own look

```json
// angular.json
"styles": ["@modyra/styles/default.css", "src/styles.scss"]
```

```ts
// any bundler / web component app
import "@modyra/styles/default.css";
```

## Theming

Components render a documented, stable class structure (`mdy-input`,
`mdy-control--invalid`, `mdy-overlay-panel`, … — enforced by a parity
check across renderers). Override via CSS custom properties exposed by the
theme, or restyle the classes directly:

```css
:root {
  --mdy-color-primary: #7067ff;
  --mdy-radius-md: 10px;
}
```

The full token list and class contract:
[UI toolkit guide](https://github.com/modyra/modyra/blob/main/docs/guides/ui-toolkit.md).

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
