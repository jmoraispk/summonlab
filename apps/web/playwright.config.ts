import { defineConfig } from '@playwright/test';

const serverPort = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? '4173', 10);

export default defineConfig({
	workers: 1,
	webServer: {
		command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${serverPort}`,
		port: serverPort,
		reuseExistingServer: !process.env.CI,
		env: { ENABLE_DEV_ROUTES: 'true', ENABLE_IMAGE_GENERATION: 'false' }
	},
	testMatch: '**/*.e2e.{ts,js}',
	use: {
		baseURL: `http://127.0.0.1:${serverPort}`,
		trace: 'retain-on-failure'
	}
});
