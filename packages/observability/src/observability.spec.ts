import { describe, expect, it } from 'vitest';

import { requestIdFromHeaders } from './index.js';

describe('request correlation', () => {
	it('preserves a valid caller request id', () => {
		const headers = new Headers({ 'x-request-id': 'playtest-request-42' });
		expect(requestIdFromHeaders(headers)).toBe('playtest-request-42');
	});

	it('replaces malformed request ids', () => {
		const requestId = requestIdFromHeaders(new Headers({ 'x-request-id': 'bad id' }));
		expect(requestId).toMatch(/^[0-9a-f-]{36}$/u);
	});
});
