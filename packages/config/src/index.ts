import { PolicyModeSchema } from '@summonlab/contracts';
import { z } from 'zod';

const EnvironmentSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
		HOST: z.string().min(1).default('0.0.0.0'),
		WEB_PORT: z.coerce.number().int().min(1).max(65_535).default(5173),
		WORKER_PORT: z.coerce.number().int().min(1).max(65_535).default(4174),
		LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
		DATABASE_URL: z
			.string()
			.url()
			.default('postgresql://summonlab:summonlab@127.0.0.1:54329/summonlab'),
		POLICY_MODE: PolicyModeSchema.default('scripted'),
		OPENAI_POLICY_MODEL: z.string().min(1).default('gpt-5-nano'),
		ENABLE_DEV_ROUTES: z.enum(['true', 'false']).optional(),
		SUMMONLAB_COMMIT_SHA: z.string().min(1).default('local')
	})
	.transform((value) => ({
		nodeEnvironment: value.NODE_ENV,
		host: value.HOST,
		webPort: value.WEB_PORT,
		workerPort: value.WORKER_PORT,
		logLevel: value.LOG_LEVEL,
		databaseUrl: value.DATABASE_URL,
		policyMode: value.POLICY_MODE,
		policyModel: value.OPENAI_POLICY_MODEL,
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
