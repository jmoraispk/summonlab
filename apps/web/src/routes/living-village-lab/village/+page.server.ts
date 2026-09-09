import { cityScreenFixture } from '$lib/components/city/city-screen.fixture';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ city: await cityScreenFixture() });
