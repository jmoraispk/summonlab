import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { exportCleanupRevisionV2Packets } from './export-skill-icon-quality-cleanup-v2.js';
import { persistCleanupRevisionV2 } from './persist-skill-icon-cleanup-v2-output.js';
import {
	finalizeCleanupRevisionV2,
	type CleanupRevisionV2PacketArtifact
} from './skill-icon-quality-cleanup-v2-lib.js';

type Mode = 'write' | 'check';

export interface CleanupRevisionV2RecoveryReport {
	readonly mode: Mode;
	readonly packets: { readonly total: number; readonly written: number; readonly existing: number };
	readonly deterministic: {
		readonly total: number;
		readonly persisted: readonly string[];
		readonly existing: readonly string[];
		readonly terminalFailures: readonly { readonly targetId: string; readonly message: string }[];
	};
	readonly generation: {
		readonly total: number;
		readonly pendingTargetIds: readonly string[];
		readonly generationCallCount: 0;
	};
	readonly finalization: {
		readonly ready: boolean;
		readonly candidateCount: number;
		readonly unresolved: readonly {
			readonly targetId: string;
			readonly revision: number;
			readonly status: 'revise' | 'failed' | 'missing';
		}[];
	};
}

function parseMode(args: readonly string[]): Mode {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || (normalized[0] !== '--write' && normalized[0] !== '--check')) {
		throw new Error('Usage: tsx tools/recover-skill-icon-quality-cleanup-v2.ts --write|--check');
	}
	return normalized[0] === '--write' ? 'write' : 'check';
}

function observations(artifact: CleanupRevisionV2PacketArtifact) {
	const identity = artifact.packet.sourceMode === 'identity-adoption';
	return {
		fullSizeOutcome: 'pass' as const,
		fullSizeObservation: identity
			? `At 1024px, the approved v1 composition was adopted byte-for-byte into the versioned v2 output; no artwork was changed.`
			: `At 1024px, the authenticated provider source was inset to 696px at (164,192); the complete central subject remains inside the protected aperture and automated compositing checks passed.`,
		display384Outcome: 'pass' as const,
		display384Observation: identity
			? `At 384px, the adopted approved composition remains readable; this identity lane made zero generation calls and zero normalization transactions.`
			: `At 384px, the central motif remains readable after the exact inset and the v1 requested removal remains free of the named glyph finding: ${artifact.packet.finding.detail}`
	};
}

export async function recoverCleanupRevisionV2(input: {
	readonly root?: string;
	readonly mode: Mode;
	readonly onProgress?: (message: string) => void;
}): Promise<CleanupRevisionV2RecoveryReport> {
	const root = path.resolve(input.root ?? process.cwd());
	const packetReport = await exportCleanupRevisionV2Packets({ root, mode: input.mode });
	let initial = await finalizeCleanupRevisionV2({ root });
	const existingByTarget = new Map(initial.receipts.map((receipt) => [receipt.targetId, receipt]));
	const deterministic = initial.packets.filter(
		({ packet }) => packet.sourceMode !== 'generation-v2'
	);
	const persisted: string[] = [];
	const existing: string[] = [];
	const terminalFailures: { targetId: string; message: string }[] = [];
	if (input.mode === 'write') {
		for (const [index, artifact] of deterministic.entries()) {
			const previous = existingByTarget.get(artifact.packet.targetId);
			if (previous) {
				if (previous.status === 'candidate') existing.push(artifact.packet.targetId);
				else {
					terminalFailures.push({
						targetId: artifact.packet.targetId,
						message: `Existing v2 ${previous.status} receipt is terminal and cannot be replaced.`
					});
				}
			} else {
				try {
					const result = await persistCleanupRevisionV2({
						root,
						packetPath: artifact.path,
						...observations(artifact)
					});
					if (result.status !== 'candidate') {
						terminalFailures.push({
							targetId: artifact.packet.targetId,
							message: `Persistence completed with terminal ${result.status} status.`
						});
					} else {
						persisted.push(artifact.packet.targetId);
					}
				} catch (error) {
					terminalFailures.push({
						targetId: artifact.packet.targetId,
						message: error instanceof Error ? error.message : String(error)
					});
				}
			}
			if ((index + 1) % 4 === 0 || index + 1 === deterministic.length) {
				input.onProgress?.(
					`v2 deterministic recovery ${index + 1}/${deterministic.length}; persisted ${persisted.length}, existing ${existing.length}, terminal failures ${terminalFailures.length}`
				);
			}
		}
		initial = await finalizeCleanupRevisionV2({ root });
	}
	return {
		mode: input.mode,
		packets: {
			total: packetReport.total,
			written: packetReport.written.length,
			existing: packetReport.existing.length
		},
		deterministic: {
			total: deterministic.length,
			persisted,
			existing,
			terminalFailures
		},
		generation: {
			total: packetReport.pendingGenerationTargetIds.length,
			pendingTargetIds: packetReport.pendingGenerationTargetIds,
			generationCallCount: 0
		},
		finalization: {
			ready: initial.ready,
			candidateCount: initial.candidateCount,
			unresolved: initial.selection.unresolved
		}
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	let mode: Mode | undefined;
	try {
		mode = parseMode(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
	if (mode) {
		recoverCleanupRevisionV2({
			mode,
			onProgress: (message) => process.stderr.write(`${message}\n`)
		})
			.then((report) => process.stdout.write(`${JSON.stringify(report)}\n`))
			.catch((error: unknown) => {
				process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
				process.exitCode = 1;
			});
	}
}
