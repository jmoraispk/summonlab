import { marked, Renderer } from 'marked';
import path from 'node:path';
import { base } from '$app/paths';

import catalog from '../../../../../docs/wiki/catalog.json';

const wikiSources = import.meta.glob('../../../../../docs/wiki/**/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const assetSources = import.meta.glob(
	[
		'../../../../../assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg',
		'../../../../../assets/enemies/wiki/affinities/reference/element-cycle-v2.svg',
		'../../../../../assets/enemies/review/beasts-v1.webp',
		'../../../../../assets/enemies/review/constructs-v1.webp',
		'../../../../../assets/enemies/review/goblinoids-v1.webp',
		'../../../../../assets/enemies/review/large-threats-v1.webp',
		'../../../../../assets/enemies/review/pack-2/arachnids-v1.png',
		'../../../../../assets/enemies/review/pack-2/arcane-hostiles-v1.png',
		'../../../../../assets/enemies/review/pack-2/draconic-v1.png',
		'../../../../../assets/enemies/review/pack-2/dungeon-predators-v1.png',
		'../../../../../assets/enemies/review/pack-2/elementals-v1.png',
		'../../../../../assets/enemies/review/pack-2/undead-v1.png',
		'../../../../../docs/evidence/living-village-lab-cutouts-v1/dara-zev.png',
		'../../../../../docs/evidence/living-village-lab-cutouts-v1/iven-orra.png',
		'../../../../../docs/evidence/living-village-lab-cutouts-v1/jori-daro.png',
		'../../../../../docs/evidence/living-village-lab-cutouts-v1/kira-toren.png',
		'../../../../../docs/evidence/living-village-lab-cutouts-v1/mara-vey.png',
		'../../../../../docs/evidence/living-village-lab-cutouts-v1/remy-nahl.png',
		'../../../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-f.png',
		'../../../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-e.png',
		'../../../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-d.png',
		'../../../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-c.png',
		'../../../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-b.png',
		'../../../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-a.png',
		'../../../../../assets/wiki/skills/icon-production-v2/frames/rarity-frame-s.png',
		'../../../../../assets/settlements/hearth-01/hearth-01-environment-v1.png'
	],
	{
		eager: true,
		query: '?url',
		import: 'default'
	}
) as Record<string, string>;

type CatalogEntry = (typeof catalog.entries)[number];

export interface WikiNavigationEntry {
	title: string;
	href: string;
	section: string;
	group: string | null;
	designStatus: string;
	pageType: string;
	searchTerms: string;
}

export interface WikiPage {
	wikiId: string;
	title: string;
	html: string;
	bodyHtml: string;
	href: string;
	sourcePath: string;
	designStatus: string;
	implementationStatus: string;
	visualStatus: string;
	spoilerScope: string;
	section: string;
	pageType: string;
}

const wikiByPath = new Map(
	Object.entries(wikiSources).map(([modulePath, source]) => [
		modulePath.replace('../../../../../docs/wiki/', ''),
		source
	])
);

const assetsByPath = new Map(
	Object.entries(assetSources).map(([modulePath, publicUrl]) => [
		modulePath.replace('../../../../../', ''),
		publicUrl
	])
);

function titleFromMarkdown(source: string): string {
	return source.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? 'Untitled entry';
}

function routeFromWikiPath(sourcePath: string): string {
	if (sourcePath === 'README.md') return '/wiki';
	const withoutExtension = sourcePath.replace(/\.md$/, '');
	const normalized = withoutExtension.endsWith('/README')
		? withoutExtension.slice(0, -'/README'.length)
		: withoutExtension;
	return `/wiki/${normalized}`;
}

// Preserve source-bound records while publishing one reader page for their shared content.
const consolidatedMonsterSources = new Map([
	['creatures/taxonomy', 'creature-taxonomy'],
	['creatures/monster-races/goblinoids', 'goblinoid-warbands'],
	['creatures/monster-races/generator-bestiary-01', '1-goblins'],
	['creatures/monster-races/generator-bestiary-02', '7-rotwalkers'],
	['creatures/monster-races/generator-bestiary-03', '13-harpies'],
	['creatures/monster-races/generator-bestiary-04', '19-slimes'],
	['creatures/monster-races/generator-bestiary-05', '25-werebeasts']
]);

export function getWikiConsolidationRedirect(slug: string): string | null {
	if (slug === 'mechanics/affinities') return '/wiki/mechanics/progression/affinities';
	return consolidatedMonsterSources.has(slug) ? '/wiki/creatures/monster-races' : null;
}

function sectionFromPath(sourcePath: string): string {
	if (sourcePath.startsWith('mechanics/equipment/')) return 'Equipment';
	if (sourcePath === 'mechanics/skills/living-village.md') return 'Other';
	if (sourcePath.startsWith('mechanics/skills/')) return 'Skills';
	if (
		sourcePath.startsWith('mechanics/progression/') ||
		sourcePath.startsWith('mechanics/affinities/')
	)
		return 'Progression';
	if (sourcePath === 'art/monster-gallery.md') return 'Monsters';
	if (sourcePath === 'art/skill-rarity-frames.md') return 'Skills';
	const first = sourcePath.split('/')[0];
	const labels: Record<string, string> = {
		art: 'Other',
		creatures: 'Monsters',
		mechanics: 'Mechanics',
		milestones: 'Milestones',
		principles: 'Other',
		roadmap: 'Other',
		sources: 'Sources',
		systems: 'Systems',
		templates: 'Templates'
	};
	return labels[first] ?? 'Wiki';
}

function navigationGroupFromPath(sourcePath: string): string | null {
	const segments = sourcePath.split('/');
	if (
		segments.length < 3 ||
		['Equipment', 'Skills', 'Progression', 'Monsters', 'Other'].includes(
			sectionFromPath(sourcePath)
		)
	)
		return null;
	return segments[1].replaceAll('-', ' ').replace(/\b\w/gu, (character) => character.toUpperCase());
}

function entryPath(entry: CatalogEntry): string {
	return entry.path.replace(/^docs\/wiki\//, '');
}

function escapeAttribute(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function headingSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/<[^>]*>/g, '')
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-');
}

function splitTarget(target: string): { pathname: string; suffix: string } {
	const match = target.match(/^([^?#]*)(.*)$/);
	return { pathname: match?.[1] ?? target, suffix: match?.[2] ?? '' };
}

function resolveTarget(target: string, sourcePath: string): string {
	if (/^(?:https?:|mailto:)/i.test(target)) return target;
	if (/^[a-z]+:/i.test(target)) return '#unsupported-link';
	if (/^(?:#|\/)/.test(target)) return target;

	const { pathname, suffix } = splitTarget(target);
	const repositoryPath = path.posix.normalize(
		path.posix.join('docs/wiki', path.posix.dirname(sourcePath), pathname)
	);

	if (repositoryPath.startsWith('docs/wiki/') && repositoryPath.endsWith('.md')) {
		if (!catalog.entries.some((entry) => entry.path === repositoryPath)) {
			return `https://github.com/jmoraispk/summonlab/blob/main/${repositoryPath}${suffix}`;
		}
		const route = routeFromWikiPath(repositoryPath.replace('docs/wiki/', ''));
		const consolidated = getWikiConsolidationRedirect(route.replace('/wiki/', ''));
		if (consolidated) {
			let fragment = suffix;
			if (suffix === '#open-questions') {
				if (route.endsWith('/goblinoids')) fragment = '#goblinoid-open-questions';
				if (route.endsWith('/taxonomy')) fragment = '#taxonomy-open-questions';
			}
			const defaultAnchor = consolidatedMonsterSources.get(route.replace('/wiki/', ''));
			const defaultFragment = defaultAnchor ? `#${defaultAnchor}` : '';
			return `${consolidated}${fragment || defaultFragment}`;
		}
		return `${route}${suffix}`;
	}

	const assetUrl = assetsByPath.get(repositoryPath);
	if (assetUrl) return assetUrl;

	if (/^(?:\.agents|apps|assets|docs|packages|skills|tools)\//.test(repositoryPath)) {
		return `https://github.com/jmoraispk/summonlab/blob/main/${repositoryPath}${suffix}`;
	}

	return target;
}

function renderMarkdown(source: string, sourcePath: string): string {
	const renderer = new Renderer();
	const usedHeadings = new Map<string, number>();

	renderer.heading = function ({ tokens, depth }) {
		const text = this.parser.parseInline(tokens);
		const base = headingSlug(text) || 'section';
		const count = usedHeadings.get(base) ?? 0;
		usedHeadings.set(base, count + 1);
		const id = count === 0 ? base : `${base}-${count + 1}`;
		return `<h${depth} id="${id}">${text}</h${depth}>`;
	};

	renderer.link = function ({ href, title, tokens }) {
		const target = resolveTarget(href, sourcePath);
		const resolved = target.startsWith('/wiki') ? `${base}${target}` : target;
		const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
		return `<a href="${escapeAttribute(resolved)}"${titleAttribute}>${this.parser.parseInline(tokens)}</a>`;
	};

	renderer.image = ({ href, title, text }) => {
		const target = resolveTarget(href, sourcePath);
		const resolved = target.startsWith('/wiki') ? `${base}${target}` : target;
		const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
		return `<img src="${escapeAttribute(resolved)}" alt="${escapeAttribute(text)}"${titleAttribute} loading="lazy" decoding="async">`;
	};

	renderer.html = ({ text }) => escapeAttribute(text);

	return marked.parse(source, { renderer, gfm: true, async: false });
}

const pages = catalog.entries
	.map((entry): WikiPage | null => {
		const sourcePath = entryPath(entry);
		const source = wikiByPath.get(sourcePath);
		if (!source) return null;
		const bodySource = source.replace(/^# [^\r\n]+(?:\r?\n){1,2}/u, '');
		return {
			wikiId: entry.wikiId,
			title: titleFromMarkdown(source),
			html: renderMarkdown(source, sourcePath),
			bodyHtml: renderMarkdown(bodySource, sourcePath),
			href: routeFromWikiPath(sourcePath),
			sourcePath,
			designStatus: entry.designStatus,
			implementationStatus: entry.implementationStatus,
			visualStatus: entry.visualStatus,
			spoilerScope: entry.spoilerScope,
			section: sectionFromPath(sourcePath),
			pageType: entry.pageType
		};
	})
	.filter((page): page is WikiPage => page !== null);

const pagesByHref = new Map(pages.map((page) => [page.href, page]));

function navigationSearchTerms(sourcePath: string): string {
	if (sourcePath === 'mechanics/progression/affinities.md') {
		return 'Fire Earth Wind Water Burn Weight Lacerate Chill Mist Lightning Sand Rot Magma Ice';
	}
	if (sourcePath === 'creatures/monster-races/README.md') {
		const headings = [...(wikiByPath.get(sourcePath) ?? '').matchAll(/^#{2,3}\s+(.+)$/gmu)].map(
			(match) => match[1]
		);
		const absorbedTitles = [...consolidatedMonsterSources.keys()].map(
			(slug) => pagesByHref.get(`/wiki/${slug}`)?.title ?? ''
		);
		return [...headings, ...absorbedTitles].join(' ');
	}
	if (sourcePath === 'creatures/monsters/README.md') {
		return pages
			.filter(
				(page) =>
					page.sourcePath.startsWith('creatures/monsters/') &&
					['monster-family', 'monster-entry'].includes(page.pageType)
			)
			.map((page) => `${page.title} ${path.basename(page.sourcePath, '.md').replaceAll('-', ' ')}`)
			.join(' ');
	}
	return '';
}

export function getWikiNavigation(): WikiNavigationEntry[] {
	return pages
		.filter(
			(page) =>
				page.spoilerScope !== 'internal' &&
				page.href !== '/wiki' &&
				!page.sourcePath.startsWith('milestones/') &&
				!page.sourcePath.startsWith('mechanics/affinities/') &&
				!(
					page.sourcePath.startsWith('creatures/monsters/') &&
					['monster-family', 'monster-entry'].includes(page.pageType)
				)
		)
		.map(({ title, href, sourcePath, section, designStatus, pageType }) => ({
			title,
			href,
			section,
			group: navigationGroupFromPath(sourcePath),
			designStatus,
			pageType,
			searchTerms: navigationSearchTerms(sourcePath)
		}))
		.sort((left, right) =>
			left.section === right.section
				? left.title.localeCompare(right.title)
				: left.section.localeCompare(right.section)
		);
}

export function getWikiPage(slug: string): WikiPage | null {
	return pagesByHref.get(`/wiki/${slug.replace(/^\/+|\/+$/g, '')}`) ?? null;
}

export function getWikiAsset(repositoryPath: string): string {
	const result = assetsByPath.get(repositoryPath);
	if (!result) throw new Error(`Wiki asset is not bundled: ${repositoryPath}`);
	return result;
}

export function getWikiPageCount(): number {
	return pages.length;
}
