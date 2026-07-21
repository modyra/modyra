# Modyra docs site

An [Astro](https://astro.build) + [Starlight](https://starlight.astro.build)
site generated from the markdown in `../docs/` — that directory stays the
single source of truth. `npm run sync` (run automatically before `dev`/
`build`) copies `docs/**/*.md` into `src/content/docs/`, injecting the
Starlight frontmatter each page needs (`title`, pulled from the first `#
heading`) and stripping the heading from the body so it isn't rendered
twice. See `../scripts/sync-docs-site.mjs`.

**Never hand-edit files under `src/content/docs/`** — they're
regenerated on every sync and any edit is silently discarded. Edit the
real source in `../docs/` instead; the site's "Edit this page" link
already points there.

```bash
npm install
npm run dev       # sync + astro dev, http://localhost:4321
npm run build     # sync + astro build -> ./dist/
npm run preview   # preview the production build
```
