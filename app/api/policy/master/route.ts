import { NextResponse } from 'next/server'
import { getInsuranceMasterTypes } from '@/lib/policy/policy-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const masterTypes = await getInsuranceMasterTypes()
    return NextResponse.json({ masterTypes })
  } catch (err: any) {
    console.error('[GET /api/policy/master Error]', err)
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล Master' }, { status: 500 })
  }
}
