import { z } from 'zod'

const envSchema = z.object({
  MSSQL_HOST: z.string().min(1),
  MSSQL_PORT: z.coerce.number().default(1433),
  MSSQL_DATABASE: z.string().min(1),
  MSSQL_USER: z.string().min(1),
  MSSQL_PASSWORD: z.string().min(1),
  DATABASE_URL: z.string().url(),
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  GEMINI_API_KEY: z.string().min(1),
  NEXT_PUBLIC_LINE_LIFF_ID: z.string().min(1),
  MOCK_MODE: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean()).default(false),
})

const mockEnvSchema = z.object({
  MSSQL_HOST: z.string().default('localhost'),
  MSSQL_PORT: z.coerce.number().default(1433),
  MSSQL_DATABASE: z.string().default('mock_db'),
  MSSQL_USER: z.string().default('sa'),
  MSSQL_PASSWORD: z.string().default(''),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/ev7db'),
  LINE_CHANNEL_SECRET: z.string().default('mock_secret'),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().default('mock_token'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  GEMINI_API_KEY: z.string().default('mock_gemini_key'),
  NEXT_PUBLIC_LINE_LIFF_ID: z.string().default('mock_liff_id'),
  MOCK_MODE: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean()).default(true),
})

const isMock = process.env.MOCK_MODE === 'true'
export const env = isMock ? mockEnvSchema.parse(process.env) : envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
