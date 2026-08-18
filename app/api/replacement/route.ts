import { NextRequest, NextResponse } from 'next/server'
import {
  getActiveReplacements,
  getReplacementPoolCars,
  getReplacementStatsSummary
} from '@/lib/replacement/replacement-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'ACTIVE'
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined
    const location = searchParams.get('location') || undefined
    const model = searchParams.get('model') || undefined
    const reservationType = searchParams.get('reservationType') || undefined
    const durationFilter = searchParams.get('durationFilter') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const fetchRecordsPromise = tab === 'POOL'
      ? getReplacementPoolCars({
          search,
          status,
          location,
          model,
          reservationType,
          page,
          limit
        })
      : getActiveReplacements({
          search,
          status,
          location,
          model,
          durationFilter,
          page,
          limit
        })

    const [stats, result] = await Promise.all([
      getReplacementStatsSummary(),
      fetchRecordsPromise
    ])

    return NextResponse.json({
      ...result,
      stats
    })
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in GET /api/replacement:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: errMessage },
      { status: 500 }
    )
  }
}
