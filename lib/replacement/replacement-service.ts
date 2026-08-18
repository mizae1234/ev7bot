import { getMSSQLReadOnlyPool, sql } from '@/lib/mssql'
import {
  ReplacementActiveItem,
  ReplacementPoolCar,
  ReplacementHistoryItem,
  ReplacementStatsSummary,
  ReplacementFilterOptions
} from './replacement-types'
import { calculateDaysInUse, getDurationBadge } from './replacement-constants'

/**
 * 1. Get Active Replacement Cars (Currently paired with damaged/repairing cars)
 */
export async function getActiveReplacements(
  options: ReplacementFilterOptions = {}
): Promise<{
  records: ReplacementActiveItem[]
  total: number
  page: number
  totalPages: number
}> {
  const pool = await getMSSQLReadOnlyPool()
  if (!pool) return { records: [], total: 0, page: 1, totalPages: 1 }

  const page = options.page && options.page > 0 ? options.page : 1
  const limit = options.limit && options.limit > 0 ? options.limit : 50
  const offset = (page - 1) * limit

  // Main Active Replacement Query
  const query = `
    SELECT 
      r.ReplacementItemID AS replacementItemId,
      r.MaintenanceItemID AS maintenanceItemId,
      r.VinNo AS replacementVin,
      replCar.RegisterNo AS replacementRegisterNo,
      replCar.Model AS replacementModel,
      COALESCE(r.Location, replCar.CurrentLocation, replCar.ReplacementLocation) AS replacementLocation,
      locSub.StatusName AS replacementLocationName,
      replCar.StatusType AS replacementStatus,
      m.InventoryItemID AS mainInventoryItemId,
      mainCar.RegisterNo AS mainRegisterNo,
      mainCar.VinNo AS mainVinNo,
      mainCar.Model AS mainModel,
      mainCar.StatusType AS mainStatus,
      mainCar.CurrentLocation AS mainLocation,
      m.IssueTitle AS issueTitle,
      m.MaintenanceStartDate AS maintenanceStartDate,
      m.MaintenanceFinishDate AS maintenanceFinishDate,
      m.ServiceLocationCode AS garageName,
      m.DriverName AS technicianName,
      m.ProblemTypeCode AS serviceType,
      r.ReplacementStartDate AS replacementStartDate,
      r.ReplacementReturnDate AS replacementReturnDate,
      r.Remark AS remark,
      COALESCE(NULLIF(RTRIM(LTRIM(CONCAT(createUser.FirstName, ' ', createUser.LastName))), ''), createUser.UserName) AS createUserName,
      r.CreateDate AS createDate,
      COALESCE(NULLIF(RTRIM(LTRIM(CONCAT(updateUser.FirstName, ' ', updateUser.LastName))), ''), updateUser.UserName) AS updateUserName,
      r.UpdateDate AS updateDate
    FROM dbo.EV_ReplacementItem r
    INNER JOIN dbo.EV_MaintenanceItem m ON r.MaintenanceItemID = m.MaintenanceItemID
    LEFT JOIN dbo.EV_InventoryItem mainCar ON m.InventoryItemID = mainCar.InventoryItemID
    LEFT JOIN dbo.EV_InventoryItem replCar ON r.VinNo = replCar.VinNo
    LEFT JOIN dbo.EV_MsSubStatus locSub ON COALESCE(r.Location, replCar.CurrentLocation) = locSub.StatusCode AND locSub.Type = 'LOCATION'
    LEFT JOIN dbo.EV_User createUser ON r.CreateUserID = createUser.UserID
    LEFT JOIN dbo.EV_User updateUser ON r.UpdateUserID = updateUser.UserID
    WHERE r.IsActive = 1 AND (r.ReplacementReturnDate IS NULL OR r.ReplacementReturnDate >= CAST(GETDATE() AS DATE))
    ORDER BY r.ReplacementStartDate DESC, r.ReplacementItemID DESC
  `

  const result = await pool.request().query(query)
  let allRows: ReplacementActiveItem[] = (result.recordset || []).map((row: Record<string, unknown>) => {
    const daysInUse = calculateDaysInUse(row.replacementStartDate as string | null, row.replacementReturnDate as string | null)
    const badge = getDurationBadge(daysInUse)

    return {
      replacementItemId: Number(row.replacementItemId),
      maintenanceItemId: Number(row.maintenanceItemId),
      replacementVin: (row.replacementVin as string) || '',
      replacementRegisterNo: (row.replacementRegisterNo as string) || null,
      replacementModel: (row.replacementModel as string) || null,
      replacementLocation: (row.replacementLocation as string) || null,
      replacementLocationName: (row.replacementLocationName as string) || (row.replacementLocation as string) || null,
      replacementStatus: (row.replacementStatus as string) || null,
      mainInventoryItemId: row.mainInventoryItemId ? Number(row.mainInventoryItemId) : null,
      mainRegisterNo: (row.mainRegisterNo as string) || null,
      mainVinNo: (row.mainVinNo as string) || null,
      mainModel: (row.mainModel as string) || null,
      mainStatus: (row.mainStatus as string) || null,
      mainLocation: (row.mainLocation as string) || null,
      issueTitle: (row.issueTitle as string) || null,
      maintenanceStartDate: row.maintenanceStartDate ? new Date(row.maintenanceStartDate as string).toISOString() : null,
      maintenanceFinishDate: row.maintenanceFinishDate ? new Date(row.maintenanceFinishDate as string).toISOString() : null,
      garageName: (row.garageName as string) || null,
      technicianName: (row.technicianName as string) || null,
      serviceType: (row.serviceType as string) || null,
      replacementStartDate: row.replacementStartDate ? new Date(row.replacementStartDate as string).toISOString() : null,
      replacementReturnDate: row.replacementReturnDate ? new Date(row.replacementReturnDate as string).toISOString() : null,
      daysInUse,
      durationStatus: badge.status,
      remark: (row.remark as string) || null,
      createUserName: (row.createUserName as string) || null,
      createDate: row.createDate ? new Date(row.createDate as string).toISOString() : null,
      updateUserName: (row.updateUserName as string) || null,
      updateDate: row.updateDate ? new Date(row.updateDate as string).toISOString() : null
    }
  })

  // Apply filters in memory for full flexibility
  if (options.search) {
    const q = options.search.toLowerCase().trim()
    allRows = allRows.filter(r =>
      (r.replacementRegisterNo && r.replacementRegisterNo.toLowerCase().includes(q)) ||
      (r.replacementVin && r.replacementVin.toLowerCase().includes(q)) ||
      (r.mainRegisterNo && r.mainRegisterNo.toLowerCase().includes(q)) ||
      (r.mainVinNo && r.mainVinNo.toLowerCase().includes(q)) ||
      (r.issueTitle && r.issueTitle.toLowerCase().includes(q)) ||
      (r.garageName && r.garageName.toLowerCase().includes(q)) ||
      (r.replacementLocationName && r.replacementLocationName.toLowerCase().includes(q))
    )
  }

  if (options.durationFilter && options.durationFilter !== 'ALL') {
    if (options.durationFilter === 'CRITICAL') {
      allRows = allRows.filter(r => r.daysInUse > 30 && !(r.replacementStatus || '').toUpperCase().includes('MAINTENANCE'))
    } else if (options.durationFilter === 'WARNING') {
      allRows = allRows.filter(r => r.daysInUse >= 14 && r.daysInUse <= 30 && !(r.replacementStatus || '').toUpperCase().includes('MAINTENANCE'))
    } else if (options.durationFilter === 'NORMAL') {
      allRows = allRows.filter(r => r.daysInUse < 14 && !(r.replacementStatus || '').toUpperCase().includes('MAINTENANCE'))
    } else if (options.durationFilter === 'MAINTENANCE') {
      allRows = allRows.filter(r => (r.replacementStatus || '').toUpperCase().includes('MAINTENANCE'))
    } else if (options.durationFilter === 'ACTIVE_ONLY') {
      allRows = allRows.filter(r => !(r.replacementStatus || '').toUpperCase().includes('MAINTENANCE'))
    }
  }

  if (options.model && options.model !== 'ALL') {
    allRows = allRows.filter(r => r.replacementModel === options.model || r.mainModel === options.model)
  }

  if (options.location && options.location !== 'ALL') {
    allRows = allRows.filter(r => r.replacementLocation === options.location || r.replacementLocationName === options.location)
  }

  const total = allRows.length
  const totalPages = Math.ceil(total / limit) || 1
  const paginated = allRows.slice(offset, offset + limit)

  return {
    records: paginated,
    total,
    page,
    totalPages
  }
}

/**
 * 2. Get Replacement Fleet Pool Cars (From GetEV_CarForReplacement & EV_InventoryItem)
 */
export async function getReplacementPoolCars(
  options: ReplacementFilterOptions = {}
): Promise<{
  records: ReplacementPoolCar[]
  total: number
  page: number
  totalPages: number
}> {
  const pool = await getMSSQLReadOnlyPool()
  if (!pool) return { records: [], total: 0, page: 1, totalPages: 1 }

  const page = options.page && options.page > 0 ? options.page : 1
  const limit = options.limit && options.limit > 0 ? options.limit : 50

  // Call GetEV_CarForReplacement stored procedure
  const spReq = pool.request()
    .input('TextSearch', sql.VarChar(50), options.search || '')
    .input('Model', sql.VarChar(250), options.model && options.model !== 'ALL' ? options.model : '')
    .input('Status', sql.VarChar(100), options.status && options.status !== 'ALL' ? options.status : '')
    .input('Page', sql.Int, 1)
    .input('PerPage', sql.Int, 500)

  let rawList: Record<string, unknown>[] = []
  try {
    const spRes = await spReq.execute('GetEV_CarForReplacement')
    rawList = (spRes.recordset || []) as Record<string, unknown>[]
  } catch (err) {
    console.error('Failed to execute GetEV_CarForReplacement:', err)
  }

  // Look up Target Register numbers if reservedTargetVinNo exists
  const targetVins = Array.from(new Set(rawList.map(r => r.ReservedTargetVinNo as string).filter(Boolean)))
  const targetRegMap = new Map<string, string>()

  if (targetVins.length > 0) {
    try {
      const targetQuery = `
        SELECT VinNo, RegisterNo 
        FROM dbo.EV_InventoryItem 
        WHERE VinNo IN (${targetVins.map(v => `'${v.replace(/'/g, "''")}'`).join(',')})
      `
      const targetRes = await pool.request().query(targetQuery)
      targetRes.recordset.forEach((t: Record<string, unknown>) => {
        if (t.VinNo) targetRegMap.set(t.VinNo as string, (t.RegisterNo as string) || (t.VinNo as string))
      })
    } catch (e) {
      console.error('Failed to fetch target car details:', e)
    }
  }

  let mapped: ReplacementPoolCar[] = rawList.map((r: Record<string, unknown>) => {
    const statusTypeStr = (r.StatusType as string) || ''
    const statusStr = (r.Status as string) || ''
    const reservedRemarkStr = (r.ReservedRemark as string) || ''
    const reservedTypeStr = (r.ReservedType as string) || ''

    const isReserved = statusTypeStr.toLowerCase().includes('reserve') || !!reservedRemarkStr || !!reservedTypeStr
    const isReadyToPick = (statusTypeStr.toLowerCase().includes('replacement available') || (statusStr.toLowerCase() === 'replacement' && statusTypeStr.toLowerCase().includes('available'))) && !isReserved
    const isStandbyAvailable = (statusTypeStr.toLowerCase().includes('available use') || statusStr.toLowerCase() === 'available') && !isReserved

    let poolCategory: 'REPLACEMENT_AVAILABLE' | 'AVAILABLE_USE' | 'REPLACEMENT_RESERVED' = 'REPLACEMENT_RESERVED'
    if (isReadyToPick) {
      poolCategory = 'REPLACEMENT_AVAILABLE'
    } else if (isStandbyAvailable) {
      poolCategory = 'AVAILABLE_USE'
    }

    const targetVin = (r.ReservedTargetVinNo as string) || null

    return {
      inventoryItemId: String(r.InventoryItemID || ''),
      vinNo: (r.VinNo as string) || '',
      registerNo: (r.RegisterNo as string) || null,
      model: (r.Model as string) || null,
      exteriorColor: (r.Exterior_Color as string) || null,
      interiorColor: (r.Interior_Color as string) || null,
      lot: (r.Lot as string) || null,
      project: (r.Project as string) || null,
      status: statusStr,
      statusType: statusTypeStr,
      location: (r.Location as string) || null,
      isReserved,
      isReadyToPick,
      isStandbyAvailable,
      poolCategory,
      reservedTargetVinNo: targetVin,
      reservedTargetRegisterNo: targetVin ? targetRegMap.get(targetVin) || targetVin : null,
      reservedReleaseDate: r.ReservedReleaseDate ? new Date(r.ReservedReleaseDate as string).toISOString() : null,
      reservedRemark: reservedRemarkStr || null,
      reservedType: reservedTypeStr || null,
      customerName: (r.CustomerName as string) || null,
      totalCount: (r.TotalCount as number) || undefined
    }
  })

  // Apply reservation filter if specified
  if (options.reservationType && options.reservationType !== 'ALL') {
    if (options.reservationType === 'READY' || options.reservationType === 'REPLACEMENT_AVAILABLE') {
      mapped = mapped.filter(r => r.isReadyToPick)
    } else if (options.reservationType === 'STANDBY' || options.reservationType === 'AVAILABLE_USE') {
      mapped = mapped.filter(r => r.isStandbyAvailable)
    } else if (options.reservationType === 'RESERVED_LINEMAN') {
      mapped = mapped.filter(r => (r.reservedType || '').toLowerCase().includes('line') || (r.reservedRemark || '').toLowerCase().includes('lineman') || (r.reservedRemark || '').includes('ไลน์แมน'))
    } else if (options.reservationType === 'RESERVED_OTHERS') {
      mapped = mapped.filter(r => r.isReserved && !((r.reservedType || '').toLowerCase().includes('line') || (r.reservedRemark || '').toLowerCase().includes('lineman') || (r.reservedRemark || '').includes('ไลน์แมน')))
    } else if (options.reservationType === 'RESERVED_UNASSIGNED') {
      mapped = mapped.filter(r => r.isReserved && !r.reservedTargetVinNo)
    }
  }

  if (options.location && options.location !== 'ALL') {
    mapped = mapped.filter(r => r.location === options.location)
  }

  const total = mapped.length
  const totalPages = Math.ceil(total / limit) || 1
  const offset = (page - 1) * limit
  const paginated = mapped.slice(offset, offset + limit)

  return {
    records: paginated,
    total,
    page,
    totalPages
  }
}

/**
 * 3. Get Real-Time Summary Statistics for KPI Cards
 */
export async function getReplacementStatsSummary(): Promise<ReplacementStatsSummary> {
  const pool = await getMSSQLReadOnlyPool()
  if (!pool) {
    return {
      totalFleet: 0,
      activeInUse: 0,
      readyToPick: 0,
      availableUseStandby: 0,
      reservedLineman: 0,
      reservedOthers: 0,
      reservedUnassigned: 0,
      inMaintenance: 0,
      criticalDurationAlert: 0,
      warningDurationAlert: 0
    }
  }

  try {
    // 1. Count Active Replacements and Duration alerts (excluding maintenance)
    const activeRes = await pool.request().query(`
      SELECT 
        r.ReplacementItemID,
        r.ReplacementStartDate,
        r.ReplacementReturnDate,
        replCar.Status AS replStatus,
        replCar.StatusType AS replStatusType
      FROM dbo.EV_ReplacementItem r
      LEFT JOIN dbo.EV_InventoryItem replCar ON r.VinNo = replCar.VinNo
      WHERE r.IsActive = 1 AND (r.ReplacementReturnDate IS NULL OR r.ReplacementReturnDate >= CAST(GETDATE() AS DATE))
    `)

    let activeInUse = 0
    let criticalDurationAlert = 0
    let warningDurationAlert = 0

    const activeRows = (activeRes.recordset || []) as Record<string, unknown>[]
    activeRows.forEach((r) => {
      const s = ((r.replStatus as string) || '').toUpperCase()
      const st = ((r.replStatusType as string) || '').toUpperCase()
      const isMaint = s === 'MAINTENANCE' || st.includes('MAINTENANCE')

      if (!isMaint) {
        activeInUse++
        const days = calculateDaysInUse(r.ReplacementStartDate as string | null, r.ReplacementReturnDate as string | null)
        if (days > 30) {
          criticalDurationAlert++
        } else if (days >= 14) {
          warningDurationAlert++
        }
      }
    })

    // 2. Count Fleet Pool cars by calling GetEV_CarForReplacement
    let readyToPick = 0
    let availableUseStandby = 0
    let reservedLineman = 0
    let reservedOthers = 0
    let reservedUnassigned = 0

    try {
      const poolCars = await pool.request()
        .input('TextSearch', sql.VarChar(50), '')
        .input('Model', sql.VarChar(250), '')
        .input('Status', sql.VarChar(100), '')
        .input('Page', sql.Int, 1)
        .input('PerPage', sql.Int, 500)
        .execute('GetEV_CarForReplacement')

      const cars = (poolCars.recordset || []) as Record<string, unknown>[]
      cars.forEach((c) => {
        const sType = ((c.StatusType as string) || '').toLowerCase()
        const s = ((c.Status as string) || '').toLowerCase()
        const isReserved = sType.includes('reserve') || !!c.ReservedRemark || !!c.ReservedType
        const isReady = (sType.includes('replacement available') || (s === 'replacement' && sType.includes('available'))) && !isReserved
        const isStandby = (sType.includes('available use') || s === 'available') && !isReserved

        if (isReady) {
          readyToPick++
        } else if (isStandby) {
          availableUseStandby++
        } else if (isReserved) {
          const rType = (((c.ReservedType as string) || '') + ' ' + ((c.ReservedRemark as string) || '')).toLowerCase()
          if (rType.includes('line') || rType.includes('lineman') || rType.includes('ไลน์แมน')) {
            reservedLineman++
          } else {
            reservedOthers++
          }

          if (!c.ReservedTargetVinNo) {
            reservedUnassigned++
          }
        }
      })
    } catch (e) {
      console.error('Error fetching pool stats:', e)
    }

    // 3. Count Total Fleet & In Maintenance from EV_InventoryItem
    const fleetStatusRes = await pool.request().query(`
      SELECT Status, StatusType, COUNT(*) AS cnt
      FROM dbo.EV_InventoryItem
      WHERE Status = 'REPLACEMENT' OR StatusType LIKE '%REPLACEMENT%'
      GROUP BY Status, StatusType
    `)

    let inMaintenance = 0
    let totalFleetCount = 0

    const fleetRows = (fleetStatusRes.recordset || []) as Record<string, unknown>[]
    fleetRows.forEach((row) => {
      const cnt = Number(row.cnt || 0)
      totalFleetCount += cnt
      const s = ((row.Status as string) || '').toUpperCase()
      const st = ((row.StatusType as string) || '').toUpperCase()
      if (s === 'MAINTENANCE' || st.includes('MAINTENANCE')) {
        inMaintenance += cnt
      }
    })

    return {
      totalFleet: Math.max(totalFleetCount, activeInUse + readyToPick + availableUseStandby + reservedLineman + reservedOthers),
      activeInUse,
      readyToPick,
      availableUseStandby,
      reservedLineman,
      reservedOthers,
      reservedUnassigned,
      inMaintenance,
      criticalDurationAlert,
      warningDurationAlert
    }
  } catch (err) {
    console.error('Failed to get replacement stats:', err)
    return {
      totalFleet: 0,
      activeInUse: 0,
      readyToPick: 0,
      availableUseStandby: 0,
      reservedLineman: 0,
      reservedOthers: 0,
      reservedUnassigned: 0,
      inMaintenance: 0,
      criticalDurationAlert: 0,
      warningDurationAlert: 0
    }
  }
}

/**
 * 4. Get Replacement History from GetEV_Report_ReplacementHistory
 */
export async function getReplacementHistory(
  options: ReplacementFilterOptions = {}
): Promise<{
  records: ReplacementHistoryItem[]
  total: number
  page: number
  totalPages: number
}> {
  const pool = await getMSSQLReadOnlyPool()
  if (!pool) return { records: [], total: 0, page: 1, totalPages: 1 }

  const page = options.page && options.page > 0 ? options.page : 1
  const limit = options.limit && options.limit > 0 ? options.limit : 50

  let rawHistory: Record<string, unknown>[] = []
  try {
    const res = await pool.request().execute('GetEV_Report_ReplacementHistory')
    rawHistory = (res.recordset || []) as Record<string, unknown>[]
  } catch (err) {
    console.error('Failed to execute GetEV_Report_ReplacementHistory:', err)
  }

  let mapped: ReplacementHistoryItem[] = rawHistory.map((r) => {
    const daysUsed = calculateDaysInUse(r.ReplacementStartDate as string | null, r.ReplacementReturnDate as string | null)

    return {
      registerNo: (r.RegisterNo as string) || null,
      vinNo: (r.VinNo as string) || '',
      model: (r.Model as string) || null,
      vinNoReplacement: (r.VinNoReplacement as string) || '',
      replacementRegisterNo: (r.ReplacementRegisterNo as string) || null,
      replacementModel: (r.ReplacementModel as string) || null,
      replacementStartDate: r.ReplacementStartDate ? new Date(r.ReplacementStartDate as string).toISOString() : null,
      replacementReturnDate: r.ReplacementReturnDate ? new Date(r.ReplacementReturnDate as string).toISOString() : null,
      daysUsed,
      location: (r.Location as string) || null,
      remark: (r.Remark as string) || null,
      isActive: !!r.IsActive,
      replacementStatus: (r.ReplacementStatus as string) || null,
      createDate: r.CreateDate ? new Date(r.CreateDate as string).toISOString() : null,
      createName: (r.CreateName as string) || null,
      updateDate: r.UpdateDate ? new Date(r.UpdateDate as string).toISOString() : null,
      updateName: (r.UpdateName as string) || null
    }
  })

  if (options.search) {
    const q = options.search.toLowerCase().trim()
    mapped = mapped.filter(r =>
      (r.registerNo && r.registerNo.toLowerCase().includes(q)) ||
      (r.vinNo && r.vinNo.toLowerCase().includes(q)) ||
      (r.vinNoReplacement && r.vinNoReplacement.toLowerCase().includes(q)) ||
      (r.model && r.model.toLowerCase().includes(q)) ||
      (r.location && r.location.toLowerCase().includes(q)) ||
      (r.createName && r.createName.toLowerCase().includes(q))
    )
  }

  if (options.model && options.model !== 'ALL') {
    mapped = mapped.filter(r => r.model === options.model)
  }

  if (options.location && options.location !== 'ALL') {
    mapped = mapped.filter(r => r.location === options.location)
  }

  const total = mapped.length
  const totalPages = Math.ceil(total / limit) || 1
  const offset = (page - 1) * limit
  const paginated = mapped.slice(offset, offset + limit)

  return {
    records: paginated,
    total,
    page,
    totalPages
  }
}
