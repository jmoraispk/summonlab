import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4177',
		port: 4177,
		reuseExistingServer: false,
		env: { ENABLE_DEV_ROUTES: 'true', ENABLE_IMAGE_GENERATION: 'false' }
	},
	testMatch: 'village.e2e.ts',
	workers: 1,
	use: {
		baseURL: 'http://127.0.0.1:4177',
		trace: 'retain-on-failure'
	}
});
