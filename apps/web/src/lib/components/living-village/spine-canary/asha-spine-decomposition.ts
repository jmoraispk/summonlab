export const ASHA_EXPLORATION_VISIBLE_HEIGHT = 84;
export const ASHA_SPINE_DECOMPOSITION_STATUS = 'candidate' as const;

const REVIEW_ROOT = '/review/asha-spine-decomposition/v2-r2';

export type AshaDecompositionAssets = Readonly<{
	source: string;
	bodyCore: string;
	nearArm: string;
	braid: string;
	nearArmMask: string;
	braidMask: string;
	recomposed: string;
	keyedRepair: string;
	reviewDescriptor: string;
}>;

export function decompositionAssets(version: 2): AshaDecompositionAssets {
	if (version !== 2) throw new Error(`unsupported Asha decomposition review version: ${version}`);
	return {
		source: '/runtime/combat/realtime-study-v1/hero-saffron-braid-ready-v1.png',
		bodyCore: `${REVIEW_ROOT}/body-core.png`,
		nearArm: `${REVIEW_ROOT}/near-arm.png`,
		braid: `${REVIEW_ROOT}/braid.png`,
		nearArmMask: `${REVIEW_ROOT}/near-arm-mask.png`,
		braidMask: `${REVIEW_ROOT}/braid-mask.png`,
		recomposed: `${REVIEW_ROOT}/asha-setup-v2-r2.png`,
		keyedRepair: `${REVIEW_ROOT}/body-repair-v2-rgba.png`,
		reviewDescriptor: `${REVIEW_ROOT}/review.json`
	};
}
