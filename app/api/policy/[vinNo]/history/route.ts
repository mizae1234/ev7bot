import { NextRequest, NextResponse } from 'next/server'
import { getPolicyHistoryByVin } from '@/lib/policy/policy-service'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ vinNo: string }> }
) {
  try {
    const { vinNo } = await params
    if (!vinNo) {
      return NextResponse.json({ error: 'กรุณาระบุเลขตัวถัง (vinNo)' }, { status: 400 })
    }

    const history = await getPolicyHistoryByVin(vinNo)
    return NextResponse.json({ history })
  } catch (err: any) {
    console.error('[GET /api/policy/[vinNo]/history Error]', err)
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในการดึงประวัติ' }, { status: 500 })
  }
}
