import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

// GET: Fetch master substatus locations from EV_MsSubStatus using SP
export async function GET(request: NextRequest) {
  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const result = await pool.request()
      .input('Type', sql.VarChar, 'LOCATION')
      .query(`
        EXEC GetEVMsSubStatus @Type = @Type
      `)

    return NextResponse.json({ locations: result.recordset })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Get Locations Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
