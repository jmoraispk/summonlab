import { describe, expect, it } from 'vitest';

import { match } from './city';

describe('city route matcher', () => {
	it.each(['village', 'residents', 'tower', 'inventory', 'missions'])(
		'accepts %s',
		(mode) => expect(match(mode)).toBe(true)
	);

	it.each(['play', 'settlement-lab', 'living-village-lab', 'Village', ''])(
		'rejects %s',
		(mode) => expect(match(mode)).toBe(false)
	);
});
