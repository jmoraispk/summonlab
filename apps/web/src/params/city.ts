import { CITY_MODES } from '$lib/city';

const modes = new Set<string>(CITY_MODES.map(({ id }) => id));

export function match(value: string): boolean {
	return modes.has(value);
}
