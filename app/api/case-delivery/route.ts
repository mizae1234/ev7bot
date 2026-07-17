import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

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
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('getCaseDelivery error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
