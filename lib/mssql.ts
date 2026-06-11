import sql from 'mssql'
import { env } from './env'

const config: sql.config = {
  server: env.MSSQL_HOST,
  port: env.MSSQL_PORT,
  database: env.MSSQL_DATABASE,
  user: env.MSSQL_USER,
  password: env.MSSQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,   // set false for production with proper cert
    readOnlyIntent: true,            // enforce read-only
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

let pool: sql.ConnectionPool | null = null

export async function getMSSQLPool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    console.log('[MSSQL] Running in Mock Mode - connection pool skipped.')
    return null
  }
  if (pool && pool.connected) return pool
  pool = await sql.connect(config)
  return pool
}

export { sql }
