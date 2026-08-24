export class IllegalActionError extends Error {
	public readonly code = 'ILLEGAL_ACTION';

	public constructor(
		actionId: string,
		public readonly legalActionIds: readonly string[] = []
	) {
		super(`Action is not legal in the current state: ${actionId}`);
		this.name = 'IllegalActionError';
	}
}

export class StaleStateVersionError extends Error {
	public readonly code = 'STALE_RUN_VERSION';

	public constructor(
		public readonly expectedVersion: number,
		public readonly latestVersion: number
	) {
		super(`Command expected run version ${expectedVersion}, but latest is ${latestVersion}`);
		this.name = 'StaleStateVersionError';
	}
}

export class ReplayIntegrityError extends Error {
	public constructor(
		message: string,
		public readonly sequence: number
	) {
		super(message);
		this.name = 'ReplayIntegrityError';
	}
}
