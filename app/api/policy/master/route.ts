import { NextResponse } from 'next/server'
import {
  getInsuranceMasterTypes,
  getInsuranceCompanies,
  getDistinctModels,
  getDistinctProjects
} from '@/lib/policy/policy-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [masterTypes, companies, models, projects] = await Promise.all([
      getInsuranceMasterTypes(),
      getInsuranceCompanies(),
      getDistinctModels(),
      getDistinctProjects()
    ])
    return NextResponse.json({ masterTypes, companies, models, projects })
  } catch (err: any) {
    console.error('[GET /api/policy/master Error]', err)
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล Master' }, { status: 500 })
  }
}
