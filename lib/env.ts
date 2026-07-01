import { z } from 'zod'

const envSchema = z.object({
  MSSQL_HOST: z.string().min(1),
  MSSQL_PORT: z.coerce.number().default(1433),
  MSSQL_DATABASE: z.string().min(1),
  MSSQL_USER: z.string().min(1),
  MSSQL_PASSWORD: z.string().min(1),
  MSSQL_WRITE_USER: z.string().optional(),
  MSSQL_WRITE_PASSWORD: z.string().optional(),
  DATABASE_URL: z.string().url(),
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  GEMINI_API_KEY: z.string().min(1),
  NEXT_PUBLIC_LINE_LIFF_ID: z.string().min(1),
  CRON_SECRET: z.string().default(''),
  MOCK_MODE: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean()).default(false),
  SPACES_ENDPOINT: z.string().url(),
  SPACES_REGION: z.string().min(1),
  SPACES_KEY: z.string().min(1),
  SPACES_SECRET: z.string().min(1),
  SPACES_BUCKET: z.string().min(1),
})

const mockEnvSchema = z.object({
  MSSQL_HOST: z.string().default('localhost'),
  MSSQL_PORT: z.coerce.number().default(1433),
  MSSQL_DATABASE: z.string().default('mock_db'),
  MSSQL_USER: z.string().default('sa'),
  MSSQL_PASSWORD: z.string().default(''),
  MSSQL_WRITE_USER: z.string().optional(),
  MSSQL_WRITE_PASSWORD: z.string().optional(),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/ev7db'),
  LINE_CHANNEL_SECRET: z.string().default('mock_secret'),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().default('mock_token'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  GEMINI_API_KEY: z.string().default('mock_gemini_key'),
  NEXT_PUBLIC_LINE_LIFF_ID: z.string().default('mock_liff_id'),
  CRON_SECRET: z.string().default('mock_cron_secret'),
  MOCK_MODE: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean()).default(true),
  SPACES_ENDPOINT: z.string().url().default('https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com'),
  SPACES_REGION: z.string().default('sgp1'),
  SPACES_KEY: z.string().default('mock_key'),
  SPACES_SECRET: z.string().default('mock_secret'),
  SPACES_BUCKET: z.string().default('mock_bucket'),
})

const isBuildPhase = process.env.npm_lifecycle_event === 'build' || process.env.NEXT_PHASE === 'phase-production-build'

function createEnv() {
  if (isBuildPhase) {
    return new Proxy({} as z.infer<typeof envSchema>, {
      get(target, prop) {
        if (typeof prop !== 'string') return undefined;
        return process.env[prop] || 'dummy-build-value';
      }
    });
  }

  const isMock = process.env.MOCK_MODE === 'true'
  return isMock ? mockEnvSchema.parse(process.env) : envSchema.parse(process.env)
}

export const env = createEnv()
export type Env = z.infer<typeof envSchema>
