import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	SKILL_ICON_SUPERSESSION_REASON,
	SkillIconAssignmentPathSchema,
	SkillIconTargetPathSchema
} from '../packages/contracts/src/index.js';
import { IsoDateTimeSchema } from '../packages/contracts/src/shared.js';
import { persistSkillIconSupersededResult } from './persist-skill-icon-output.js';

export interface SupersedeSkillIconCliRequest {
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly supersedingTargetPath: string;
	readonly supersedingAssignmentPath: string;
	readonly reason: typeof SKILL_ICON_SUPERSESSION_REASON;
	readonly completedAt?: string;
}

function requiredOption(values: ReadonlyMap<string, string>, name: string): string {
	const value = values.get(name);
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

export function parseSupersedeSkillIconCliRequest(
	args: readonly string[]
): SupersedeSkillIconCliRequest {
	const allowed = new Set([
		'--target',
		'--assignment',
		'--superseding-target',
		'--superseding-assignment',
		'--reason',
		'--completed-at'
	]);
	const values = new Map<string, string>();
	for (let index = 0; index < args.length; index += 2) {
		const flag = args[index];
		const value = args[index + 1];
		if (!flag || !allowed.has(flag) || !value)
			throw new Error(`Unknown or incomplete argument: ${flag ?? '<missing>'}`);
		if (values.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
		values.set(flag, value);
	}
	const reason = requiredOption(values, '--reason');
	if (reason !== SKILL_ICON_SUPERSESSION_REASON)
		throw new Error(`--reason must be ${SKILL_ICON_SUPERSESSION_REASON}`);
	const completedAt = values.get('--completed-at');
	return {
		targetPath: SkillIconTargetPathSchema.parse(requiredOption(values, '--target')),
		assignmentPath: SkillIconAssignmentPathSchema.parse(requiredOption(values, '--assignment')),
		supersedingTargetPath: SkillIconTargetPathSchema.parse(
			requiredOption(values, '--superseding-target')
		),
		supersedingAssignmentPath: SkillIconAssignmentPathSchema.parse(
			requiredOption(values, '--superseding-assignment')
		),
		reason,
		...(completedAt === undefined ? {} : { completedAt: IsoDateTimeSchema.parse(completedAt) })
	};
}

export async function runSupersedeSkillIconCli(
	args: readonly string[],
	root = process.cwd(),
	now = () => new Date()
): Promise<void> {
	const request = parseSupersedeSkillIconCliRequest(args);
	const result = await persistSkillIconSupersededResult({
		root,
		targetPath: request.targetPath,
		assignmentPath: request.assignmentPath,
		supersedingTargetPath: request.supersedingTargetPath,
		supersedingAssignmentPath: request.supersedingAssignmentPath,
		reason: request.reason,
		completedAt: request.completedAt ?? now().toISOString()
	});
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	runSupersedeSkillIconCli(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
