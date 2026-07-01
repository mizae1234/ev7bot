import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[External API Proxy] Received Payload:', body)

    // =========================================================================
    // TODO: Connect this with your external system's API
    // 
    // Example implementation:
    // 
    // const EXTERNAL_API_URL = 'https://api.your-other-system.com/v1/maintenance'
    // const EXTERNAL_API_KEY = process.env.EXTERNAL_SYSTEM_API_KEY
    //
    // const response = await fetch(EXTERNAL_API_URL, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${EXTERNAL_API_KEY}`
    //   },
    //   body: JSON.stringify(body)
    // })
    //
    // if (!response.ok) {
    //   const errorText = await response.text()
    //   return NextResponse.json({ error: `External System Error: ${errorText}` }, { status: response.status })
    // }
    //
    // const result = await response.json()
    // return NextResponse.json(result)
    // =========================================================================

    // Simulate saving delay
    await new Promise(resolve => setTimeout(resolve, 800))

    // Return mock success response
    return NextResponse.json({
      success: true,
      message: 'บันทึกข้อมูลเรียบร้อยแล้ว (จำลองสถานะ)',
      data: {
        maintenanceId: Math.floor(Math.random() * 100000) + 10000,
        createdAt: new Date().toISOString()
      }
    })
  } catch (err: any) {
    console.error('[External API Proxy] Error:', err.message)
    return NextResponse.json({ error: `เกิดข้อผิดพลาดในการบันทึก: ${err.message}` }, { status: 500 })
  }
}
