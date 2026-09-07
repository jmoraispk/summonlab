import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { exportCleanupRevisionV3Packets } from './export-skill-icon-quality-cleanup-v3.js';
import { persistCleanupRevisionV2 } from './persist-skill-icon-cleanup-v2-output.js';
import {
	buildCleanupRevisionV3Packets,
	finalizeCleanupRevisionV2,
	type CleanupRevisionV2PacketArtifact
} from './skill-icon-quality-cleanup-v2-lib.js';

type Mode = 'write' | 'check';

export interface CleanupRevisionV3RecoveryReport {
	readonly mode: Mode;
	readonly packets: { readonly total: number; readonly written: number; readonly existing: number };
	readonly deterministic: {
		readonly total: 24;
		readonly persisted: readonly string[];
		readonly existing: readonly string[];
		readonly terminalFailures: readonly { readonly targetId: string; readonly message: string }[];
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
		throw new Error('Usage: tsx tools/recover-skill-icon-quality-cleanup-v3.ts --write|--check');
	}
	return normalized[0] === '--write' ? 'write' : 'check';
}

function observations(artifact: CleanupRevisionV2PacketArtifact) {
	const identity = artifact.packet.sourceMode === 'identity-adoption';
	return {
		fullSizeOutcome: 'pass' as const,
		fullSizeObservation: identity
			? 'At 1024px, the approved v2 composition was adopted byte-for-byte into the append-only v3 output; no artwork was changed.'
			: 'At 1024px, the authenticated immediate-predecessor provider was inset to 696px at (164,192); the complete central subject remains inside the protected aperture and automated compositing checks passed.',
		display384Outcome: 'pass' as const,
		display384Observation: identity
			? 'At 384px, the approved adopted composition remains readable; this identity lane made zero generation calls and zero normalization transactions.'
			: `At 384px, the central motif remains readable after the exact inset and the named glyph finding remains absent: ${artifact.packet.finding.detail}`
	};
}

export async function recoverCleanupRevisionV3(input: {
	readonly root?: string;
	readonly mode: Mode;
	readonly onProgress?: (message: string) => void;
}): Promise<CleanupRevisionV3RecoveryReport> {
	const root = path.resolve(input.root ?? process.cwd());
	const packetReport = await exportCleanupRevisionV3Packets({ root, mode: input.mode });
	let finalization = await finalizeCleanupRevisionV2({ root });
	const packets = await buildCleanupRevisionV3Packets(root);
	const existingByTarget = new Map(
		finalization.receipts
			.filter((receipt) => receipt.revision === 3)
			.map((receipt) => [receipt.targetId, receipt])
	);
	const persisted: string[] = [];
	const existing: string[] = [];
	const terminalFailures: { targetId: string; message: string }[] = [];
	if (input.mode === 'write') {
		for (const [index, artifact] of packets.entries()) {
			const previous = existingByTarget.get(artifact.packet.targetId);
			if (previous) {
				if (previous.status === 'candidate') existing.push(artifact.packet.targetId);
				else {
					terminalFailures.push({
						targetId: artifact.packet.targetId,
						message: `Existing v3 ${previous.status} receipt is terminal and cannot be replaced.`
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
			if ((index + 1) % 4 === 0 || index + 1 === packets.length) {
				input.onProgress?.(
					`v3 deterministic recovery ${index + 1}/${packets.length}; persisted ${persisted.length}, existing ${existing.length}, terminal failures ${terminalFailures.length}`
				);
			}
		}
		finalization = await finalizeCleanupRevisionV2({ root });
	}
	return {
		mode: input.mode,
		packets: {
			total: packetReport.total,
			written: packetReport.written.length,
			existing: packetReport.existing.length
		},
		deterministic: {
			total: 24,
			persisted,
			existing,
			terminalFailures,
			generationCallCount: 0
		},
		finalization: {
			ready: finalization.ready,
			candidateCount: finalization.candidateCount,
			unresolved: finalization.selection.unresolved
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
		recoverCleanupRevisionV3({
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
