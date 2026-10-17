import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.integration.spec.ts'],
		// Fault-injection suites install database-wide triggers.
		fileParallelism: false,
		testTimeout: 20_000
	}
});
