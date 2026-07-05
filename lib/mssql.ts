import sql from 'mssql'
import { env } from './env'

const readConfig: sql.config = {
  server: env.MSSQL_HOST,
  port: env.MSSQL_PORT,
  database: env.MSSQL_DATABASE,
  user: env.MSSQL_USER,
  password: env.MSSQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    readOnlyIntent: true, // enforce read-only for read pool
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

let pool: sql.ConnectionPool | null = null
let writePool: sql.ConnectionPool | null = null

export async function getMSSQLPool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    console.log('[MSSQL] Running in Mock Mode - connection pool skipped.')
    return null
  }
  if (pool && pool.connected) return pool
  pool = await sql.connect(readConfig)
  return pool
}

export async function getMSSQLWritePool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    console.log('[MSSQL] Running in Mock Mode - write connection pool skipped.')
    return null
  }
  if (writePool && writePool.connected) return writePool

  const writeConfig: sql.config = {
    server: env.MSSQL_HOST,
    port: env.MSSQL_PORT,
    database: env.MSSQL_DATABASE,
    user: env.MSSQL_WRITE_USER || 'app_butter',
    password: env.MSSQL_WRITE_PASSWORD || 'Beqe5EglBpbat27CtQrXI55nxvQkQxfR',
    options: {
      encrypt: true,
      trustServerCertificate: true,
      readOnlyIntent: false,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    }
  }

  console.log('[MSSQL Write Pool] Initializing write pool with user:', writeConfig.user)
  writePool = await sql.connect(writeConfig)
  return writePool
}

export { sql }
