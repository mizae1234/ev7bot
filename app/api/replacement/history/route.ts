import { NextRequest, NextResponse } from 'next/server'
import { getReplacementHistory } from '@/lib/replacement/replacement-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const location = searchParams.get('location') || undefined
    const model = searchParams.get('model') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const result = await getReplacementHistory({
      search,
      location,
      model,
      page,
      limit
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in GET /api/replacement/history:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: errMessage },
      { status: 500 }
    )
  }
}
