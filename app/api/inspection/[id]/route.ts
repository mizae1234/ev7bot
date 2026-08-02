import { NextRequest, NextResponse } from 'next/server'
import { getInspectionDetail, updateInspection, resolveEv7User } from '@/lib/inspection/inspection-service'
import { saveErrorLog } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET: ดึง Inspection detail พร้อม items + photos
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id = 'unknown'
  try {
    const resolvedParams = await params
    id = resolvedParams.id
    const inspectionId = parseInt(id)
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: 'Invalid inspection ID' }, { status: 400 })
    }

    const inspection = await getInspectionDetail(inspectionId)
    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
    }

    return NextResponse.json({ inspection })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : null
    console.error('[Inspection Detail GET Error]', message)

    await saveErrorLog({
      functionName: 'API_INSPECTION_DETAIL_GET',
      errorMessage: message,
      stackTrace: stack,
      pageUrl: `/api/inspection/${id}`,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: อัปเดต status (เช่น DRAFT → COMPLETED)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id = 'unknown'
  let body: any = null
  let ev7UserId: number | null = null
  try {
    const resolvedParams = await params
    id = resolvedParams.id
    const inspectionId = parseInt(id)
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: 'Invalid inspection ID' }, { status: 400 })
    }

    body = await request.json()
    const { status, mileage, remark, items = [], lineUserId, returnDate, parkLocation, inspectorName, inspectorUserId, returnReason, carStatus, carStatusType, assessmentResult, customerName, customerContact, contractCancellationDate } = body

    console.log('[API PUT /api/inspection/:id] Payload parsed:', {
      inspectionId,
      status,
      returnReason,
      assessmentResult,
      customerName,
      customerContact,
      contractCancellationDate,
    })

    const ev7User = await resolveEv7User(lineUserId)
    ev7UserId = ev7User.userId

    await updateInspection({
      inspectionId,
      mileage,
      remark,
      status,
      items,
      ev7UserId: ev7User.userId,
      returnDate,
      location: parkLocation,
      inspectorName,
      inspectorUserId: inspectorUserId ? parseInt(inspectorUserId) : undefined,
      returnReason,
      carStatus,
      carStatusType,
      assessmentResult,
      customerName,
      customerContact,
      contractCancellationDate,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : null
    console.error('[Inspection Detail PUT Error]', message)

    await saveErrorLog({
      functionName: 'API_INSPECTION_DETAIL_PUT',
      errorMessage: message,
      stackTrace: stack,
      pageUrl: `/api/inspection/${id}`,
      payload: body,
      userId: ev7UserId,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
