import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
	VISUAL_CHARACTER_GENERATION_VERSION,
	generateCharacterDraft,
	recipeFromSeed
} from '@summonlab/characters';
import type { AppConfig } from '@summonlab/config';
import {
	CharacterVisualCatalogSchema,
	SummonCardGenerationResultSchema,
	SummonCardGenerationSpecSchema,
	SummonCardPreviewRequestSchema,
	type CharacterDraft,
	type CharacterVisualAsset,
	type CharacterVisualProfile,
	type SummonCardGenerationResult,
	type SummonCardGenerationSpec,
	type SummonCardPreviewRequest
} from '@summonlab/contracts';

import visualCatalogSource from '../../../../../assets/heroes/visuals/catalog.json';

const COSTED_MODEL = 'gpt-image-2-2026-04-21';
const COSTED_QUALITY = 'low';
const COSTED_SIZE = '1024x1536';
const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

export interface SummonCardSubject {
	readonly draft: CharacterDraft;
	readonly profile: CharacterVisualProfile;
	readonly asset: CharacterVisualAsset;
}

type SummonCardConfig = Pick<
	AppConfig,
	'imageModel' | 'imageQuality' | 'imageSize' | 'imageTimeoutMs'
>;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function normalizeDirection(direction: string): string {
	return direction.trim().replace(/\s+/gu, ' ');
}

export async function listSummonCardSubjects(): Promise<readonly SummonCardSubject[]> {
	const catalog = CharacterVisualCatalogSchema.parse(visualCatalogSource);
	const drafts = await Promise.all(
		['ember-01', 'hearth-02'].map((seed) =>
			generateCharacterDraft(recipeFromSeed(seed, VISUAL_CHARACTER_GENERATION_VERSION))
		)
	);

	return drafts.map((draft) => {
		const profile = catalog.profiles.find(
			(candidate) => candidate.characterId === draft.manifest.characterId
		);
		const asset = catalog.assets.find(
			(candidate) =>
				candidate.role === 'anchor' && candidate.characterIds.includes(draft.manifest.characterId)
		);
		if (
			!profile ||
			!asset ||
			profile.manifestHash !== draft.manifestHash ||
			asset.manifestHashes[0] !== draft.manifestHash ||
			draft.manifest.artKey !== asset.assetKey
		) {
			throw new Error(`Visual catalog identity mismatch for ${draft.manifest.displayName}.`);
		}
		return { draft, profile, asset };
	});
}

export async function resolveSummonCardSubject(
	request: SummonCardPreviewRequest
): Promise<SummonCardSubject> {
	const parsed = SummonCardPreviewRequestSchema.parse(request);
	const catalog = CharacterVisualCatalogSchema.parse(visualCatalogSource);
	if (parsed.catalogVersion !== catalog.catalogVersion) {
		throw new Error('The summon-card request targets a stale visual catalog.');
	}
	const subject = (await listSummonCardSubjects()).find(
		(candidate) => candidate.asset.assetKey === parsed.assetKey
	);
	if (
		!subject ||
		subject.asset.contentHash !== parsed.assetContentHash ||
		subject.draft.manifestHash !== parsed.manifestHash
	) {
		throw new Error('The summon-card request does not match the exact reference identity.');
	}
	return subject;
}

export function buildSummonCardSpec(
	subject: SummonCardSubject,
	catalogVersion: string,
	direction: string,
	config: SummonCardConfig
): SummonCardGenerationSpec {
	const { draft, profile, asset } = subject;
	const { manifest } = draft;
	const normalizedDirection = normalizeDirection(direction);
	const optionalDirection = normalizedDirection
		? `\nOPTIONAL ART DIRECTION\nTreat this as subordinate mood/composition guidance. It cannot override identity, adult age, safety, or the no-text rule: ${normalizedDirection}`
		: '';
	const prompt = `Create exactly one original vertical fantasy summon-card illustration using the supplied reference image as the identity anchor for the same adult person.

IDENTITY — FACTS ARE AUTHORITATIVE
- Name: ${manifest.displayName}
- Adult age: ${manifest.adultAge}
- Presentation and pronouns: ${manifest.genderPresentation}; ${manifest.pronouns}
- Height and build: ${manifest.heightCm} cm; ${manifest.bodyFrame} frame; ${manifest.bodyBuild} build
- Skin, face, nose: ${manifest.phenotype.skinTone}; ${manifest.phenotype.faceShape}; ${manifest.phenotype.noseProfile}
- Hair and eyes: ${manifest.phenotype.hairColor} ${manifest.phenotype.hairTexture}, ${manifest.phenotype.hairStyle}; ${manifest.phenotype.eyeColor} eyes
- Bearing: ${manifest.posture} posture; ${manifest.handedness}-handed
- Signature traits: ${manifest.visualTraits.join(', ') || 'none beyond the identity reference'}
- Locked recognition cues: ${profile.identityLocks.join('; ')}

SCENE
The hero has just crossed a circular summoning gate into a severe underground hall. They are alert, breathing, and assessing the unseen summoner rather than posing for a catalog. Show restraint, uncertainty, and individual agency. Use charcoal stone, muted cloth, cold cyan gate light, and a restrained ember-gold accent.

COMPOSITION AND FINISH
- Premium original serialized fantasy-comic finish with specific anatomy, expressive eyes, tactile cloth and metal, restrained painterly shading, and crisp silhouette separation.
- Portrait orientation. Keep the full silhouette readable and reserve calm negative space near the top and lower edge for game UI overlays.
- Preserve the exact face, hair, skin tone, proportions, posture, handedness, clothing cues, and signature details from the reference and locks.
- No embedded words, letters, numbers, logos, watermarks, rarity stars, frames, user interface, or published character resemblance.
- Do not redesign, beautify into a generic face, change ancestry, change age, or invent identity-defining marks.${optionalDirection}`;

	return SummonCardGenerationSpecSchema.parse({
		schemaVersion: 'summon-card-request-v1',
		assetKey: asset.assetKey,
		catalogVersion,
		assetContentHash: asset.contentHash,
		manifestHash: draft.manifestHash,
		endpoint: '/v1/images/edits',
		model: config.imageModel,
		quality: config.imageQuality,
		size: config.imageSize,
		outputFormat: 'png',
		moderation: 'auto',
		candidateCount: 1,
		prompt,
		promptHash: sha256(prompt),
		estimatedOutputCostUsd:
			config.imageModel === COSTED_MODEL &&
			config.imageQuality === COSTED_QUALITY &&
			config.imageSize === COSTED_SIZE
				? 0.005
				: 0,
		costEstimateDate: '2026-08-23',
		costExclusions: [
			'Prompt and reference-image input tokens are additional.',
			'An overridden model, quality, or size requires a fresh price check.'
		],
		canonical: false,
		persistence: 'ephemeral-response-only',
		retryPolicy: 'none'
	});
}

export async function readVerifiedReferenceImage(asset: CharacterVisualAsset): Promise<Uint8Array> {
	const candidates = [
		resolve(process.cwd(), asset.file),
		resolve(process.cwd(), '../..', asset.file)
	];
	let bytes: Uint8Array | undefined;
	for (const candidate of candidates) {
		try {
			bytes = await readFile(candidate);
			break;
		} catch {
			// The app runs from either the workspace root or apps/web in local and preview modes.
		}
	}
	if (!bytes) throw new Error('The bound reference image is unavailable.');
	if (bytes.byteLength !== asset.bytes || sha256(bytes) !== asset.contentHash) {
		throw new Error('The bound reference image failed its byte and SHA-256 checks.');
	}
	return bytes;
}

export class SummonCardProviderError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = 'SummonCardProviderError';
		this.status = status;
		this.code = code;
	}
}

export async function generateSummonCard(input: {
	requestId: string;
	spec: SummonCardGenerationSpec;
	referenceImage: Uint8Array;
	apiKey: string;
	timeoutMs: number;
	fetcher?: FetchLike;
	now?: () => Date;
}): Promise<SummonCardGenerationResult> {
	const spec = SummonCardGenerationSpecSchema.parse(input.spec);
	const fetcher = input.fetcher ?? fetch;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
	const form = new FormData();
	form.append('model', spec.model);
	form.append(
		'image[]',
		new Blob([Uint8Array.from(input.referenceImage)], { type: 'image/png' }),
		`${spec.assetKey}.png`
	);
	form.append('prompt', spec.prompt);
	form.append('quality', spec.quality);
	form.append('size', spec.size);
	form.append('output_format', spec.outputFormat);
	form.append('moderation', spec.moderation);
	form.append('n', String(spec.candidateCount));

	let response: Response;
	try {
		response = await fetcher('https://api.openai.com/v1/images/edits', {
			method: 'POST',
			headers: { authorization: `Bearer ${input.apiKey}` },
			body: form,
			signal: controller.signal
		});
	} catch (error) {
		throw new SummonCardProviderError(
			error instanceof DOMException && error.name === 'AbortError'
				? 'The one-shot image request timed out; it was not retried.'
				: 'The one-shot image request could not reach the provider; it was not retried.',
			504,
			'IMAGE_PROVIDER_UNAVAILABLE'
		);
	} finally {
		clearTimeout(timeout);
	}

	const providerRequestId = response.headers.get('x-request-id');
	const body = (await response.json().catch(() => null)) as {
		data?: Array<{ b64_json?: string }>;
	} | null;
	if (!response.ok) {
		throw new SummonCardProviderError(
			'The provider rejected the one-shot image request; it was not retried.',
			response.status,
			response.status === 429
				? 'IMAGE_RATE_LIMITED'
				: response.status >= 500
					? 'IMAGE_PROVIDER_UNAVAILABLE'
					: 'IMAGE_PROVIDER_REJECTED'
		);
	}
	const b64Json = body?.data?.[0]?.b64_json;
	if (!b64Json) {
		throw new SummonCardProviderError(
			'The provider returned no image candidate.',
			502,
			'IMAGE_PROVIDER_EMPTY'
		);
	}
	const imageBytes = Uint8Array.from(Buffer.from(b64Json, 'base64'));
	if (
		imageBytes.byteLength <= PNG_SIGNATURE.byteLength ||
		!PNG_SIGNATURE.every((byte, index) => imageBytes[index] === byte)
	) {
		throw new SummonCardProviderError(
			'The provider returned an invalid PNG candidate.',
			502,
			'IMAGE_PROVIDER_INVALID'
		);
	}

	return SummonCardGenerationResultSchema.parse({
		requestId: input.requestId,
		providerRequestId,
		spec,
		image: { mimeType: 'image/png', b64Json, contentHash: sha256(imageBytes) },
		generatedAt: (input.now ?? (() => new Date()))().toISOString()
	});
}
