// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Modyra',
			description:
				'Framework-agnostic, type-safe form engine — typed field trees, arrays, drafts, undo/redo over a minimal reactive contract.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/modyra/modyra' }],
			editLink: {
				baseUrl: 'https://github.com/modyra/modyra/edit/main/docs/',
			},
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
