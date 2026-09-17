import { NextResponse } from 'next/server'
import { getInspectionItemMaster, getReturnReasonsMaster } from '@/lib/inspection/inspection-service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || undefined
    const [masterItems, returnReasons] = await Promise.all([
      getInspectionItemMaster(type),
      getReturnReasonsMaster(),
    ])
    return NextResponse.json({ masterItems, returnReasons })
  } catch (err: any) {
    console.error('Failed to fetch inspection master:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
