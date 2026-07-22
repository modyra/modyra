// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://modyra.github.io',
	base: '/modyra',
	integrations: [
		starlight({
			title: 'Modyra',
			description:
				'Framework-agnostic, type-safe form engine — typed field trees, arrays, drafts, undo/redo over a minimal reactive contract.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/modyra/modyra' }],
			// No editLink.baseUrl here: it derives the URL from each page's
			// path inside *this* project (src/content/docs/), which doesn't
			// match docs/ (the real source) closely enough to be correct for
			// every page (the top-level index.md vs. docs/README.md, for one).
			// Every synced page instead carries an explicit `editUrl` in its
			// own frontmatter, injected by ../scripts/sync-docs-site.mjs.
			sidebar: [
				{ label: 'Start here', slug: 'index' },
				{
					label: 'Guides',
					items: [{ autogenerate: { directory: 'guides' } }],
				},
				{
					label: 'Framework examples',
					items: [{ autogenerate: { directory: 'examples' } }],
				},
			],
		}),
	],
});
