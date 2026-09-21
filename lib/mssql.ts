import sql from 'mssql'
import { env } from './env'

// 1. Primary / Write Pool Config (used across the dashboard for safety)
const writeConfig: sql.config = {
  server: env.MSSQL_HOST,
  port: env.MSSQL_PORT,
  database: env.MSSQL_DATABASE,
  user: env.MSSQL_WRITE_USER || 'app_butter',
  password: env.MSSQL_WRITE_PASSWORD || 'Beqe5EglBpbat27CtQrXI55nxvQkQxfR',
  connectionTimeout: 15000,
  requestTimeout: 30000,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    readOnlyIntent: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
  },
}

// 2. Read-Only Pool Config (used specifically for read-only bots / Line webhook queries)
const readOnlyConfig: sql.config = {
  server: env.MSSQL_HOST,
  port: env.MSSQL_PORT,
  database: env.MSSQL_DATABASE,
  user: env.MSSQL_USER,
  password: env.MSSQL_PASSWORD,
  connectionTimeout: 15000,
  requestTimeout: 30000,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    readOnlyIntent: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
  },
}

// Global state container attached to globalThis to persist pools across Next.js dev hot-reloads
interface GlobalMSSQL {
  mssqlWritePool?: sql.ConnectionPool | null
  mssqlWritePromise?: Promise<sql.ConnectionPool | null> | null
  mssqlReadOnlyPool?: sql.ConnectionPool | null
  mssqlReadOnlyPromise?: Promise<sql.ConnectionPool | null> | null
}

const globalForMSSQL = globalThis as unknown as GlobalMSSQL

/**
 * Primary Write/Default Pool
 * Used for all write and standard operations across the dashboard.
 */
export async function getMSSQLWritePool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    return null
  }

  const existingPool = globalForMSSQL.mssqlWritePool
  if (existingPool && existingPool.connected) {
    return existingPool
  }

  if (!globalForMSSQL.mssqlWritePromise) {
    globalForMSSQL.mssqlWritePromise = (async () => {
      try {
        console.log('[MSSQL Write Pool] Connecting to SQL Server with user:', writeConfig.user)
        const p = new sql.ConnectionPool(writeConfig)
        p.on('error', (err) => {
          console.error('[MSSQL Write Pool Error]', err)
          if (!p.connected) {
            globalForMSSQL.mssqlWritePool = null
            globalForMSSQL.mssqlWritePromise = null
          }
        })
        await p.connect()
        globalForMSSQL.mssqlWritePool = p
        return p
      } catch (err) {
        console.error('[MSSQL Write Pool Connect Failed]', err)
        globalForMSSQL.mssqlWritePool = null
        globalForMSSQL.mssqlWritePromise = null
        throw err
      }
    })()
  }

  return globalForMSSQL.mssqlWritePromise
}

/**
 * getMSSQLPool reuses getMSSQLWritePool directly.
 * Eliminates redundant second pool, saving 10 database connection slots.
 */
export async function getMSSQLPool(): Promise<sql.ConnectionPool | null> {
  return getMSSQLWritePool()
}

/**
 * Read-Only Pool
 * Used specifically for read-only bots / Line webhook queries.
 */
export async function getMSSQLReadOnlyPool(): Promise<sql.ConnectionPool | null> {
  if (env.MOCK_MODE) {
    return null
  }

  const existingPool = globalForMSSQL.mssqlReadOnlyPool
  if (existingPool && existingPool.connected) {
    return existingPool
  }

  if (!globalForMSSQL.mssqlReadOnlyPromise) {
    globalForMSSQL.mssqlReadOnlyPromise = (async () => {
      try {
        console.log('[MSSQL Read-Only Pool] Connecting with user:', readOnlyConfig.user)
        const p = new sql.ConnectionPool(readOnlyConfig)
        p.on('error', (err) => {
          console.error('[MSSQL Read-Only Pool Error]', err)
          if (!p.connected) {
            globalForMSSQL.mssqlReadOnlyPool = null
            globalForMSSQL.mssqlReadOnlyPromise = null
          }
        })
        await p.connect()
        globalForMSSQL.mssqlReadOnlyPool = p
        return p
      } catch (err) {
        console.error('[MSSQL Read-Only Pool Connect Failed]', err)
        globalForMSSQL.mssqlReadOnlyPool = null
        globalForMSSQL.mssqlReadOnlyPromise = null
        throw err
      }
    })()
  }

  return globalForMSSQL.mssqlReadOnlyPromise
}

export { sql }
