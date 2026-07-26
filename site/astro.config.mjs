// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const site = 'https://modyra.github.io';
const base = '/modyra';
const absolute = (path) => `${site}${base}/${path.replace(/^\/+/, '')}`;
const based = (path) => `${base}/${path.replace(/^\/+/, '')}`;

export default defineConfig({
	site,
	base,
	integrations: [
		starlight({
			title: 'Modyra',
			description:
				'A typed form engine for TypeScript applications, with explicit rendering and integration boundaries.',
			logo: {
				light: './src/assets/brand/logo-light.svg',
				dark: './src/assets/brand/logo-dark.svg',
				replacesTitle: true,
			},
			customCss: ['./src/styles/custom.css'],
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/modyra/modyra',
				},
			],
			favicon: based('brand/06-favicon/favicon.svg'),
			head: [
				{
					tag: 'link',
					attrs: {
						rel: 'apple-touch-icon',
						href: based('brand/06-favicon/apple-touch-icon.png'),
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:image',
						content: absolute('brand/05-social/og-image.png'),
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:card',
						content: 'summary_large_image',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:image',
						content: absolute('brand/05-social/og-image.png'),
					},
				},
			],
			// Do not configure editLink.baseUrl here. Synced pages receive an
			// explicit editUrl pointing to docs/, the canonical source tree.
			sidebar: [
				{ label: 'Start here', slug: 'start-here' },
				{
					label: 'Guides',
					items: [{ autogenerate: { directory: 'guides' } }],
				},
				{
					label: 'Modyra Studio',
					items: [{ autogenerate: { directory: 'studio' } }],
				},
			],
		}),
	],
});
