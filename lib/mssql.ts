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

let poolPromise: Promise<sql.ConnectionPool | null> | null = null
let writePoolPromise: Promise<sql.ConnectionPool | null> | null = null
let readOnlyPoolPromise: Promise<sql.ConnectionPool | null> | null = null

// getMSSQLPool now uses new sql.ConnectionPool with writeConfig by default for dashboard-wide safety
export async function getMSSQLPool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    return null
  }
  if (pool && pool.connected) return pool
  
  if (!poolPromise) {
    poolPromise = (async () => {
      const p = new sql.ConnectionPool(writeConfig)
      await p.connect()
      pool = p
      return p
    })()
  }
  return poolPromise
}

// getMSSQLWritePool now uses new sql.ConnectionPool to ensure app_butter credentials are used
export async function getMSSQLWritePool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    return null
  }
  if (writePool && writePool.connected) return writePool

  if (!writePoolPromise) {
    writePoolPromise = (async () => {
      console.log('[MSSQL Write Pool] Initializing write pool with user:', writeConfig.user)
      const p = new sql.ConnectionPool(writeConfig)
      await p.connect()
      writePool = p
      return p
    })()
  }
  return writePoolPromise
}

// getMSSQLReadOnlyPool now uses new sql.ConnectionPool specifically for Gemini Bot/Line Webhook
export async function getMSSQLReadOnlyPool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    return null
  }
  if (readOnlyPool && readOnlyPool.connected) return readOnlyPool

  if (!readOnlyPoolPromise) {
    readOnlyPoolPromise = (async () => {
      console.log('[MSSQL Read-Only Pool] Initializing read-only pool with user:', readOnlyConfig.user)
      const p = new sql.ConnectionPool(readOnlyConfig)
      await p.connect()
      readOnlyPool = p
      return p
    })()
  }
  return readOnlyPoolPromise
}

export { sql }
