import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export function canonicalJson(value: unknown): string {
	if (value === null) return 'null';
	if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new Error('Canonical JSON cannot encode non-finite numbers');
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort((left, right) => left.localeCompare(right))
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
			.join(',')}}`;
	}
	throw new Error(`Canonical JSON cannot encode ${typeof value}`);
}

export function sha256Hex(value: string | Uint8Array): string {
	return bytesToHex(sha256(typeof value === 'string' ? new TextEncoder().encode(value) : value));
}

export function hashCanonical(value: unknown): string {
	return sha256Hex(canonicalJson(value));
}

export function deterministicUuid(value: string): string {
	const bytes = sha256(new TextEncoder().encode(value)).slice(0, 16);
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = bytesToHex(bytes);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const EMPTY_STATE_HASH = sha256Hex('null');
