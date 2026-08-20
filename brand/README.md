# Modyra brand assets

This directory is the source of truth for Modyra's visual identity. The website copies the browser-facing subset into `site/public/brand/` during development and production builds.

## Mark

The mark consists of three modules around a central negative space. The modules represent integration boundaries around the shared form model. The horizontal lockup is the default signature; use the icon alone only when the surrounding context already identifies Modyra.

### Usage

- Keep at least one lower-module height of clear space around the mark.
- Do not rotate, distort, outline, recolor or rearrange the modules.
- Do not reverse or replace the gradients.
- Keep the icon at least 16 px wide on screen.
- Keep horizontal lockups at least 120 px wide on screen.
- Use monochrome variants only when a color reproduction is not appropriate.

## Color

- Indigo `#6458EF`: primary structure and core concepts
- Violet `#A855F7`: reactivity and connection
- Coral `#FF6577`: action and emphasis
- Night `#0E0F16`: primary dark background
- Cloud `#F8FAFC`: light background and text on dark
- Slate `#94A3B8`: secondary text and quiet borders

The fixed gradients and CSS custom properties are defined in `02-color/modyra-tokens.css`.

## Typography

Satoshi is used for interface and editorial text. Code remains in a system monospace. Included webfonts use the Indian Type Foundry Free Font License in `03-typography/FFL.txt`.

Recommended hierarchy:

- display and page title: Bold 700
- section heading: Medium 500
- body: Regular 400
- caption: Regular 400
- wordmark-style uppercase: increased tracking

## Icons

The six system icons use a 24 x 24 grid, 1.8 px strokes, round caps and joins, and `currentColor`. Do not add fills, shadows or mixed colors. Keep them at least 16 px wide.

## Social and favicon assets

`05-social/` contains source SVGs and exported PNGs for repository, social and Open Graph surfaces. `06-favicon/` contains the browser and touch-icon family.

## Tone

Modyra communication is clear, technical, considerate and ambitious. Describe behavior directly, state limits beside features, and keep claims within the scope of public APIs and executed tests.

The code is MIT licensed. The Modyra mark and brand assets are Copyright 2026 Modyra. Satoshi remains subject to the license included with the font files.
