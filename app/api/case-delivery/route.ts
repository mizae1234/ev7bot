import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
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

    // Build JSON body for external API (API uses non-standard GET + body)
    const body: Record<string, string> = {}
    if (dateStart) body.date_start = dateStart
    if (dateEnd) body.date_end = dateEnd
    if (vinNo) body.vin_no = vinNo
    if (projectType) body.project_type = projectType

    const apiUrl = `${API_BASE}/api/icare/getCaseTaxi`
    const jsonBody = JSON.stringify(body)

    // Use curl to support GET with body (Node.js fetch doesn't allow it)
    const curlCmd = `curl -s -X GET "${apiUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer ${API_TOKEN}" -d '${jsonBody.replace(/'/g, "'\\''")}'`
    const result = execSync(curlCmd, { timeout: 30000, encoding: 'utf-8' })

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
          // Use the one with highest RentItemID (most recent)
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
