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

const readOnlyConfig: sql.config = {
  server: env.MSSQL_HOST,
  port: env.MSSQL_PORT,
  database: env.MSSQL_DATABASE,
  user: env.MSSQL_USER,
  password: env.MSSQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    readOnlyIntent: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

let pool: sql.ConnectionPool | null = null
let writePool: sql.ConnectionPool | null = null
let readOnlyPool: sql.ConnectionPool | null = null

// getMSSQLPool now uses new sql.ConnectionPool to isolate from other pools
export async function getMSSQLPool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    console.log('[MSSQL] Running in Mock Mode - connection pool skipped.')
    return null
  }
  if (pool && pool.connected) return pool
  
  pool = new sql.ConnectionPool(readConfig)
  await pool.connect()
  return pool
}

// getMSSQLWritePool now uses new sql.ConnectionPool to ensure app_butter credentials are used
export async function getMSSQLWritePool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    console.log('[MSSQL] Running in Mock Mode - write connection pool skipped.')
    return null
  }
  if (writePool && writePool.connected) return writePool

  console.log('[MSSQL Write Pool] Initializing write pool with user:', writeConfig.user)
  writePool = new sql.ConnectionPool(writeConfig)
  await writePool.connect()
  
  try {
    const testRes = await writePool.request().query('SELECT CURRENT_USER AS dbUser, SYSTEM_USER AS loginUser')
    console.log('[MSSQL Write Pool Connected] dbUser:', testRes.recordset[0].dbUser, 'loginUser:', testRes.recordset[0].loginUser)
  } catch (testErr) {
    console.error('[MSSQL Write Pool check error]', testErr)
  }
  
  return writePool
}

// getMSSQLReadOnlyPool now uses new sql.ConnectionPool specifically for Gemini Bot/Line Webhook
export async function getMSSQLReadOnlyPool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    console.log('[MSSQL] Running in Mock Mode - read-only connection pool skipped.')
    return null
  }
  if (readOnlyPool && readOnlyPool.connected) return readOnlyPool

  console.log('[MSSQL Read-Only Pool] Initializing read-only pool with user:', readOnlyConfig.user)
  readOnlyPool = new sql.ConnectionPool(readOnlyConfig)
  await readOnlyPool.connect()
  return readOnlyPool
}

export { sql }
