import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

// Server endpoint: returns tracking data from View_AccumarateReleaseCar
// Mode 1: POST with vinNos → match specific VINs
// Mode 2: POST with fetchAll + date range → return ALL tracking records for date range
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vinNos, dateStart, dateEnd, fetchAll } = body as {
      vinNos?: string[];
      dateStart?: string;
      dateEnd?: string;
      fetchAll?: boolean;
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ tracking: {}, allTracking: [] })
    }

    // Mode 2: Fetch ALL tracking records for date range
    if (fetchAll) {
      const req = pool.request()
      let dateFilter = 'WHERE 1=1'
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
               ReleaseDate, RentType, IsActive, RegisterNo, ContractType,
               FirstName, LastName
        FROM dbo.View_AccumarateReleaseCar
        ${dateFilter}
      `)

      // Build map (all records per VIN)
      const trackingMap: Record<string, Array<Record<string, unknown>>> = {}
      for (const row of result.recordset) {
        const vin = row.VinNo as string
        if (!trackingMap[vin]) {
          trackingMap[vin] = []
        }
        trackingMap[vin].push({
          VinNo: row.VinNo,
          ContractNo: row.ContractNo,
          RentItemID: row.RentItemID,
          ReleaseDate: row.ReleaseDate,
          RentType: row.RentType,
          IsActive: row.IsActive,
          RegisterNo: row.RegisterNo,
          ContractType: row.ContractType,
          CustomerName: ((row.FirstName || '') + ' ' + (row.LastName || '')).trim(),
        })
      }

      return NextResponse.json({ tracking: trackingMap })
    }

    // Mode 1: Match specific VINs
    if (!vinNos || vinNos.length === 0) {
      return NextResponse.json({ tracking: {} })
    }

    const BATCH_SIZE = 2000
    const allRows: Array<Record<string, unknown>> = []
    const uniqueVins = Array.from(new Set(vinNos.filter(Boolean)))

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

    // Build lookup map
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
