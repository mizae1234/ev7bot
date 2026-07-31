import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { saveInspectionPhoto, resolveEv7User } from '@/lib/inspection/inspection-service'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

const s3Client = new S3Client({
  endpoint: env.SPACES_ENDPOINT,
  region: env.SPACES_REGION,
  credentials: {
    accessKeyId: env.SPACES_KEY,
    secretAccessKey: env.SPACES_SECRET,
  },
})

// POST: อัปโหลดรูปภาพ inspection
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const inspectionId = formData.get('inspectionId') as string
    const category = formData.get('category') as string
    const itemCode = (formData.get('itemCode') as string) || null
    const photoPosition = (formData.get('photoPosition') as string) || null

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ภาพ' }, { status: 400 })
    }
    if (!inspectionId) {
      return NextResponse.json({ error: 'ไม่พบ inspectionId' }, { status: 400 })
    }

    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '')
    const uploadedPhotos = []

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const key = `Inspection/${yearMonth}/${inspectionId}/${category}_${itemCode || 'general'}_${photoPosition || ''}_${Date.now()}_${cleanFileName}`

      // Upload to DO Spaces
      if (!env.MOCK_MODE) {
        await s3Client.send(new PutObjectCommand({
          Bucket: env.SPACES_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type,
          ACL: 'public-read',
        }))
      }

      // Save record to DB
      const photoId = await saveInspectionPhoto({
        inspectionId: parseInt(inspectionId),
        category: category || 'GENERAL',
        itemCode,
        photoPosition,
        s3Key: key,
        fileName: cleanFileName,
        fileSize: file.size,
        contentType: file.type,
      })

      uploadedPhotos.push({
        inspectionPhotoId: photoId,
        s3Key: key,
        fileName: cleanFileName,
        fileSize: file.size,
        contentType: file.type,
        category,
        itemCode,
        photoPosition,
      })
    }

    return NextResponse.json({
      success: true,
      message: `อัปโหลดภาพสำเร็จ ${files.length} รายการ`,
      photos: uploadedPhotos,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Inspection Upload Error]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
