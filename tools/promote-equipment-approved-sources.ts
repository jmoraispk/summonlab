import { checkEquipmentApprovedSources } from './equipment-approved-source-promotion.js';

if (process.argv.length !== 3 || !process.argv.includes('--check')) {
	throw new Error('The promoted Equipment catalog is immutable; pass exactly --check');
}

process.stdout.write(`${JSON.stringify(await checkEquipmentApprovedSources(), null, 2)}\n`);
