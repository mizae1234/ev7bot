import { getMSSQLWritePool, sql } from './mssql'

export async function saveErrorLog(params: {
  functionName: string
  errorMessage: string
  stackTrace?: string | null
  pageUrl?: string | null
  payload?: any | null
  userId?: number | null
}): Promise<number | null> {
  try {
    const pool = await getMSSQLWritePool()
    if (!pool) return null

    let payloadStr: string | null = null
    if (params.payload) {
      try {
        payloadStr = typeof params.payload === 'string' ? params.payload : JSON.stringify(params.payload)
      } catch (e) {
        payloadStr = '[Circular or Unserializable Payload]'
      }
    }

    const result = await pool.request()
      .input('functionName', sql.VarChar(250), params.functionName)
      .input('errorMessage', sql.NVarChar(sql.MAX), params.errorMessage)
      .input('stackTrace', sql.NVarChar(sql.MAX), params.stackTrace || null)
      .input('pageUrl', sql.VarChar(500), params.pageUrl || null)
      .input('payload', sql.NVarChar(sql.MAX), payloadStr)
      .input('userId', sql.Int, params.userId || null)
      .query(`
        INSERT INTO dbo.EV_ErrorLog (FunctionName, ErrorMessage, StackTrace, PageUrl, Payload, CreateUserID)
        OUTPUT INSERTED.ErrorLogID
        VALUES (@functionName, @errorMessage, @stackTrace, @pageUrl, @payload, @userId)
      `)

    return result.recordset[0]?.ErrorLogID || null
  } catch (err) {
    console.error('[saveErrorLog Failed]', err)
    return null
  }
}
