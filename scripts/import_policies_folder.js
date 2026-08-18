/**
 * Script: import_policies_folder.js
 * Usage: node scripts/import_policies_folder.js <folder_path>
 * Example: node scripts/import_policies_folder.js /Users/kanittamac/Downloads/policies
 *
 * Description: High-speed batch import script for scanning 4,000+ PDF policies from a local folder,
 * parsing filenames, uploading to S3/Spaces, and saving records to SQL Server.
 */

const fs = require('fs')
const path = require('path')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const sql = require('mssql')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const SPACES_ENDPOINT = process.env.SPACES_ENDPOINT || 'https://sgp1.digitaloceanspaces.com'
const SPACES_REGION = process.env.SPACES_REGION || 'sgp1'
const SPACES_KEY = process.env.SPACES_KEY
const SPACES_SECRET = process.env.SPACES_SECRET
const SPACES_BUCKET = process.env.SPACES_BUCKET || 'space-ev7tracking-prod'

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
}

const s3Client = new S3Client({
  endpoint: SPACES_ENDPOINT,
  region: SPACES_REGION,
  credentials: {
    accessKeyId: SPACES_KEY,
    secretAccessKey: SPACES_SECRET
  }
})

// Parse filename function
function parseFileName(fileName) {
  const cleanName = path.basename(fileName, path.extname(fileName))
  const parts = cleanName.split('_')

  if (parts.length < 4) {
    return { isValid: false, error: 'รูปแบบชื่อไฟล์ไม่ถูกต้อง (ต้องมีอย่างน้อย 4 ส่วน)' }
  }

  const prefix = parts[0].toUpperCase() // PLMV หรือ PLMC
  const vinNo = parts[1].toUpperCase()
  const policyNo = parts[2].toUpperCase()
  const expiryRaw = parts[3]

  let docType = 'UNKNOWN'
  if (prefix === 'PLMV') docType = 'INSURANCE'
  else if (prefix === 'PLMC') docType = 'ACT'
  else return { isValid: false, error: `คำนำหน้า "${prefix}" ไม่ถูกต้อง` }

  let policyType = 'UNKNOWN'
  let policyTypeName = 'ไม่ระบุ'
  if (docType === 'INSURANCE') {
    const pCode = policyNo.substring(0, 3).toUpperCase()
    if (['DV1', 'DV2', 'DV3', 'DV5'].includes(pCode)) {
      policyType = pCode
      const names = {
        DV1: 'ประกันภัยชั้น 1',
        DV2: 'ประกันภัยชั้น 2',
        DV3: 'ประกันภัยชั้น 3',
        DV5: 'ประกันภัย 2+,3+'
      }
      policyTypeName = names[pCode]
    } else {
      policyType = 'DV1'
      policyTypeName = 'ประกันภัยภาคสมัครใจ'
    }
  } else if (docType === 'ACT') {
    policyType = 'DAC'
    policyTypeName = 'พ.ร.บ. คุ้มครองผู้ประสบภัยจากรถ'
  }

  // Parse Date: DDMMYYYY (Buddhist Era)
  if (expiryRaw.length !== 8) {
    return { isValid: false, error: `รูปแบบวันหมดอายุ "${expiryRaw}" ไม่ถูกต้อง` }
  }

  const day = expiryRaw.substring(0, 2)
  const month = expiryRaw.substring(2, 4)
  const yearBE = parseInt(expiryRaw.substring(4, 8), 10)
  const yearAD = yearBE >= 2400 ? yearBE - 543 : yearBE

  const expiryDateStr = `${yearAD}-${month}-${day}`
  const startDateStr = `${yearAD - 1}-${month}-${day}`

  return {
    isValid: true,
    prefix,
    docType,
    vinNo,
    policyNo,
    policyType,
    policyTypeName,
    expiryDateStr,
    startDateStr
  }
}

async function run() {
  const targetFolder = process.argv[2]
  if (!targetFolder) {
    console.error('❌ กรุณาระบุโฟลเดอร์ เช่น: node scripts/import_policies_folder.js /path/to/folder')
    process.exit(1)
  }

  if (!fs.existsSync(targetFolder)) {
    console.error(`❌ ไม่พบโฟลเดอร์: ${targetFolder}`)
    process.exit(1)
  }

  console.log(`\n🔍 กำลังสแกนหาไฟล์ PDF ใน: ${targetFolder}...`)
  const allFiles = fs.readdirSync(targetFolder).filter(f => f.toLowerCase().endsWith('.pdf'))
  console.log(`📁 พบไฟล์ PDF ทั้งหมด: ${allFiles.length} ไฟล์\n`)

  if (allFiles.length === 0) {
    console.log('ไม่มีไฟล์ให้อัปโหลด จบการทำงาน.')
    return
  }

  // Connect DB
  console.log('🔌 กำลังเชื่อมต่อฐานข้อมูล SQL Server...')
  const pool = await sql.connect(sqlConfig)
  console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ!\n')

  const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '')
  let completed = 0
  let success = 0
  let failed = 0
  const errors = []

  const CONCURRENCY = 15 // 15 parallel workers
  let fileIndex = 0

  const runWorker = async (workerId) => {
    while (fileIndex < allFiles.length) {
      const idx = fileIndex++
      const fileName = allFiles[idx]
      const filePath = path.join(targetFolder, fileName)

      try {
        const stats = fs.statSync(filePath)
        const parsed = parseFileName(fileName)

        if (!parsed.isValid) {
          failed++
          completed++
          errors.push(`[${fileName}] ${parsed.error}`)
          continue
        }

        // Upload to S3
        const folder = parsed.docType === 'INSURANCE' ? 'Insurance' : 'Act'
        const cleanName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
        const s3Key = `Policies/${folder}/${yearMonth}/${Date.now()}_${cleanName}`

        const fileBuffer = fs.readFileSync(filePath)
        await s3Client.send(new PutObjectCommand({
          Bucket: SPACES_BUCKET,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: 'application/pdf',
          ACL: 'public-read'
        }))

        // Upsert to EV_Policy and insert into EV_PolicyLog
        const req = pool.request()
        req.input('vinNo', sql.VarChar(50), parsed.vinNo)
        req.input('docType', sql.VarChar(50), parsed.docType)
        req.input('policyType', sql.VarChar(20), parsed.policyType)
        req.input('policyTypeName', sql.NVarChar(100), parsed.policyTypeName)
        req.input('policyNo', sql.VarChar(100), parsed.policyNo)
        req.input('startDate', sql.Date, new Date(parsed.startDateStr))
        req.input('endDate', sql.Date, new Date(parsed.expiryDateStr))
        req.input('fileName', sql.NVarChar(250), fileName)
        req.input('filePath', sql.VarChar(500), s3Key)
        req.input('fileSize', sql.BigInt, stats.size)
        req.input('userId', sql.Int, 1)

        const query = `
          BEGIN TRANSACTION;

          DECLARE @regNo VARCHAR(50);
          SELECT TOP 1 @regNo = RegisterNo FROM dbo.EV_InventoryItem WHERE VinNo = @vinNo;

          IF EXISTS (SELECT 1 FROM dbo.EV_Policy WHERE VinNo = @vinNo)
          BEGIN
            IF @docType = 'INSURANCE'
            BEGIN
              UPDATE dbo.EV_Policy
              SET InsurancePolicyNo = @policyNo,
                  InsuranceType = @policyType,
                  InsuranceStartDate = @startDate,
                  InsuranceEndDate = @endDate,
                  InsuranceFilePath = @filePath,
                  RegisterNo = COALESCE(@regNo, RegisterNo),
                  UpdateDate = GETDATE(),
                  UpdateUserID = @userId
              WHERE VinNo = @vinNo;
            END
            ELSE IF @docType = 'ACT'
            BEGIN
              UPDATE dbo.EV_Policy
              SET ActPolicyNo = @policyNo,
                  ActStartDate = @startDate,
                  ActEndDate = @endDate,
                  ActFilePath = @filePath,
                  RegisterNo = COALESCE(@regNo, RegisterNo),
                  UpdateDate = GETDATE(),
                  UpdateUserID = @userId
              WHERE VinNo = @vinNo;
            END
          END
          ELSE
          BEGIN
            INSERT INTO dbo.EV_Policy (
              VinNo, RegisterNo,
              InsurancePolicyNo, InsuranceType, InsuranceStartDate, InsuranceEndDate, InsuranceFilePath,
              ActPolicyNo, ActStartDate, ActEndDate, ActFilePath,
              CreateUserID, CreateDate, IsActive
            ) VALUES (
              @vinNo, @regNo,
              CASE WHEN @docType = 'INSURANCE' THEN @policyNo ELSE NULL END,
              CASE WHEN @docType = 'INSURANCE' THEN @policyType ELSE NULL END,
              CASE WHEN @docType = 'INSURANCE' THEN @startDate ELSE NULL END,
              CASE WHEN @docType = 'INSURANCE' THEN @endDate ELSE NULL END,
              CASE WHEN @docType = 'INSURANCE' THEN @filePath ELSE NULL END,
              CASE WHEN @docType = 'ACT' THEN @policyNo ELSE NULL END,
              CASE WHEN @docType = 'ACT' THEN @startDate ELSE NULL END,
              CASE WHEN @docType = 'ACT' THEN @endDate ELSE NULL END,
              CASE WHEN @docType = 'ACT' THEN @filePath ELSE NULL END,
              @userId, GETDATE(), 1
            );
          END

          -- Mark old logs as inactive
          UPDATE dbo.EV_PolicyLog
          SET IsCurrent = 0
          WHERE VinNo = @vinNo AND DocType = @docType AND IsCurrent = 1;

          -- Insert new Log
          INSERT INTO dbo.EV_PolicyLog (
            VinNo, RegisterNo, DocType, PolicyType, PolicyTypeName,
            PolicyNo, StartDate, EndDate, OriginalFileName, FilePath, FileSize,
            UploadSource, IsCurrent, CreateUserID, CreateDate, IsActive
          ) VALUES (
            @vinNo, @regNo, @docType, @policyType, @policyTypeName,
            @policyNo, @startDate, @endDate, @fileName, @filePath, @fileSize,
            'CLI_FOLDER_IMPORT', 1, @userId, GETDATE(), 1
          );

          COMMIT TRANSACTION;
        `
        await req.query(query)

        success++
      } catch (err) {
        failed++
        errors.push(`[${fileName}] ${err.message}`)
      } finally {
        completed++
        const percent = Math.round((completed / allFiles.length) * 100)
        process.stdout.write(`\r🚀 กำลังประมวลผล: ${completed}/${allFiles.length} (${percent}%) | สำเร็จ: ${success} | ล้มเหลว: ${failed}`)
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, allFiles.length) }, (_, i) => runWorker(i + 1))
  await Promise.all(workers)

  console.log(`\n\n🎉 การนำเข้าเสร็จสิ้น!`)
  console.log(`📊 สรุป: สำเร็จ ${success} ไฟล์, ล้มเหลว ${failed} ไฟล์ จากทั้งหมด ${allFiles.length} ไฟล์`)

  if (errors.length > 0) {
    console.log('\n❌ รายการข้อผิดพลาด (แสดง 10 รายการแรก):')
    errors.slice(0, 10).forEach(e => console.log(' - ' + e))
  }

  await pool.close()
}

run().catch(err => {
  console.error('Fatal Error:', err)
  process.exit(1)
})
