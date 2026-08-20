# @modyra/styles

Framework-agnostic CSS themes for [Modyra](https://github.com/modyra/modyra)
UI components — one class structure, six themes, every renderer.

| Entry point | Theme |
| :--- | :--- |
| `@modyra/styles/default.css` | The default look |
| `@modyra/styles/modern.css` | Modyra's own: Satoshi typography, compact fully-bordered controls |
| `@modyra/styles/material.css` | Material 3 |
| `@modyra/styles/ios.css` | iOS, faithful to Apple's own pairings |
| `@modyra/styles/ionic.css` | Ionic |
| `@modyra/styles/salience.css` | Generated from a seed colour by the theme compiler, with light and dark solved independently |

`@modyra/styles/base.css` carries the layout and the tokens every theme resolves through. It is
**required** by each theme above — a theme loaded without it lays the controls out correctly and
renders every colour as its initial value, which looks like controls that are present and invisible.
`foundation.css` is the token layer beneath it.

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
  --mdy-color-primary: #6458ef;
  --mdy-radius-md: 10px;
}
```

The full token list and class contract:
[UI toolkit guide](https://github.com/modyra/modyra/blob/main/docs/guides/ui-toolkit.md).

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
