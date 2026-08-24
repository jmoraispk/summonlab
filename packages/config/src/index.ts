import { ClockSpeedSchema, PolicyModeSchema } from '@summonlab/contracts';
import { z } from 'zod';

const EnvironmentSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
		HOST: z.string().min(1).default('0.0.0.0'),
		WEB_PORT: z.coerce.number().int().min(1).max(65_535).default(5173),
		WORKER_PORT: z.coerce.number().int().min(1).max(65_535).default(4174),
		SIMULATION_SPEED: z.coerce.number().pipe(ClockSpeedSchema).default(4),
		CATCH_UP_POLL_MS: z.coerce.number().int().min(250).max(60_000).default(1_000),
		LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
		DATABASE_URL: z
			.string()
			.url()
			.default('postgresql://summonlab:summonlab@127.0.0.1:54329/summonlab'),
		POLICY_MODE: PolicyModeSchema.default('scripted'),
		OPENAI_POLICY_MODEL: z.string().min(1).default('gpt-5-nano'),
		ENABLE_IMAGE_GENERATION: z.enum(['true', 'false']).default('false'),
		OPENAI_API_KEY: z.string().min(1).optional(),
		OPENAI_IMAGE_MODEL: z.string().min(1).default('gpt-image-2-2026-04-21'),
		OPENAI_IMAGE_QUALITY: z.enum(['low', 'medium', 'high']).default('low'),
		OPENAI_IMAGE_SIZE: z.enum(['1024x1024', '1024x1536', '1536x1024']).default('1024x1536'),
		OPENAI_IMAGE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(180_000).default(120_000),
		ENABLE_DEV_ROUTES: z.enum(['true', 'false']).optional(),
		SUMMONLAB_COMMIT_SHA: z.string().min(1).default('local')
	})
	.transform((value) => ({
		nodeEnvironment: value.NODE_ENV,
		host: value.HOST,
		webPort: value.WEB_PORT,
		workerPort: value.WORKER_PORT,
		simulationSpeed: value.SIMULATION_SPEED,
		catchUpPollMs: value.CATCH_UP_POLL_MS,
		logLevel: value.LOG_LEVEL,
		databaseUrl: value.DATABASE_URL,
		policyMode: value.POLICY_MODE,
		policyModel: value.OPENAI_POLICY_MODEL,
		imageGenerationEnabled: value.ENABLE_IMAGE_GENERATION === 'true',
		openAiApiKey: value.OPENAI_API_KEY,
		imageModel: value.OPENAI_IMAGE_MODEL,
		imageQuality: value.OPENAI_IMAGE_QUALITY,
		imageSize: value.OPENAI_IMAGE_SIZE,
		imageTimeoutMs: value.OPENAI_IMAGE_TIMEOUT_MS,
		devRoutesEnabled:
			value.ENABLE_DEV_ROUTES === undefined
				? value.NODE_ENV !== 'production'
				: value.ENABLE_DEV_ROUTES === 'true',
		commit: value.SUMMONLAB_COMMIT_SHA
	}));

export type AppConfig = z.output<typeof EnvironmentSchema>;
export type EnvironmentSource = Record<string, string | undefined>;

let cachedConfig: AppConfig | undefined;

export function parseConfig(source: EnvironmentSource): AppConfig {
	return EnvironmentSchema.parse(source);
}

export function getConfig(): AppConfig {
	cachedConfig ??= parseConfig(process.env);
	return cachedConfig;
}

export function resetConfigForTests(): void {
	cachedConfig = undefined;
}
