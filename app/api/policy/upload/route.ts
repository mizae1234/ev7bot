import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { parsePolicyFileName } from '@/lib/policy/policy-parser'
import { savePolicyPdfRecord } from '@/lib/policy/policy-service'

export const dynamic = 'force-dynamic'

const s3Client = new S3Client({
  endpoint: env.SPACES_ENDPOINT,
  region: env.SPACES_REGION,
  credentials: {
    accessKeyId: env.SPACES_KEY,
    secretAccessKey: env.SPACES_SECRET
  }
})

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const lineUserId = (formData.get('lineUserId') as string) || ''
    const metadataStr = (formData.get('metadata') as string) || ''

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ PDF สำหรับอัปโหลด' }, { status: 400 })
    }

    // Resolve ev7UserId
    let ev7UserId = 1
    if (lineUserId) {
      try {
        const reg = await prisma.lineRegistration.findUnique({ where: { lineUserId } })
        if (reg?.ev7UserId) ev7UserId = reg.ev7UserId
      } catch (e) {
        // fallback
      }
    }

    // Parse overrides if any passed from client preview
    let overridesMap: Record<string, any> = {}
    if (metadataStr) {
      try {
        overridesMap = JSON.parse(metadataStr)
      } catch (e) {
        // ignore
      }
    }

    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '')
    const results = []
    const errors: string[] = []

    for (const file of files) {
      try {
        const parsed = parsePolicyFileName(file.name, file.size)
        const override = overridesMap[file.name] || {}

        const vinNo = override.vinNo || parsed.vinNo
        const docType = (override.docType || parsed.docType) as 'INSURANCE' | 'ACT' | 'UNKNOWN'
        const policyNo = override.policyNo || parsed.policyNo
        const policyType = override.policyType || parsed.policyType
        const policyTypeName = override.policyTypeName || parsed.policyTypeName
        const startDate = override.startDate || parsed.startDateStr
        const endDate = override.endDate || parsed.expiryDateStr

        if (!vinNo || !endDate || !policyNo || docType === 'UNKNOWN') {
          errors.push(`ไฟล์ "${file.name}": ข้อมูลไม่ครบถ้วนหรือไม่สามารถอ่านเลขตัวถัง/วันหมดอายุได้`)
          continue
        }

        // Sanitize S3 key
        const folder = docType === 'INSURANCE' ? 'Insurance' : 'Act'
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const s3Key = `Policies/${folder}/${yearMonth}/${Date.now()}_${cleanName}`

        if (!env.MOCK_MODE) {
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          await s3Client.send(new PutObjectCommand({
            Bucket: env.SPACES_BUCKET,
            Key: s3Key,
            Body: buffer,
            ContentType: 'application/pdf',
            ACL: 'public-read'
          }))
        }

        // Save DB Record & Policy Log
        await savePolicyPdfRecord({
          vinNo,
          docType,
          policyType,
          policyTypeName,
          policyNo,
          startDate,
          endDate,
          originalFileName: file.name,
          filePath: s3Key,
          fileSize: file.size,
          userId: ev7UserId
        })

        results.push({
          fileName: file.name,
          vinNo,
          docType,
          policyType,
          policyNo,
          endDate,
          s3Key
        })
      } catch (fileErr: any) {
        console.error(`[Upload error for ${file.name}]`, fileErr)
        errors.push(`ไฟล์ "${file.name}": ${fileErr.message || 'เกิดข้อผิดพลาดในการบันทึก'}`)
      }
    }

    return NextResponse.json({
      success: true,
      totalFiles: files.length,
      uploadedCount: results.length,
      failedCount: errors.length,
      results,
      errors
    })
  } catch (err: any) {
    console.error('[POST /api/policy/upload Error]', err)
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในการอัปโหลด' }, { status: 500 })
  }
}
