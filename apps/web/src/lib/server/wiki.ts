import { marked, Renderer } from 'marked';
import path from 'node:path';

import catalog from '../../../../../docs/wiki/catalog.json';

const wikiSources = import.meta.glob('../../../../../docs/wiki/**/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const assetSources = import.meta.glob('../../../../../assets/**/*.{jpg,jpeg,png,svg,webp}', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

type CatalogEntry = (typeof catalog.entries)[number];

export interface WikiNavigationEntry {
	title: string;
	href: string;
	section: string;
	designStatus: string;
	pageType: string;
}

export interface WikiPage {
	wikiId: string;
	title: string;
	html: string;
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

function sectionFromPath(sourcePath: string): string {
	const first = sourcePath.split('/')[0];
	const labels: Record<string, string> = {
		art: 'Art book',
		creatures: 'Creatures',
		mechanics: 'Mechanics',
		milestones: 'Milestones',
		principles: 'Principles',
		roadmap: 'Roadmap',
		sources: 'Sources',
		systems: 'Systems',
		templates: 'Templates'
	};
	return labels[first] ?? 'Wiki';
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
		return `${routeFromWikiPath(repositoryPath.replace('docs/wiki/', ''))}${suffix}`;
	}

	const assetUrl = assetsByPath.get(repositoryPath);
	if (assetUrl) return assetUrl;

	if (/^(?:apps|assets|docs|packages|tools)\//.test(repositoryPath)) {
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
		const resolved = resolveTarget(href, sourcePath);
		const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
		return `<a href="${escapeAttribute(resolved)}"${titleAttribute}>${this.parser.parseInline(tokens)}</a>`;
	};

	renderer.image = ({ href, title, text }) => {
		const resolved = resolveTarget(href, sourcePath);
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
		return {
			wikiId: entry.wikiId,
			title: titleFromMarkdown(source),
			html: renderMarkdown(source, sourcePath),
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

export function getWikiNavigation(): WikiNavigationEntry[] {
	return pages
		.filter((page) => page.spoilerScope !== 'internal' && page.href !== '/wiki')
		.map(({ title, href, section, designStatus, pageType }) => ({
			title,
			href,
			section,
			designStatus,
			pageType
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
