import { NextRequest, NextResponse } from 'next/server'

// Runtime config for the browser-side EV7 Core API calls (Cloudflare blocks server-to-server,
// so the browser calls the API directly). Read at request time, so changing the env on the
// server takes effect after a restart — no rebuild needed.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Only serve to this app's own pages (browsers send Sec-Fetch-Site; blocks cross-site use)
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(
    {
      url: process.env.EV7_CORE_API_URL || '',
      token: process.env.EV7_CORE_API_TOKEN || '',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
