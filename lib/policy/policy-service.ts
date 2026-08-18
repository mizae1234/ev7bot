import { getMSSQLReadOnlyPool, getMSSQLWritePool, sql } from '@/lib/mssql'
import {
  InsuranceMasterType,
  InsuranceCompanyOption,
  PolicyVehicleRecord,
  PolicyStatsSummary,
  PolicyLogItem
} from './policy-types'
import { DEFAULT_INSURANCE_TYPES, computeExpiryStatus } from './policy-constants'

/**
 * 1. Fetch Master Insurance Types from dbo.EV_MsInsuranceType
 */
export async function getInsuranceMasterTypes(): Promise<InsuranceMasterType[]> {
  try {
    const pool = await getMSSQLReadOnlyPool()
    if (!pool) return DEFAULT_INSURANCE_TYPES

    const result = await pool.request().query(`
      SELECT TypeCode AS typeCode, TypeName AS typeName, Category AS category,
             FilePrefix AS filePrefix, Description AS description,
             SortOrder AS sortOrder, IsActive AS isActive
      FROM dbo.EV_MsInsuranceType
      WHERE IsActive = 1
      ORDER BY SortOrder ASC
    `)

    return result.recordset.length > 0 ? result.recordset : DEFAULT_INSURANCE_TYPES
  } catch (err) {
    console.error('[getInsuranceMasterTypes Error]', err)
    return DEFAULT_INSURANCE_TYPES
  }
}

/**
 * 1.1 Fetch Insurance Companies from dbo.EV_MsSubStatus (Type = 'INSURANCE')
 */
export async function getInsuranceCompanies(): Promise<InsuranceCompanyOption[]> {
  try {
    const pool = await getMSSQLReadOnlyPool()
    if (!pool) return [{ statusCode: 'ICARE_INSURANCE', statusName: 'ไอแคร์ประกันภัย' }]

    const result = await pool.request().query(`
      SELECT StatusCode AS statusCode, StatusName AS statusName
      FROM dbo.EV_MsSubStatus
      WHERE Type = 'INSURANCE' AND IsActive = 1
      ORDER BY StatusCode ASC
    `)

    return result.recordset.length > 0
      ? result.recordset
      : [{ statusCode: 'ICARE_INSURANCE', statusName: 'ไอแคร์ประกันภัย' }]
  } catch (err) {
    console.error('[getInsuranceCompanies Error]', err)
    return [{ statusCode: 'ICARE_INSURANCE', statusName: 'ไอแคร์ประกันภัย' }]
  }
}

/**
 * 2. Get Paginated Policy & Tax List with Filtering
 */
export async function getPolicyList(params: {
  search?: string
  expiryFilter?: string  // 'ALL' | 'EXPIRING_30' | 'EXPIRING_60' | 'EXPIRED' | 'ACTIVE' | 'MISSING'
  missingFilter?: string // 'ALL' | 'MISSING_INSURANCE' | 'MISSING_ACT' | 'MISSING_VEHICLE_TAX' | 'MISSING_METER_TAX' | 'MISSING_ANY' | 'MISSING_ALL' | 'COMPLETE'
  typeFilter?: string    // 'ALL' | 'DV1' | 'DV2' | 'DV3' | 'DV5' | 'DAC'
  categoryFilter?: string // 'ALL' | 'INSURANCE' | 'ACT' | 'TAX' | 'METER'
  projectFilter?: string
  modelFilter?: string
  statusFilter?: string
  page?: number
  limit?: number
}): Promise<{
  records: PolicyVehicleRecord[]
  total: number
  page: number
  totalPages: number
  stats: PolicyStatsSummary
}> {
  const pool = await getMSSQLReadOnlyPool()
  if (!pool) throw new Error('Database connection failed')

  const page = params.page || 1
  const limit = params.limit || 50
  const offset = (page - 1) * limit

  const req = pool.request()

  let whereClause = 'WHERE i.IsActive = 1'

  if (params.search) {
    req.input('search', sql.NVarChar, `%${params.search.trim()}%`)
    whereClause += ` AND (
      i.VinNo LIKE @search
      OR i.RegisterNo LIKE @search
      OR p.InsurancePolicyNo LIKE @search
      OR p.ActPolicyNo LIKE @search
      OR p.InsuranceCompany LIKE @search
      OR p.ActCompany LIKE @search
    )`
  }

  if (params.projectFilter && params.projectFilter !== 'ALL') {
    req.input('project', sql.NVarChar, params.projectFilter)
    whereClause += ' AND (i.Project = @project OR i.ProjectType = @project)'
  }

  if (params.modelFilter && params.modelFilter !== 'ALL') {
    req.input('model', sql.NVarChar, params.modelFilter)
    whereClause += ' AND i.Model = @model'
  }

  if (params.statusFilter && params.statusFilter !== 'ALL') {
    req.input('statusFilter', sql.NVarChar, params.statusFilter)
    whereClause += ' AND (i.Status = @statusFilter OR i.StatusType = @statusFilter)'
  }

  if (params.typeFilter && params.typeFilter !== 'ALL') {
    req.input('insType', sql.VarChar, params.typeFilter)
    whereClause += ' AND (p.InsuranceType = @insType OR (p.ActPolicyNo IS NOT NULL AND @insType = \'DAC\'))'
  }

  // Base Query joining EV_InventoryItem with EV_Policy
  const query = `
    WITH VehicleData AS (
      SELECT
        i.InventoryItemID AS inventoryItemId,
        i.VinNo AS vinNo,
        i.RegisterNo AS registerNo,
        i.Model AS model,
        i.Project AS project,
        i.ProjectType AS projectType,
        i.CurrentLocation AS currentLocation,
        ISNULL(loc.StatusName, i.CurrentLocation) AS locationName,
        i.Status AS status,
        i.StatusType AS statusType,
        COALESCE(
          ISNULL(sub_st.DescriptionStatus, sub_st.StatusName),
          ISNULL(sub_s.DescriptionStatus, sub_s.StatusName),
          i.StatusType,
          i.Status
        ) AS statusName,

        -- Insurance
        p.InsurancePolicyNo AS insurancePolicyNo,
        p.InsuranceType AS insuranceType,
        m.TypeName AS insuranceTypeName,
        CONVERT(VARCHAR(10), p.InsuranceStartDate, 120) AS insuranceStartDate,
        CONVERT(VARCHAR(10), p.InsuranceEndDate, 120) AS insuranceEndDate,
        p.InsuranceFilePath AS insuranceFilePath,
        p.InsuranceCompany AS insuranceCompany,

        -- Act
        p.ActPolicyNo AS actPolicyNo,
        CONVERT(VARCHAR(10), p.ActStartDate, 120) AS actStartDate,
        CONVERT(VARCHAR(10), p.ActEndDate, 120) AS actEndDate,
        p.ActFilePath AS actFilePath,
        p.ActCompany AS actCompany,

        -- Vehicle Tax
        CONVERT(VARCHAR(10), p.VehicleTaxStartDate, 120) AS vehicleTaxStartDate,
        CONVERT(VARCHAR(10), p.VehicleTaxEndDate, 120) AS vehicleTaxEndDate,
        p.VehicleTaxFilePath AS vehicleTaxFilePath,

        -- Meter Tax
        CONVERT(VARCHAR(10), p.MeterTaxStartDate, 120) AS meterTaxStartDate,
        CONVERT(VARCHAR(10), p.MeterTaxEndDate, 120) AS meterTaxEndDate,
        p.MeterTaxFilePath AS meterTaxFilePath,

        CONVERT(VARCHAR(19), p.UpdateDate, 120) AS updatedAt
      FROM dbo.EV_InventoryItem i
      LEFT JOIN dbo.EV_Policy p ON i.VinNo = p.VinNo AND p.IsActive = 1
      LEFT JOIN dbo.EV_MsInsuranceType m ON p.InsuranceType = m.TypeCode
      LEFT JOIN dbo.EV_MsSubStatus sub_st ON i.StatusType = sub_st.StatusCode AND sub_st.Type LIKE 'STATUS_TYPE_%'
      LEFT JOIN dbo.EV_MsSubStatus sub_s ON i.Status = sub_s.StatusCode AND sub_s.Type = 'STATUS'
      LEFT JOIN dbo.EV_MsSubStatus loc ON i.CurrentLocation = loc.StatusCode AND loc.Type = 'LOCATION'
      ${whereClause}
    )
    SELECT * FROM VehicleData
  `

  const result = await req.query(query)
  const allRows = result.recordset as any[]

  // Process expiry status & compute stats
  let insuranceExpiring30 = 0
  let insuranceExpiring60 = 0
  let insuranceExpired = 0
  let insuranceMissing = 0

  let actExpiring30 = 0
  let actExpiring60 = 0
  let actExpired = 0
  let actMissing = 0

  let taxExpiring30 = 0
  let taxExpiring60 = 0
  let taxExpired = 0
  let taxMissing = 0

  let meterExpiring30 = 0
  let meterExpiring60 = 0
  let meterExpired = 0
  let meterMissing = 0

  let totalWithPolicy = 0
  let totalMissingAll = 0
  let totalMissingAny = 0

  const processed: PolicyVehicleRecord[] = allRows.map(row => {
    const ins = computeExpiryStatus(row.insuranceEndDate)
    const act = computeExpiryStatus(row.actEndDate)
    const tax = computeExpiryStatus(row.vehicleTaxEndDate)
    const meter = computeExpiryStatus(row.meterTaxEndDate)

    const hasAnyDoc = !!(row.insurancePolicyNo || row.actPolicyNo || row.vehicleTaxEndDate || row.meterTaxEndDate)
    if (hasAnyDoc) {
      totalWithPolicy++
    }

    if (ins.status === 'EXPIRED') insuranceExpired++
    else if (ins.status === 'WARNING_30') insuranceExpiring30++
    else if (ins.status === 'WARNING_60') insuranceExpiring60++
    else if (ins.status === 'MISSING') insuranceMissing++

    if (act.status === 'EXPIRED') actExpired++
    else if (act.status === 'WARNING_30') actExpiring30++
    else if (act.status === 'WARNING_60') actExpiring60++
    else if (act.status === 'MISSING') actMissing++

    if (tax.status === 'EXPIRED') taxExpired++
    else if (tax.status === 'WARNING_30') taxExpiring30++
    else if (tax.status === 'WARNING_60') taxExpiring60++
    else if (tax.status === 'MISSING') taxMissing++

    if (meter.status === 'EXPIRED') meterExpired++
    else if (meter.status === 'WARNING_30') meterExpiring30++
    else if (meter.status === 'WARNING_60') meterExpiring60++
    else if (meter.status === 'MISSING') meterMissing++

    const isMissingAll = ins.status === 'MISSING' && act.status === 'MISSING' && tax.status === 'MISSING' && meter.status === 'MISSING'
    const isMissingAny = ins.status === 'MISSING' || act.status === 'MISSING' || tax.status === 'MISSING' || meter.status === 'MISSING'

    if (isMissingAll) totalMissingAll++
    if (isMissingAny) totalMissingAny++

    return {
      ...row,
      insuranceStatus: ins.status,
      insuranceDaysLeft: ins.daysLeft,
      actStatus: act.status,
      actDaysLeft: act.daysLeft,
      vehicleTaxStatus: tax.status,
      vehicleTaxDaysLeft: tax.daysLeft,
      meterTaxStatus: meter.status,
      meterTaxDaysLeft: meter.daysLeft
    }
  })

  // Post-filter by expiry status and/or missing status
  let filtered = processed

  if (params.expiryFilter && params.expiryFilter !== 'ALL') {
    filtered = filtered.filter(r => {
      if (params.expiryFilter === 'EXPIRING_30') {
        return r.insuranceStatus === 'WARNING_30' || r.actStatus === 'WARNING_30' || r.vehicleTaxStatus === 'WARNING_30' || r.meterTaxStatus === 'WARNING_30'
      }
      if (params.expiryFilter === 'EXPIRING_60') {
        return r.insuranceStatus === 'WARNING_60' || r.actStatus === 'WARNING_60' || r.vehicleTaxStatus === 'WARNING_60' || r.meterTaxStatus === 'WARNING_60'
      }
      if (params.expiryFilter === 'EXPIRED') {
        return r.insuranceStatus === 'EXPIRED' || r.actStatus === 'EXPIRED' || r.vehicleTaxStatus === 'EXPIRED' || r.meterTaxStatus === 'EXPIRED'
      }
      if (params.expiryFilter === 'ACTIVE') {
        return r.insuranceStatus === 'ACTIVE' || r.actStatus === 'ACTIVE'
      }
      if (params.expiryFilter === 'MISSING' || params.expiryFilter === 'MISSING_ANY') {
        return r.insuranceStatus === 'MISSING' || r.actStatus === 'MISSING' || r.vehicleTaxStatus === 'MISSING' || r.meterTaxStatus === 'MISSING'
      }
      if (params.expiryFilter === 'MISSING_INSURANCE') {
        return r.insuranceStatus === 'MISSING'
      }
      if (params.expiryFilter === 'MISSING_ACT') {
        return r.actStatus === 'MISSING'
      }
      if (params.expiryFilter === 'MISSING_VEHICLE_TAX') {
        return r.vehicleTaxStatus === 'MISSING'
      }
      if (params.expiryFilter === 'MISSING_METER_TAX') {
        return r.meterTaxStatus === 'MISSING'
      }
      if (params.expiryFilter === 'MISSING_ALL') {
        return r.insuranceStatus === 'MISSING' && r.actStatus === 'MISSING' && r.vehicleTaxStatus === 'MISSING' && r.meterTaxStatus === 'MISSING'
      }
      return true
    })
  }

  if (params.missingFilter && params.missingFilter !== 'ALL') {
    filtered = filtered.filter(r => {
      if (params.missingFilter === 'MISSING_INSURANCE') {
        return r.insuranceStatus === 'MISSING'
      }
      if (params.missingFilter === 'MISSING_ACT') {
        return r.actStatus === 'MISSING'
      }
      if (params.missingFilter === 'MISSING_VEHICLE_TAX') {
        return r.vehicleTaxStatus === 'MISSING'
      }
      if (params.missingFilter === 'MISSING_METER_TAX') {
        return r.meterTaxStatus === 'MISSING'
      }
      if (params.missingFilter === 'MISSING_ANY') {
        return r.insuranceStatus === 'MISSING' || r.actStatus === 'MISSING' || r.vehicleTaxStatus === 'MISSING' || r.meterTaxStatus === 'MISSING'
      }
      if (params.missingFilter === 'MISSING_ALL') {
        return r.insuranceStatus === 'MISSING' && r.actStatus === 'MISSING' && r.vehicleTaxStatus === 'MISSING' && r.meterTaxStatus === 'MISSING'
      }
      if (params.missingFilter === 'COMPLETE') {
        return r.insuranceStatus !== 'MISSING' && r.actStatus !== 'MISSING' && r.vehicleTaxStatus !== 'MISSING'
      }
      return true
    })
  }

  // Pagination
  const total = filtered.length
  const totalPages = Math.ceil(total / limit) || 1
  const paginatedRecords = filtered.slice(offset, offset + limit)

  const stats: PolicyStatsSummary = {
    totalVehicles: processed.length,
    insuranceExpiring30,
    insuranceExpiring60,
    insuranceExpired,
    insuranceMissing,
    actExpiring30,
    actExpiring60,
    actExpired,
    actMissing,
    taxExpiring30,
    taxExpiring60,
    taxExpired,
    taxMissing,
    meterExpiring30,
    meterExpiring60,
    meterExpired,
    meterMissing,
    totalWithPolicy,
    totalMissingAll,
    totalMissingAny
  }

  return {
    records: paginatedRecords,
    total,
    page,
    totalPages,
    stats
  }
}

/**
 * 3. Match VIN with Inventory Item
 */
export async function matchVehicleByVin(vinNo: string) {
  const pool = await getMSSQLReadOnlyPool()
  if (!pool) return null

  const result = await pool.request().input('vin', sql.VarChar, vinNo).query(`
    SELECT InventoryItemID AS inventoryItemId, RegisterNo AS registerNo, Model AS model, Project AS project
    FROM dbo.EV_InventoryItem
    WHERE VinNo = @vin
  `)

  return result.recordset[0] || null
}

/**
 * 4. Save Uploaded PDF Policy Record (PLMV or PLMC) + Archive to Log
 */
export async function savePolicyPdfRecord(params: {
  vinNo: string
  registerNo?: string | null
  docType: 'INSURANCE' | 'ACT'
  policyType?: string | null
  policyTypeName?: string | null
  policyNo: string
  startDate?: string | null
  endDate: string
  originalFileName: string
  filePath: string // S3 Key
  fileSize: number
  company?: string | null
  userId?: number | null
}) {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Write database connection failed')

  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    const regReq = new sql.Request(transaction)
    regReq.input('vinNo', sql.VarChar, params.vinNo)

    // Lookup registerNo if not provided
    let registerNo = params.registerNo
    if (!registerNo) {
      const inv = await regReq.query(`SELECT RegisterNo FROM dbo.EV_InventoryItem WHERE VinNo = @vinNo`)
      registerNo = inv.recordset[0]?.RegisterNo || null
    }

    // 1. Archive previous current policy in EV_PolicyLog
    const archiveReq = new sql.Request(transaction)
    archiveReq.input('vinNo', sql.VarChar, params.vinNo)
    archiveReq.input('docType', sql.VarChar, params.docType)
    await archiveReq.query(`
      UPDATE dbo.EV_PolicyLog
      SET IsCurrent = 0
      WHERE VinNo = @vinNo AND DocType = @docType AND IsCurrent = 1
    `)

    // 2. Insert new entry in EV_PolicyLog
    const logReq = new sql.Request(transaction)
    logReq.input('vinNo', sql.VarChar, params.vinNo)
    logReq.input('registerNo', sql.VarChar, registerNo || null)
    logReq.input('docType', sql.VarChar, params.docType)
    logReq.input('policyType', sql.VarChar, params.policyType || null)
    logReq.input('policyTypeName', sql.NVarChar, params.policyTypeName || null)
    logReq.input('policyNo', sql.VarChar, params.policyNo)
    logReq.input('company', sql.NVarChar, params.company || 'ไอแคร์ประกันภัย')
    logReq.input('startDate', sql.Date, params.startDate ? new Date(params.startDate) : null)
    logReq.input('endDate', sql.Date, new Date(params.endDate))
    logReq.input('originalFileName', sql.NVarChar, params.originalFileName)
    logReq.input('filePath', sql.VarChar, params.filePath)
    logReq.input('fileSize', sql.BigInt, params.fileSize)
    logReq.input('uploadSource', sql.VarChar, 'BATCH_PDF_UPLOAD')
    logReq.input('createUserId', sql.Int, params.userId || 1)

    await logReq.query(`
      INSERT INTO dbo.EV_PolicyLog (
        VinNo, RegisterNo, DocType, PolicyType, PolicyTypeName, PolicyNo,
        InsuranceCompany, StartDate, EndDate, OriginalFileName, FilePath, FileSize, UploadSource,
        IsCurrent, IsActive, CreateDate, CreateUserID
      )
      VALUES (
        @vinNo, @registerNo, @docType, @policyType, @policyTypeName, @policyNo,
        @company, @startDate, @endDate, @originalFileName, @filePath, @fileSize, @uploadSource,
        1, 1, GETDATE(), @createUserId
      )
    `)

    // 3. Upsert into dbo.EV_Policy
    const upsertReq = new sql.Request(transaction)
    upsertReq.input('vinNo', sql.VarChar, params.vinNo)
    upsertReq.input('registerNo', sql.VarChar, registerNo || null)
    upsertReq.input('policyNo', sql.VarChar, params.policyNo)
    upsertReq.input('company', sql.NVarChar, params.company || 'ไอแคร์ประกันภัย')
    upsertReq.input('startDate', sql.Date, params.startDate ? new Date(params.startDate) : null)
    upsertReq.input('endDate', sql.Date, new Date(params.endDate))
    upsertReq.input('filePath', sql.VarChar, params.filePath)
    upsertReq.input('userId', sql.Int, params.userId || 1)

    if (params.docType === 'INSURANCE') {
      upsertReq.input('policyType', sql.VarChar, params.policyType || null)
      await upsertReq.query(`
        IF EXISTS (SELECT 1 FROM dbo.EV_Policy WHERE VinNo = @vinNo)
        BEGIN
          UPDATE dbo.EV_Policy
          SET RegisterNo = COALESCE(@registerNo, RegisterNo),
              InsurancePolicyNo = @policyNo,
              InsuranceType = @policyType,
              InsuranceCompany = @company,
              InsuranceStartDate = @startDate,
              InsuranceEndDate = @endDate,
              InsuranceFilePath = @filePath,
              UpdateDate = GETDATE(),
              UpdateUserID = @userId
          WHERE VinNo = @vinNo;
        END
        ELSE
        BEGIN
          INSERT INTO dbo.EV_Policy (
            VinNo, RegisterNo, InsurancePolicyNo, InsuranceType, InsuranceCompany,
            InsuranceStartDate, InsuranceEndDate, InsuranceFilePath,
            IsActive, CreateDate, CreateUserID
          )
          VALUES (
            @vinNo, @registerNo, @policyNo, @policyType, @company,
            @startDate, @endDate, @filePath,
            1, GETDATE(), @userId
          );
        END
      `)
    } else {
      // ACT (พ.ร.บ.)
      await upsertReq.query(`
        IF EXISTS (SELECT 1 FROM dbo.EV_Policy WHERE VinNo = @vinNo)
        BEGIN
          UPDATE dbo.EV_Policy
          SET RegisterNo = COALESCE(@registerNo, RegisterNo),
              ActPolicyNo = @policyNo,
              ActCompany = @company,
              ActStartDate = @startDate,
              ActEndDate = @endDate,
              ActFilePath = @filePath,
              UpdateDate = GETDATE(),
              UpdateUserID = @userId
          WHERE VinNo = @vinNo;
        END
        ELSE
        BEGIN
          INSERT INTO dbo.EV_Policy (
            VinNo, RegisterNo, ActPolicyNo, ActCompany,
            ActStartDate, ActEndDate, ActFilePath,
            IsActive, CreateDate, CreateUserID
          )
          VALUES (
            @vinNo, @registerNo, @policyNo, @company,
            @startDate, @endDate, @filePath,
            1, GETDATE(), @userId
          );
        END
      `)
    }

    await transaction.commit()
    return { success: true }
  } catch (err) {
    await transaction.rollback()
    console.error('[savePolicyPdfRecord Error]', err)
    throw err
  }
}

/**
 * 5. Import Tax and Meter Records from Excel
 */
export async function importTaxRecords(
  rows: Array<{
    vinNo: string
    vehicleTaxStartDate?: string | null
    vehicleTaxEndDate?: string | null
    meterTaxStartDate?: string | null
    meterTaxEndDate?: string | null
    remark?: string | null
  }>,
  userId = 1
) {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Write database connection failed')

  let updatedCount = 0
  const errors: string[] = []

  for (const row of rows) {
    if (!row.vinNo) continue
    const cleanVin = row.vinNo.trim().toUpperCase()

    try {
      // 1. Get registerNo
      const regReq = pool.request()
      regReq.input('vin', sql.VarChar, cleanVin)
      const inv = await regReq.query('SELECT RegisterNo FROM dbo.EV_InventoryItem WHERE VinNo = @vin')
      const registerNo = inv.recordset[0]?.RegisterNo || null

      // 2. Upsert EV_Policy
      const upReq = pool.request()
      upReq.input('vinNo', sql.VarChar, cleanVin)
      upReq.input('registerNo', sql.VarChar, registerNo)
      upReq.input('vTaxStart', sql.Date, row.vehicleTaxStartDate ? new Date(row.vehicleTaxStartDate) : null)
      upReq.input('vTaxEnd', sql.Date, row.vehicleTaxEndDate ? new Date(row.vehicleTaxEndDate) : null)
      upReq.input('mTaxStart', sql.Date, row.meterTaxStartDate ? new Date(row.meterTaxStartDate) : null)
      upReq.input('mTaxEnd', sql.Date, row.meterTaxEndDate ? new Date(row.meterTaxEndDate) : null)
      upReq.input('userId', sql.Int, userId)

      await upReq.query(`
        IF EXISTS (SELECT 1 FROM dbo.EV_Policy WHERE VinNo = @vinNo)
        BEGIN
          UPDATE dbo.EV_Policy
          SET RegisterNo = COALESCE(@registerNo, RegisterNo),
              VehicleTaxStartDate = COALESCE(@vTaxStart, VehicleTaxStartDate),
              VehicleTaxEndDate = COALESCE(@vTaxEnd, VehicleTaxEndDate),
              MeterTaxStartDate = COALESCE(@mTaxStart, MeterTaxStartDate),
              MeterTaxEndDate = COALESCE(@mTaxEnd, MeterTaxEndDate),
              UpdateDate = GETDATE(),
              UpdateUserID = @userId
          WHERE VinNo = @vinNo;
        END
        ELSE
        BEGIN
          INSERT INTO dbo.EV_Policy (
            VinNo, RegisterNo, VehicleTaxStartDate, VehicleTaxEndDate,
            MeterTaxStartDate, MeterTaxEndDate, IsActive, CreateDate, CreateUserID
          )
          VALUES (
            @vinNo, @registerNo, @vTaxStart, @vTaxEnd,
            @mTaxStart, @mTaxEnd, 1, GETDATE(), @userId
          );
        END
      `)

      // 3. Log Vehicle Tax if provided
      if (row.vehicleTaxEndDate) {
        const logReq1 = pool.request()
        logReq1.input('vinNo', sql.VarChar, cleanVin)
        logReq1.input('registerNo', sql.VarChar, registerNo)
        logReq1.input('startDate', sql.Date, row.vehicleTaxStartDate ? new Date(row.vehicleTaxStartDate) : null)
        logReq1.input('endDate', sql.Date, new Date(row.vehicleTaxEndDate))
        logReq1.input('remark', sql.NVarChar, row.remark || 'นำเข้าผ่าน Excel')
        logReq1.input('userId', sql.Int, userId)

        await logReq1.query(`
          UPDATE dbo.EV_PolicyLog SET IsCurrent = 0 WHERE VinNo = @vinNo AND DocType = 'VEHICLE_TAX' AND IsCurrent = 1;
          INSERT INTO dbo.EV_PolicyLog (VinNo, RegisterNo, DocType, PolicyType, PolicyTypeName, StartDate, EndDate, UploadSource, IsCurrent, Remark, IsActive, CreateDate, CreateUserID)
          VALUES (@vinNo, @registerNo, 'VEHICLE_TAX', 'TAX_VEHICLE', N'ภาษีรถยนต์ประจำปี', @startDate, @endDate, 'EXCEL_IMPORT', 1, @remark, 1, GETDATE(), @userId);
        `)
      }

      // 4. Log Meter Tax if provided
      if (row.meterTaxEndDate) {
        const logReq2 = pool.request()
        logReq2.input('vinNo', sql.VarChar, cleanVin)
        logReq2.input('registerNo', sql.VarChar, registerNo)
        logReq2.input('startDate', sql.Date, row.meterTaxStartDate ? new Date(row.meterTaxStartDate) : null)
        logReq2.input('endDate', sql.Date, new Date(row.meterTaxEndDate))
        logReq2.input('remark', sql.NVarChar, row.remark || 'นำเข้าผ่าน Excel')
        logReq2.input('userId', sql.Int, userId)

        await logReq2.query(`
          UPDATE dbo.EV_PolicyLog SET IsCurrent = 0 WHERE VinNo = @vinNo AND DocType = 'METER_TAX' AND IsCurrent = 1;
          INSERT INTO dbo.EV_PolicyLog (VinNo, RegisterNo, DocType, PolicyType, PolicyTypeName, StartDate, EndDate, UploadSource, IsCurrent, Remark, IsActive, CreateDate, CreateUserID)
          VALUES (@vinNo, @registerNo, 'METER_TAX', 'TAX_METER', N'ภาษีตรวจมิเตอร์แท็กซี่', @startDate, @endDate, 'EXCEL_IMPORT', 1, @remark, 1, GETDATE(), @userId);
        `)
      }

      updatedCount++
    } catch (err: any) {
      errors.push(`VIN: ${cleanVin} เกิดข้อผิดพลาด: ${err.message}`)
    }
  }

  return {
    success: true,
    totalRows: rows.length,
    updatedCount,
    errors
  }
}

/**
 * 6. Get Policy Audit Logs by VIN
 */
export async function getPolicyHistoryByVin(vinNo: string): Promise<PolicyLogItem[]> {
  const pool = await getMSSQLReadOnlyPool()
  if (!pool) return []

  const result = await pool.request().input('vin', sql.VarChar, vinNo).query(`
    SELECT
      l.LogID AS logId,
      l.VinNo AS vinNo,
      l.RegisterNo AS registerNo,
      l.DocType AS docType,
      l.PolicyType AS policyType,
      l.PolicyTypeName AS policyTypeName,
      l.PolicyNo AS policyNo,
      l.InsuranceCompany AS insuranceCompany,
      CONVERT(VARCHAR(10), l.StartDate, 120) AS startDate,
      CONVERT(VARCHAR(10), l.EndDate, 120) AS endDate,
      l.OriginalFileName AS originalFileName,
      l.FilePath AS filePath,
      l.FileSize AS fileSize,
      l.UploadSource AS uploadSource,
      l.IsCurrent AS isCurrent,
      l.Remark AS remark,
      CONVERT(VARCHAR(19), l.CreateDate, 120) AS createDate,
      ISNULL(NULLIF(u.FirstName + ' ' + ISNULL(u.LastName, ''), ''), u.UserName) AS createUserName
    FROM dbo.EV_PolicyLog l
    LEFT JOIN dbo.EV_User u ON l.CreateUserID = u.UserID
    WHERE l.VinNo = @vin AND l.IsActive = 1
    ORDER BY l.LogID DESC
  `)

  return result.recordset
}

/**
 * 7. Update Single Vehicle Policy / Tax Record Manually
 */
export async function updateSinglePolicy(params: {
  vinNo: string
  registerNo?: string | null
  insurancePolicyNo?: string | null
  insuranceType?: string | null
  insuranceStartDate?: string | null
  insuranceEndDate?: string | null
  insuranceCompany?: string | null
  actPolicyNo?: string | null
  actStartDate?: string | null
  actEndDate?: string | null
  actCompany?: string | null
  vehicleTaxStartDate?: string | null
  vehicleTaxEndDate?: string | null
  meterTaxStartDate?: string | null
  meterTaxEndDate?: string | null
  insuranceFilePath?: string | null
  actFilePath?: string | null
  vehicleTaxFilePath?: string | null
  meterTaxFilePath?: string | null
  userId?: number | null
}) {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Write database connection failed')

  const req = pool.request()
  req.input('vinNo', sql.VarChar, params.vinNo)
  req.input('registerNo', sql.VarChar, params.registerNo || null)
  req.input('insPolicyNo', sql.VarChar, params.insurancePolicyNo || null)
  req.input('insType', sql.VarChar, params.insuranceType || null)
  req.input('insStart', sql.Date, params.insuranceStartDate ? new Date(params.insuranceStartDate) : null)
  req.input('insEnd', sql.Date, params.insuranceEndDate ? new Date(params.insuranceEndDate) : null)
  req.input('insComp', sql.NVarChar, params.insuranceCompany || null)
  req.input('insFile', sql.VarChar, params.insuranceFilePath || null)
  req.input('actPolicyNo', sql.VarChar, params.actPolicyNo || null)
  req.input('actStart', sql.Date, params.actStartDate ? new Date(params.actStartDate) : null)
  req.input('actEnd', sql.Date, params.actEndDate ? new Date(params.actEndDate) : null)
  req.input('actComp', sql.NVarChar, params.actCompany || null)
  req.input('actFile', sql.VarChar, params.actFilePath || null)
  req.input('vTaxStart', sql.Date, params.vehicleTaxStartDate ? new Date(params.vehicleTaxStartDate) : null)
  req.input('vTaxEnd', sql.Date, params.vehicleTaxEndDate ? new Date(params.vehicleTaxEndDate) : null)
  req.input('vTaxFile', sql.VarChar, params.vehicleTaxFilePath || null)
  req.input('mTaxStart', sql.Date, params.meterTaxStartDate ? new Date(params.meterTaxStartDate) : null)
  req.input('mTaxEnd', sql.Date, params.meterTaxEndDate ? new Date(params.meterTaxEndDate) : null)
  req.input('mTaxFile', sql.VarChar, params.meterTaxFilePath || null)
  req.input('userId', sql.Int, params.userId || 1)

  await req.query(`
    IF EXISTS (SELECT 1 FROM dbo.EV_Policy WHERE VinNo = @vinNo)
    BEGIN
      UPDATE dbo.EV_Policy
      SET RegisterNo = COALESCE(@registerNo, RegisterNo),
          InsurancePolicyNo = @insPolicyNo,
          InsuranceType = @insType,
          InsuranceStartDate = @insStart,
          InsuranceEndDate = @insEnd,
          InsuranceCompany = @insComp,
          InsuranceFilePath = COALESCE(@insFile, InsuranceFilePath),
          ActPolicyNo = @actPolicyNo,
          ActStartDate = @actStart,
          ActEndDate = @actEnd,
          ActCompany = @actComp,
          ActFilePath = COALESCE(@actFile, ActFilePath),
          VehicleTaxStartDate = @vTaxStart,
          VehicleTaxEndDate = @vTaxEnd,
          VehicleTaxFilePath = COALESCE(@vTaxFile, VehicleTaxFilePath),
          MeterTaxStartDate = @mTaxStart,
          MeterTaxEndDate = @mTaxEnd,
          MeterTaxFilePath = COALESCE(@mTaxFile, MeterTaxFilePath),
          UpdateDate = GETDATE(),
          UpdateUserID = @userId
      WHERE VinNo = @vinNo;
    END
    ELSE
    BEGIN
      INSERT INTO dbo.EV_Policy (
        VinNo, RegisterNo, InsurancePolicyNo, InsuranceType, InsuranceStartDate, InsuranceEndDate, InsuranceCompany, InsuranceFilePath,
        ActPolicyNo, ActStartDate, ActEndDate, ActCompany, ActFilePath, VehicleTaxStartDate, VehicleTaxEndDate, VehicleTaxFilePath,
        MeterTaxStartDate, MeterTaxEndDate, MeterTaxFilePath, IsActive, CreateDate, CreateUserID
      )
      VALUES (
        @vinNo, @registerNo, @insPolicyNo, @insType, @insStart, @insEnd, @insComp, @insFile,
        @actPolicyNo, @actStart, @actEnd, @actComp, @actFile, @vTaxStart, @vTaxEnd, @vTaxFile,
        @mTaxStart, @mTaxEnd, @mTaxFile, 1, GETDATE(), @userId
      );
    END
  `)

  return { success: true }
}
