import {
	buildEquipmentApprovedPromotionPlan,
	checkEquipmentApprovedSources,
	equipmentApprovedPromotionPlanSha256,
	writeEquipmentApprovedSources
} from './equipment-approved-source-promotion.js';

function option(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value || value.startsWith('--')) throw new Error(`Missing ${name}`);
	return value;
}

const modes = ['--plan', '--write', '--check'].filter((mode) => process.argv.includes(mode));
if (modes.length !== 1) {
	throw new Error('Choose exactly one promotion mode: --plan, --write, or --check');
}

if (modes[0] === '--plan') {
	const plan = await buildEquipmentApprovedPromotionPlan();
	process.stdout.write(
		`${JSON.stringify(
			{
				schemaVersion: plan.schemaVersion,
				planCanonicalSha256: equipmentApprovedPromotionPlanSha256(plan),
				summary: plan.summary,
				selectionPaths: {
					base: plan.entries.filter(({ candidate }) => candidate.path.includes('/candidates/'))
						.length,
					revised: plan.entries.filter(({ candidate }) => candidate.path.includes('/revisions/'))
						.length
				},
				plannedPaths: plan.entries.map(({ approved }) => approved.path)
			},
			null,
			2
		)}\n`
	);
} else if (modes[0] === '--write') {
	const result = await writeEquipmentApprovedSources({
		expectedPlanSha256: option('--expected-plan-sha256'),
		createdAt: option('--created-at'),
		createdBy: option('--created-by')
	});
	process.stdout.write(
		`${JSON.stringify(
			{
				created: result.manifest.summary.total,
				manifest: result.receipt.approvedManifest,
				receiptId: result.receipt.receiptId
			},
			null,
			2
		)}\n`
	);
} else {
	process.stdout.write(`${JSON.stringify(await checkEquipmentApprovedSources(), null, 2)}\n`);
}
