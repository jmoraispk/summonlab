import { defineConfig } from '@playwright/test';

export default defineConfig({
	workers: 1,
	testDir: './tests',
	testMatch: '**/*.e2e.ts',
	webServer: {
		command: 'pnpm build && pnpm preview --host 0.0.0.0 --port 5189',
		port: 5189,
		reuseExistingServer: !process.env.CI
	},
	use: { baseURL: 'http://127.0.0.1:5189', trace: 'retain-on-failure' }
});
