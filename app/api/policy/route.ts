import { NextRequest, NextResponse } from 'next/server'
import { getPolicyList, updateSinglePolicy } from '@/lib/policy/policy-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || undefined
    const expiryFilter = searchParams.get('expiryFilter') || undefined
    const missingFilter = searchParams.get('missingFilter') || undefined
    const typeFilter = searchParams.get('typeFilter') || undefined
    const categoryFilter = searchParams.get('categoryFilter') || undefined
    const projectFilter = searchParams.get('projectFilter') || undefined
    const modelFilter = searchParams.get('modelFilter') || undefined
    const statusFilter = searchParams.get('statusFilter') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const data = await getPolicyList({
      search,
      expiryFilter,
      missingFilter,
      typeFilter,
      categoryFilter,
      projectFilter,
      modelFilter,
      statusFilter,
      page,
      limit
    })

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[GET /api/policy Error]', err)
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.vinNo) {
      return NextResponse.json({ error: 'กรุณาระบุเลขตัวถัง (vinNo)' }, { status: 400 })
    }

    const result = await updateSinglePolicy(body)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[PUT /api/policy Error]', err)
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' }, { status: 500 })
  }
}
