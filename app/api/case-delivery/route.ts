import { NextRequest, NextResponse } from 'next/server'
import https from 'https'
import { getMSSQLPool, sql } from '@/lib/mssql'

const API_BASE = 'https://api-aion.com7tracking.com'
const API_TOKEN = 'a28dbe832c007c1d99b90e9d422815315dfc6f43a0814de8b4c3b753da5edc5d'

// Use native https.request to support GET with body (fetch doesn't allow it)
function fetchWithBody(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
      rejectUnauthorized: false, // Docker may lack CA certificates
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`API responded with status ${res.statusCode}: ${data.substring(0, 200)}`))
        } else {
          resolve(data)
        }
      })
    })

    req.on('error', (err) => {
      console.error('[getCaseDelivery] https.request error:', err.message)
      reject(err)
    })
    req.setTimeout(30000, () => {
      req.destroy(new Error('Request timeout'))
    })
    req.write(body)
    req.end()
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateStart = searchParams.get('date_start') || ''
    const dateEnd = searchParams.get('date_end') || ''
    const vinNo = searchParams.get('vin_no') || ''
    const projectType = searchParams.get('project_type') || ''

    // Build JSON body for external API (API uses non-standard GET + body)
    const body: Record<string, string> = {}
    if (dateStart) body.date_start = dateStart
    if (dateEnd) body.date_end = dateEnd
    if (vinNo) body.vin_no = vinNo
    if (projectType) body.project_type = projectType

    const apiUrl = `${API_BASE}/api/icare/getCaseTaxi`
    const result = await fetchWithBody(apiUrl, JSON.stringify(body))
    const data = JSON.parse(result)

    // Cross-reference with View_AccumarateReleaseCar from SQL Server
    if (data.statusCode === 200 && data.message?.list?.length > 0) {
      const list = data.message.list as Array<{
        VinNo: string; ContractNo: string;
        [key: string]: unknown;
      }>

      // Collect unique VinNos
      const vinNos = [...new Set(list.map((item) => item.VinNo).filter(Boolean))]

      if (vinNos.length > 0) {
        const pool = await getMSSQLPool()
        if (pool) {
          // Build parameterized IN clause
          const req = pool.request()
          const vinParams = vinNos.map((v, i) => {
            req.input(`vin${i}`, sql.NVarChar, v)
            return `@vin${i}`
          }).join(',')

          const trackingResult = await req.query(`
            SELECT VinNo, ContractNo, RentItemID, RentStatusID, 
                   ReleaseDate, RentType, IsActive, RegisterNo, ContractType
            FROM dbo.View_AccumarateReleaseCar
            WHERE VinNo IN (${vinParams})
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

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('getCaseDelivery error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
