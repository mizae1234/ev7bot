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
  let allRows: ReplacementActiveItem[] = (result.recordset || []).map((row: any) => {
    const daysInUse = calculateDaysInUse(row.replacementStartDate, row.replacementReturnDate)
    const badge = getDurationBadge(daysInUse)

    return {
      replacementItemId: Number(row.replacementItemId),
      maintenanceItemId: Number(row.maintenanceItemId),
      replacementVin: row.replacementVin || '',
      replacementRegisterNo: row.replacementRegisterNo || null,
      replacementModel: row.replacementModel || null,
      replacementLocation: row.replacementLocation || null,
      replacementLocationName: row.replacementLocationName || row.replacementLocation || null,
      replacementStatus: row.replacementStatus || null,
      mainInventoryItemId: row.mainInventoryItemId ? Number(row.mainInventoryItemId) : null,
      mainRegisterNo: row.mainRegisterNo || null,
      mainVinNo: row.mainVinNo || null,
      mainModel: row.mainModel || null,
      mainStatus: row.mainStatus || null,
      mainLocation: row.mainLocation || null,
      issueTitle: row.issueTitle || null,
      maintenanceStartDate: row.maintenanceStartDate ? new Date(row.maintenanceStartDate).toISOString() : null,
      maintenanceFinishDate: row.maintenanceFinishDate ? new Date(row.maintenanceFinishDate).toISOString() : null,
      garageName: row.garageName || null,
      technicianName: row.technicianName || null,
      serviceType: row.serviceType || null,
      replacementStartDate: row.replacementStartDate ? new Date(row.replacementStartDate).toISOString() : null,
      replacementReturnDate: row.replacementReturnDate ? new Date(row.replacementReturnDate).toISOString() : null,
      daysInUse,
      durationStatus: badge.status,
      remark: row.remark || null,
      createUserName: row.createUserName || null,
      createDate: row.createDate ? new Date(row.createDate).toISOString() : null,
      updateUserName: row.updateUserName || null,
      updateDate: row.updateDate ? new Date(row.updateDate).toISOString() : null
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
      allRows = allRows.filter(r => r.daysInUse > 30)
    } else if (options.durationFilter === 'WARNING') {
      allRows = allRows.filter(r => r.daysInUse >= 14 && r.daysInUse <= 30)
    } else if (options.durationFilter === 'NORMAL') {
      allRows = allRows.filter(r => r.daysInUse < 14)
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

  let rawList: any[] = []
  try {
    const spRes = await spReq.execute('GetEV_CarForReplacement')
    rawList = spRes.recordset || []
  } catch (err) {
    console.error('Failed to execute GetEV_CarForReplacement:', err)
  }

  // Look up Target Register numbers if reservedTargetVinNo exists
  const targetVins = Array.from(new Set(rawList.map(r => r.ReservedTargetVinNo).filter(Boolean))) as string[]
  const targetRegMap = new Map<string, string>()

  if (targetVins.length > 0) {
    try {
      const targetQuery = `
        SELECT VinNo, RegisterNo 
        FROM dbo.EV_InventoryItem 
        WHERE VinNo IN (${targetVins.map(v => `'${v.replace(/'/g, "''")}'`).join(',')})
      `
      const targetRes = await pool.request().query(targetQuery)
      targetRes.recordset.forEach(t => {
        if (t.VinNo) targetRegMap.set(t.VinNo, t.RegisterNo || t.VinNo)
      })
    } catch (e) {
      console.error('Failed to fetch target car details:', e)
    }
  }

  let mapped: ReplacementPoolCar[] = rawList.map((r: any) => {
    const isReserved = (r.StatusType || '').toLowerCase().includes('reserve') || !!r.ReservedRemark || !!r.ReservedType
    const isReadyToPick = ((r.StatusType || '').toLowerCase().includes('available') || (r.Status || '').toLowerCase() === 'available') && !isReserved

    return {
      inventoryItemId: String(r.InventoryItemID || ''),
      vinNo: r.VinNo || '',
      registerNo: r.RegisterNo || null,
      model: r.Model || null,
      exteriorColor: r.Exterior_Color || null,
      interiorColor: r.Interior_Color || null,
      lot: r.Lot || null,
      project: r.Project || null,
      status: r.Status || '',
      statusType: r.StatusType || '',
      location: r.Location || null,
      isReserved,
      isReadyToPick,
      reservedTargetVinNo: r.ReservedTargetVinNo || null,
      reservedTargetRegisterNo: r.ReservedTargetVinNo ? targetRegMap.get(r.ReservedTargetVinNo) || r.ReservedTargetVinNo : null,
      reservedReleaseDate: r.ReservedReleaseDate ? new Date(r.ReservedReleaseDate).toISOString() : null,
      reservedRemark: r.ReservedRemark || null,
      reservedType: r.ReservedType || null,
      customerName: r.CustomerName || null,
      totalCount: r.TotalCount || undefined
    }
  })

  // Apply reservation filter if specified
  if (options.reservationType && options.reservationType !== 'ALL') {
    if (options.reservationType === 'READY') {
      mapped = mapped.filter(r => r.isReadyToPick)
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
      reservedLineman: 0,
      reservedOthers: 0,
      reservedUnassigned: 0,
      inMaintenance: 0,
      criticalDurationAlert: 0,
      warningDurationAlert: 0
    }
  }

  try {
    // 1. Count Active Replacements and Duration alerts
    const activeRes = await pool.request().query(`
      SELECT 
        r.ReplacementItemID,
        r.ReplacementStartDate,
        r.ReplacementReturnDate
      FROM dbo.EV_ReplacementItem r
      WHERE r.IsActive = 1 AND (r.ReplacementReturnDate IS NULL OR r.ReplacementReturnDate >= CAST(GETDATE() AS DATE))
    `)

    let activeInUse = 0
    let criticalDurationAlert = 0
    let warningDurationAlert = 0

    const activeRows = activeRes.recordset || []
    activeRows.forEach((r: any) => {
      activeInUse++
      const days = calculateDaysInUse(r.ReplacementStartDate, r.ReplacementReturnDate)
      if (days > 30) {
        criticalDurationAlert++
      } else if (days >= 14) {
        warningDurationAlert++
      }
    })

    // 2. Count Fleet Pool cars by calling GetEV_CarForReplacement
    let totalFleet = 0
    let readyToPick = 0
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

      const cars = poolCars.recordset || []
      cars.forEach((c: any) => {
        const isReserved = (c.StatusType || '').toLowerCase().includes('reserve') || !!c.ReservedRemark || !!c.ReservedType
        const isAvailable = ((c.StatusType || '').toLowerCase().includes('available') || (c.Status || '').toLowerCase() === 'available') && !isReserved

        if (isAvailable) {
          readyToPick++
        } else if (isReserved) {
          const rType = ((c.ReservedType || '') + ' ' + (c.ReservedRemark || '')).toLowerCase()
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

    const fleetRows = fleetStatusRes.recordset || []
    fleetRows.forEach((row: any) => {
      const cnt = Number(row.cnt || 0)
      totalFleetCount += cnt
      const s = (row.Status || '').toUpperCase()
      const st = (row.StatusType || '').toUpperCase()
      if (s === 'MAINTENANCE' || st.includes('MAINTENANCE')) {
        inMaintenance += cnt
      }
    })

    return {
      totalFleet: Math.max(totalFleetCount, activeInUse + readyToPick + reservedLineman + reservedOthers),
      activeInUse,
      readyToPick,
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

  let rawHistory: any[] = []
  try {
    const res = await pool.request().execute('GetEV_Report_ReplacementHistory')
    rawHistory = res.recordset || []
  } catch (err) {
    console.error('Failed to execute GetEV_Report_ReplacementHistory:', err)
  }

  let mapped: ReplacementHistoryItem[] = rawHistory.map((r: any) => {
    const daysUsed = calculateDaysInUse(r.ReplacementStartDate, r.ReplacementReturnDate)

    return {
      registerNo: r.RegisterNo || null,
      vinNo: r.VinNo || '',
      model: r.Model || null,
      vinNoReplacement: r.VinNoReplacement || '',
      replacementRegisterNo: r.ReplacementRegisterNo || null,
      replacementModel: r.ReplacementModel || null,
      replacementStartDate: r.ReplacementStartDate ? new Date(r.ReplacementStartDate).toISOString() : null,
      replacementReturnDate: r.ReplacementReturnDate ? new Date(r.ReplacementReturnDate).toISOString() : null,
      daysUsed,
      location: r.Location || null,
      remark: r.Remark || null,
      isActive: !!r.IsActive,
      replacementStatus: r.ReplacementStatus || null,
      createDate: r.CreateDate ? new Date(r.CreateDate).toISOString() : null,
      createName: r.CreateName || null,
      updateDate: r.UpdateDate ? new Date(r.UpdateDate).toISOString() : null,
      updateName: r.UpdateName || null
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
