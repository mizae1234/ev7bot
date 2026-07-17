import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

const API_BASE = 'https://api-aion.com7tracking.com'
const API_TOKEN = 'a28dbe832c007c1d99b90e9d422815315dfc6f43a0814de8b4c3b753da5edc5d'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateStart = searchParams.get('date_start') || ''
    const dateEnd = searchParams.get('date_end') || ''
    const vinNo = searchParams.get('vin_no') || ''
    const projectType = searchParams.get('project_type') || ''

    // Fetch ALL data from external API (GET without body — body filtering not supported by fetch)
    // Then filter results server-side
    const res = await fetch(`${API_BASE}/api/icare/getCaseTaxi`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { error: `API error: ${res.status}`, detail: errText.substring(0, 200) },
        { status: res.status }
      )
    }

    const data = await res.json()

    // Server-side filtering (API returns all data when no body is sent)
    if (data.statusCode === 200 && data.message?.list) {
      let list = data.message.list as Array<{
        VinNo: string; ContractNo: string; ProjectType: string;
        ExpectedReleaseDate: string;
        [key: string]: unknown;
      }>

      // Filter by date range (ExpectedReleaseDate format: "DD/MM/YYYY HH:mm:ss")
      if (dateStart || dateEnd) {
        list = list.filter((item) => {
          if (!item.ExpectedReleaseDate) return false
          const parts = item.ExpectedReleaseDate.split(' ')[0].split('/')
          if (parts.length !== 3) return false
          const itemDate = `${parts[2]}-${parts[1]}-${parts[0]}` // YYYY-MM-DD
          if (dateStart && itemDate < dateStart) return false
          if (dateEnd && itemDate > dateEnd) return false
          return true
        })
      }

      // Filter by VIN
      if (vinNo) {
        list = list.filter((item) =>
          item.VinNo?.toLowerCase().includes(vinNo.toLowerCase())
        )
      }

      // Filter by project type
      if (projectType) {
        list = list.filter((item) => item.ProjectType === projectType)
      }

      data.message.list = list
      data.message.count = list.length

      // Cross-reference with View_AccumarateReleaseCar from SQL Server
      if (list.length > 0) {
        const vinNos = [...new Set(list.map((item) => item.VinNo).filter(Boolean))]

        if (vinNos.length > 0) {
          const pool = await getMSSQLPool()
          if (pool) {
            const req = pool.request()
            const vinParams = vinNos.map((v, i) => {
              req.input(`vin${i}`, sql.NVarChar, v)
              return `@vin${i}`
            }).join(',')

            // Add date filters to tracking query
            let dateFilter = ''
            if (dateStart) {
              req.input('dateStart', sql.Date, dateStart)
              dateFilter += ' AND ReleaseDate >= @dateStart'
            }
            if (dateEnd) {
              req.input('dateEnd', sql.Date, dateEnd)
              dateFilter += ' AND ReleaseDate < DATEADD(day, 1, @dateEnd)'
            }

            const trackingResult = await req.query(`
              SELECT VinNo, ContractNo, RentItemID, RentStatusID, 
                     ReleaseDate, RentType, IsActive, RegisterNo, ContractType
              FROM dbo.View_AccumarateReleaseCar
              WHERE VinNo IN (${vinParams})${dateFilter}
            `)

            // Build lookup map: VinNo → latest tracking record
            const trackingMap = new Map<string, {
              ContractNo: string;
              RentStatusID: number;
              ReleaseDate: string | null;
              RentType: string;
              IsActive: boolean;
              RegisterNo: string;
              ContractType: string;
            }>()

            for (const row of trackingResult.recordset) {
              const existing = trackingMap.get(row.VinNo)
              if (!existing || parseInt(row.RentItemID) > parseInt(existing.ContractNo)) {
                trackingMap.set(row.VinNo, {
                  ContractNo: row.ContractNo,
                  RentStatusID: row.RentStatusID,
                  ReleaseDate: row.ReleaseDate,
                  RentType: row.RentType,
                  IsActive: row.IsActive,
                  RegisterNo: row.RegisterNo,
                  ContractType: row.ContractType,
                })
              }
            }

            // Merge tracking data into list
            for (const item of list) {
              const tracking = trackingMap.get(item.VinNo)
              if (tracking) {
                ;(item as Record<string, unknown>).TrackingContractNo = tracking.ContractNo
                ;(item as Record<string, unknown>).TrackingReleaseDate = tracking.ReleaseDate
                ;(item as Record<string, unknown>).TrackingRentType = tracking.RentType
                ;(item as Record<string, unknown>).TrackingIsActive = tracking.IsActive
                ;(item as Record<string, unknown>).TrackingRegisterNo = tracking.RegisterNo
                ;(item as Record<string, unknown>).TrackingContractType = tracking.ContractType
                ;(item as Record<string, unknown>).TrackingStatus = 'MATCHED'
              } else {
                ;(item as Record<string, unknown>).TrackingStatus = 'NOT_FOUND'
              }
            }
          }
        }
      }
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('getCaseDelivery error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
