import { getConfig } from '@summonlab/config';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ enabled: getConfig().devRoutesEnabled });
