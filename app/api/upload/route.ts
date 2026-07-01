import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getMSSQLPool, sql } from '@/lib/mssql'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

const s3Client = new S3Client({
  endpoint: 'https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com',
  region: 'sgp1',
  credentials: {
    accessKeyId: 'DO801YHZN782PLZKVJRG',
    secretAccessKey: 'j2ITQO86C7nwWUAAh7EBKNzmEXQSZdug5+yMX7qAkX0'
  }
})

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const maintenanceId = formData.get('maintenanceId') as string
    const lineUserId = formData.get('lineUserId') as string

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ภาพที่ต้องการอัปโหลด' }, { status: 400 })
    }
    if (!maintenanceId) {
      return NextResponse.json({ error: 'ไม่พบรหัสใบแจ้งซ่อม (maintenanceId)' }, { status: 400 })
    }

    if (env.MOCK_MODE) {
      console.log('[Mock Mode] Uploading files for maintenance:', maintenanceId, files.map(f => f.name))
      return NextResponse.json({
        success: true,
        message: 'อัปโหลดภาพสำเร็จ (จำลองสถานะ MOCK_MODE)',
        files: files.map(f => ({
          fileName: f.name,
          filePath: `https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com/Maintenance/MOCK/${maintenanceId}/${f.name}`,
          fileType: f.type,
          fileSize: f.size
        }))
      })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูล SQL Server ได้' }, { status: 500 })
    }

    // Resolve ev7UserId from lineUserId
    let dbUserId = 1 // Default to 1 (System / LIFF User)
    if (lineUserId) {
      try {
        const reg = await prisma.lineRegistration.findUnique({
          where: { lineUserId }
        })
        if (reg?.ev7UserId) {
          dbUserId = reg.ev7UserId
        }
      } catch (prismaErr) {
        console.error('[Prisma read ev7UserId Error]', prismaErr)
      }
    }

    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '') // YYYYMM
    const uploadedUrls = []

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Sanitize and construct the key path: Maintenance/YYYYMM/MaintenanceItemID/<timestamp>_<filename>
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const key = `Maintenance/${yearMonth}/${maintenanceId}/${Date.now()}_${cleanFileName}`

      // Upload to DigitalOcean Spaces
      await s3Client.send(new PutObjectCommand({
        Bucket: 'space-ev7tracking-prod',
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: 'public-read'
      }))

      const fileUrl = `https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com/${key}`
      
      // Execute the Stored Procedure to insert details into FileAttachment & EV_FileAttachmentMaintenanceItem
      await pool.request()
        .input('MaintenanceItemID', sql.Int, parseInt(maintenanceId, 10))
        .input('FileName', sql.NVarChar, file.name)
        .input('FilePath', sql.NVarChar, fileUrl)
        .input('FileType', sql.NVarChar, file.type)
        .input('FileSize', sql.Int, file.size)
        .input('CreateUserID', sql.Int, dbUserId)
        .execute('dbo.sp_InsertMaintenanceAttachment')

      uploadedUrls.push({
        fileName: file.name,
        filePath: fileUrl,
        fileType: file.type,
        fileSize: file.size
      })
    }

    return NextResponse.json({
      success: true,
      message: `อัปโหลดและลงทะเบียนภาพจำนวน ${files.length} รายการเรียบร้อยแล้ว`,
      files: uploadedUrls
    })
  } catch (error: any) {
    console.error('[Upload API Error]', error)
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' }, { status: 500 })
  }
}
