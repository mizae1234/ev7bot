import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

// Server endpoint: receives VIN list, returns tracking data from View_AccumarateReleaseCar
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vinNos, dateStart, dateEnd } = body as {
      vinNos: string[];
      dateStart?: string;
      dateEnd?: string;
    }

    if (!vinNos || vinNos.length === 0) {
      return NextResponse.json({ tracking: {} })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ tracking: {} })
    }

    // Batch VINs in chunks of 2000 to avoid SQL Server 2100 param limit
    const BATCH_SIZE = 2000
    const allRows: Array<Record<string, unknown>> = []
    const uniqueVins = [...new Set(vinNos.filter(Boolean))]

    for (let i = 0; i < uniqueVins.length; i += BATCH_SIZE) {
      const batch = uniqueVins.slice(i, i + BATCH_SIZE)
      const req = pool.request()
      const vinParams = batch.map((v, idx) => {
        req.input(`vin${idx}`, sql.NVarChar, v)
        return `@vin${idx}`
      }).join(',')

      let dateFilter = ''
      if (dateStart) {
        req.input('dateStart', sql.Date, dateStart)
        dateFilter += ' AND ReleaseDate >= @dateStart'
      }
      if (dateEnd) {
        req.input('dateEnd', sql.Date, dateEnd)
        dateFilter += ' AND ReleaseDate < DATEADD(day, 1, @dateEnd)'
      }

      const result = await req.query(`
        SELECT VinNo, ContractNo, RentItemID, RentStatusID, 
               ReleaseDate, RentType, IsActive, RegisterNo, ContractType
        FROM dbo.View_AccumarateReleaseCar
        WHERE VinNo IN (${vinParams})${dateFilter}
      `)
      allRows.push(...result.recordset)
    }

    // Build lookup map: VinNo → latest tracking record (highest RentItemID)
    const trackingMap: Record<string, {
      ContractNo: string;
      ReleaseDate: string | null;
      RentType: string;
      IsActive: boolean;
      RegisterNo: string;
      ContractType: string;
    }> = {}

    for (const row of allRows) {
      const vin = row.VinNo as string
      const existing = trackingMap[vin]
      if (!existing || parseInt(row.RentItemID as string) > parseInt(existing.ContractNo)) {
        trackingMap[vin] = {
          ContractNo: row.ContractNo as string,
          ReleaseDate: row.ReleaseDate as string | null,
          RentType: row.RentType as string,
          IsActive: row.IsActive as boolean,
          RegisterNo: row.RegisterNo as string,
          ContractType: row.ContractType as string,
        }
      }
    }

    return NextResponse.json({ tracking: trackingMap })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('tracking error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
