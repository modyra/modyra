# Studio design system

Studio applies the Modyra brand through semantic interface tokens rather than by using brand colors as decoration.

## Principles

- **Model first:** the canvas remains the primary surface; navigation and properties support it.
- **Three surface levels:** canvas, panel and raised panel establish hierarchy without nested card chrome.
- **Semantic color:** Indigo marks selection and focus, Violet supports relationships, Coral is reserved for errors and destructive emphasis, and green communicates success.
- **Stable density:** controls remain compact, but all primary interactive elements have a 32 px minimum height and a visible keyboard focus state.
- **Motion explains state:** transitions are short and disabled when reduced motion is requested.
- **Light and dark parity:** components consume semantic tokens so both color schemes preserve the same hierarchy.

## Token layers

The brand layer defines `--mdy-*` colors. Studio derives `--studio-*` tokens for surfaces, text, controls, state, radius, spacing and motion. Components should consume the Studio semantic tokens. Raw brand colors are appropriate only when the brand meaning itself is required.

## Adding a component

1. Reuse an existing surface and spacing level.
2. Give every interactive control a keyboard-visible focus state.
3. Keep secondary actions neutral until hover or focus.
4. Use state colors only for their documented meaning.
5. Check dark, light, reduced-motion and forced-colors modes.
6. Add behavioral tests before adding visual exceptions.
