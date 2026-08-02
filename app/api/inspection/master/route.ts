import { NextResponse } from 'next/server'
import { getInspectionItemMaster } from '@/lib/inspection/inspection-service'

export async function GET() {
  try {
    const masterItems = await getInspectionItemMaster()
    return NextResponse.json({ masterItems })
  } catch (err: any) {
    console.error('Failed to fetch inspection master:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
