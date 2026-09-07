export function createMotionPack(source: string) {
	const version = source.match(/-motion-v(\d+)\.json$/)?.[1];
	if (!version) throw new Error(`Expected a versioned motion-pack URL: ${source}`);
	return { source, version: Number(version) } as const;
}

export function motionPackVersionDiagnostic(
	bindings: readonly { motionPackId: string; version: number }[]
): string {
	const seen = new Set<string>();
	return bindings
		.filter((binding) => {
			if (seen.has(binding.motionPackId)) return false;
			seen.add(binding.motionPackId);
			return true;
		})
		.map((binding) => `${binding.motionPackId}:${binding.version}`)
		.join(',');
}
