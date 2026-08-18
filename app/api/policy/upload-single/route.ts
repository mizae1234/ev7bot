import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'

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
    const file = formData.get('file') as File | null
    const vinNo = (formData.get('vinNo') as string)?.trim().toUpperCase()
    const registerNo = (formData.get('registerNo') as string)?.trim() || null
    const docType = (formData.get('docType') as string) || 'INSURANCE' // 'INSURANCE', 'ACT', 'VEHICLE_TAX', 'METER_TAX'
    const lineUserId = (formData.get('lineUserId') as string) || ''

    if (!file || !vinNo) {
      return NextResponse.json({ error: 'กรุณาระบุไฟล์และเลขตัวถัง (VIN)' }, { status: 400 })
    }

    let dbUserId = 1
    if (lineUserId) {
      try {
        const reg = await prisma.lineRegistration.findUnique({ where: { lineUserId } })
        if (reg?.ev7UserId) dbUserId = reg.ev7UserId
      } catch (e) {
        // fallback
      }
    }

    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '')
    let folder = 'Insurance'
    if (docType === 'ACT') folder = 'Act'
    else if (docType === 'VEHICLE_TAX') folder = 'Tax'
    else if (docType === 'METER_TAX') folder = 'Meter'

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const s3Key = `Policies/${folder}/${yearMonth}/${Date.now()}_${cleanFileName}`

    if (!env.MOCK_MODE) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      await s3Client.send(new PutObjectCommand({
        Bucket: env.SPACES_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type || 'application/pdf',
        ACL: 'public-read'
      }))
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // Update dbo.EV_Policy for the specific docType
    const upReq = pool.request()
    upReq.input('vinNo', sql.VarChar, vinNo)
    upReq.input('registerNo', sql.VarChar, registerNo)
    upReq.input('filePath', sql.VarChar, s3Key)
    upReq.input('userId', sql.Int, dbUserId)

    let updateCol = 'InsuranceFilePath'
    let policyTypeName = 'ประกันภัยภาคสมัครใจ'
    let policyType = 'PLMV'
    if (docType === 'ACT') {
      updateCol = 'ActFilePath'
      policyTypeName = 'พ.ร.บ. คุ้มครองผู้ประสบภัยจากรถ'
      policyType = 'DAC'
    } else if (docType === 'VEHICLE_TAX') {
      updateCol = 'VehicleTaxFilePath'
      policyTypeName = 'ภาษีรถยนต์ประจำปี'
      policyType = 'TAX_VEHICLE'
    } else if (docType === 'METER_TAX') {
      updateCol = 'MeterTaxFilePath'
      policyTypeName = 'ภาษีตรวจมิเตอร์แท็กซี่'
      policyType = 'TAX_METER'
    }

    await upReq.query(`
      IF EXISTS (SELECT 1 FROM dbo.EV_Policy WHERE VinNo = @vinNo)
      BEGIN
        UPDATE dbo.EV_Policy
        SET RegisterNo = COALESCE(@registerNo, RegisterNo),
            ${updateCol} = @filePath,
            UpdateDate = GETDATE(),
            UpdateUserID = @userId
        WHERE VinNo = @vinNo;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.EV_Policy (
          VinNo, RegisterNo, ${updateCol}, IsActive, CreateDate, CreateUserID
        )
        VALUES (
          @vinNo, @registerNo, @filePath, 1, GETDATE(), @userId
        );
      END
    `)

    // Also insert Audit Log in dbo.EV_PolicyLog
    const logReq = pool.request()
    logReq.input('vinNo', sql.VarChar, vinNo)
    logReq.input('registerNo', sql.VarChar, registerNo)
    logReq.input('docType', sql.VarChar, docType)
    logReq.input('policyType', sql.VarChar, policyType)
    logReq.input('policyTypeName', sql.NVarChar, policyTypeName)
    logReq.input('originalFileName', sql.NVarChar, file.name)
    logReq.input('filePath', sql.VarChar, s3Key)
    logReq.input('fileSize', sql.BigInt, file.size)
    logReq.input('uploadSource', sql.VarChar, 'SINGLE_MANUAL_UPLOAD')
    logReq.input('userId', sql.Int, dbUserId)

    await logReq.query(`
      UPDATE dbo.EV_PolicyLog SET IsCurrent = 0 WHERE VinNo = @vinNo AND DocType = @docType AND IsCurrent = 1;
      INSERT INTO dbo.EV_PolicyLog (
        VinNo, RegisterNo, DocType, PolicyType, PolicyTypeName, OriginalFileName, FilePath, FileSize, UploadSource, IsCurrent, IsActive, CreateDate, CreateUserID
      )
      VALUES (
        @vinNo, @registerNo, @docType, @policyType, @policyTypeName, @originalFileName, @filePath, @fileSize, @uploadSource, 1, 1, GETDATE(), @userId
      );
    `)

    const cdnUrl = process.env.NEXT_PUBLIC_SPACES_CDN_URL || 'https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com'
    const fullUrl = s3Key.startsWith('http') ? s3Key : `${cdnUrl}/${s3Key}`

    return NextResponse.json({
      success: true,
      filePath: s3Key,
      fileUrl: fullUrl,
      fileName: file.name,
      docType
    })
  } catch (error: any) {
    console.error('[Upload Single Policy Error]', error)
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์' }, { status: 500 })
  }
}
