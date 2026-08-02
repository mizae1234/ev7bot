import { NextRequest, NextResponse } from 'next/server'
import { deleteInspectionPhoto, resolveEv7User } from '@/lib/inspection/inspection-service'

export const dynamic = 'force-dynamic'

// DELETE: ลบรูปภาพตรวจสภาพรถ (Soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const photoId = parseInt(id)
    if (isNaN(photoId)) {
      return NextResponse.json({ error: 'Invalid photo ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const lineUserId = searchParams.get('lineUserId')
    let updateUserId: number | null = null
    if (lineUserId) {
      const user = await resolveEv7User(lineUserId)
      if (user) {
        updateUserId = user.userId
      }
    }

    await deleteInspectionPhoto(photoId, updateUserId)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Delete Photo API Error]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
