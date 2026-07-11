import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, getMSSQLWritePool, sql } from '@/lib/mssql'

// GET: Fetch all active vehicles in the custody tracking pipeline and available vehicles
export async function GET(req: NextRequest) {
  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // UNION query to fetch both vehicles in maintenance AND vacant available vehicles
    const result = await pool.request().query(`
      SELECT 
        m.MaintenanceItemID,
        i.InventoryItemID,
        i.RegisterNo,
        i.VinNo,
        i.Model,
        i.Project,
        i.ProjectType,
        i.Status AS VehicleStatus,
        i.StatusType AS VehicleStatusType,
        sub.DescriptionStatus AS VehicleSubStatusName,
        msStatus.DescriptionStatus AS VehicleMainStatusName,
        ticketSub.DescriptionStatus AS CarSubStatusName,
        m.CarStatusCode,
        m.IssueTitle,
        m.ServiceLocationCode,
        m.ReportDate,
        m.IncidentDate,
        m.MaintenanceStartDate,
        m.MaintenanceFinishDate,
        m.MaintenanceReturnDate,
        m.InsuranceCode,
        m.ClaimNumber,
        r.ContractNo,
        r.FirstName AS CustomerFirstName,
        r.LastName AS CustomerLastName,
        r.PhoneNo AS CustomerPhone,
        rep.VinNo AS ReplacementVin,
        repi.RegisterNo AS ReplacementRegisterNo,
        f.FollowUpDetail AS LatestFollowUpDetail,
        f.FollowUpDate AS LatestFollowUpDate,
        tc.ActiveTicketsCount,
        i.UpdateDate,
        i.CreateDate,
        i.AvailableDate,
        NULL AS ReturnItemDate,
        mainCarInfo.MainVehicleRegisterNo,
        mainCarInfo.MainVehicleVin
      FROM dbo.EV_MaintenanceItem m
      JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
      LEFT JOIN dbo.EV_RentItem r ON i.InventoryItemID = r.InventoryItemID AND r.IsActive = 1
      LEFT JOIN dbo.EV_ReplacementItem rep ON m.MaintenanceItemID = rep.MaintenanceItemID AND rep.IsActive = 1
      LEFT JOIN dbo.EV_InventoryItem repi ON rep.VinNo = repi.VinNo AND repi.IsActive = 1
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
      LEFT JOIN dbo.EV_MsStatus msStatus ON i.Status = msStatus.StatusCode
      LEFT JOIN dbo.EV_MsSubStatus ticketSub ON m.CarStatusCode = ticketSub.StatusCode AND ticketSub.Type = 'MAINTENANCE_CAR_STATUS'
      OUTER APPLY (
        SELECT TOP 1 FollowUpDetail, FollowUpDate
        FROM dbo.EV_MaintenanceFollowUp
        WHERE MaintenanceItemID = m.MaintenanceItemID AND IsActive = 1
        ORDER BY FollowUpDate DESC, MaintenanceFollowUpID DESC
      ) f
      OUTER APPLY (
        SELECT COUNT(*) AS ActiveTicketsCount
        FROM dbo.EV_MaintenanceItem t
        WHERE t.InventoryItemID = m.InventoryItemID
          AND t.IsActive = 1
          AND t.CarStatusCode IN ('WAITING_FOR_MAINTENANCE', 'IN_MAINTENANCE', 'STILL_WORK', 'READY_PICKUP_MAINTENANCE', 'COMPLETE')
          AND t.MaintenanceReturnDate IS NULL
      ) tc
      OUTER APPLY (
        SELECT TOP 1 
          mc.RegisterNo AS MainVehicleRegisterNo,
          mc.VinNo AS MainVehicleVin
        FROM dbo.EV_ReplacementItem activeRep
        JOIN dbo.EV_MaintenanceItem am ON activeRep.MaintenanceItemID = am.MaintenanceItemID
        JOIN dbo.EV_InventoryItem mc ON am.InventoryItemID = mc.InventoryItemID
        WHERE activeRep.VinNo = i.VinNo 
          AND activeRep.IsActive = 1 
          AND activeRep.ReplacementReturnDate IS NULL
          AND am.IsActive = 1
      ) mainCarInfo
      WHERE m.IsActive = 1
        AND m.CarStatusCode IN ('WAITING_FOR_MAINTENANCE', 'IN_MAINTENANCE', 'STILL_WORK', 'READY_PICKUP_MAINTENANCE', 'COMPLETE')
        AND m.MaintenanceReturnDate IS NULL

      UNION ALL

      SELECT 
        NULL AS MaintenanceItemID,
        i.InventoryItemID,
        i.RegisterNo,
        i.VinNo,
        i.Model,
        i.Project,
        i.ProjectType,
        i.Status AS VehicleStatus,
        i.StatusType AS VehicleStatusType,
        sub.DescriptionStatus AS VehicleSubStatusName,
        msStatus.DescriptionStatus AS VehicleMainStatusName,
        NULL AS CarSubStatusName,
        NULL AS CarStatusCode,
        NULL AS IssueTitle,
        NULL AS ServiceLocationCode,
        NULL AS ReportDate,
        NULL AS IncidentDate,
        NULL AS MaintenanceStartDate,
        latestMaint.MaintenanceFinishDate AS MaintenanceFinishDate,
        latestMaint.MaintenanceReturnDate AS MaintenanceReturnDate,
        NULL AS InsuranceCode,
        NULL AS ClaimNumber,
        NULL AS ContractNo,
        NULL AS CustomerFirstName,
        NULL AS CustomerLastName,
        NULL AS PhoneNo,
        NULL AS ReplacementVin,
        NULL AS ReplacementRegisterNo,
        NULL AS LatestFollowUpDetail,
        NULL AS LatestFollowUpDate,
        0 AS ActiveTicketsCount,
        i.UpdateDate,
        i.CreateDate,
        i.AvailableDate,
        latestReturn.ReturnDate AS ReturnItemDate,
        mainCarInfo.MainVehicleRegisterNo,
        mainCarInfo.MainVehicleVin
      FROM dbo.EV_InventoryItem i
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
      LEFT JOIN dbo.EV_MsStatus msStatus ON i.Status = msStatus.StatusCode
      OUTER APPLY (
        SELECT TOP 1 MaintenanceReturnDate, MaintenanceFinishDate
        FROM dbo.EV_MaintenanceItem
        WHERE InventoryItemID = i.InventoryItemID AND IsActive = 1
        ORDER BY MaintenanceItemID DESC
      ) latestMaint
      OUTER APPLY (
        SELECT TOP 1 ReturnDate
        FROM dbo.EV_ReturnItem
        WHERE VinNo = i.VinNo AND IsActive = 1
        ORDER BY ReturnItemID DESC
      ) latestReturn
      OUTER APPLY (
        SELECT TOP 1 
          mc.RegisterNo AS MainVehicleRegisterNo,
          mc.VinNo AS MainVehicleVin
        FROM dbo.EV_ReplacementItem activeRep
        JOIN dbo.EV_MaintenanceItem am ON activeRep.MaintenanceItemID = am.MaintenanceItemID
        JOIN dbo.EV_InventoryItem mc ON am.InventoryItemID = mc.InventoryItemID
        WHERE activeRep.VinNo = i.VinNo 
          AND activeRep.IsActive = 1 
          AND activeRep.ReplacementReturnDate IS NULL
          AND am.IsActive = 1
      ) mainCarInfo
      WHERE i.Status = 'AVAILABLE' AND i.IsActive = 1
    `)

    const records = result.recordset

    // Classify into columns
    const column1: any[] = [] // แจ้งเคสยังขับได้ (STILL_WORK)
    const column2: any[] = [] // กำลังซ่อม (อู่) - WAITING_FOR_MAINTENANCE + IN_MAINTENANCE + COMPLETE
    const column3: any[] = [] // ซ่อมเสร็จ รอส่งมอบคืน (EV7 Operations)
    const column4: any[] = [] // รถว่าง รอจัดหาลูกค้า (EV7 & Sales)

    const now = new Date()

    records.forEach((rec) => {
      const isAvailable = rec.VehicleStatus === 'AVAILABLE' || rec.VehicleStatus?.startsWith('AVAILABLE')
      const status = rec.CarStatusCode
      const hasStartDate = !!rec.MaintenanceStartDate
      const hasFinishDate = !!rec.MaintenanceFinishDate

      // Calculate Ageing Days (Days in current column/status)
      let ageingDays: number | null = 0
      let displayReturnDate: string | null = null

      if (isAvailable) {
        // Fallback sequence: 1. MaintenanceReturnDate, 2. MaintenanceFinishDate, 3. ReturnItemDate, 4. AvailableDate, 5. null
        const availDate = rec.MaintenanceReturnDate 
          ? new Date(rec.MaintenanceReturnDate) 
          : (rec.MaintenanceFinishDate 
              ? new Date(rec.MaintenanceFinishDate) 
              : (rec.ReturnItemDate 
                  ? new Date(rec.ReturnItemDate) 
                  : (rec.AvailableDate ? new Date(rec.AvailableDate) : null)))
        
        if (availDate) {
          ageingDays = Math.floor((now.getTime() - availDate.getTime()) / (1000 * 60 * 60 * 24))
          displayReturnDate = availDate.toISOString()
        } else {
          ageingDays = null
          displayReturnDate = null
        }
      } else if (hasFinishDate) {
        // In Column 3: Days since finished
        const finish = new Date(rec.MaintenanceFinishDate)
        ageingDays = Math.floor((now.getTime() - finish.getTime()) / (1000 * 60 * 60 * 24))
      } else if (hasStartDate) {
        // In Column 2: Days since started repair
        const start = new Date(rec.MaintenanceStartDate)
        ageingDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      } else if (rec.ReportDate) {
        // In Column 1: Days since reported
        const report = new Date(rec.ReportDate)
        ageingDays = Math.floor((now.getTime() - report.getTime()) / (1000 * 60 * 60 * 24))
      }

      const formattedRecord = {
        maintenanceId: rec.MaintenanceItemID || rec.InventoryItemID, // Fallback for key/ID
        inventoryItemId: rec.InventoryItemID,
        registerNo: rec.RegisterNo || rec.VinNo || 'ไม่ระบุทะเบียน',
        vin: rec.VinNo,
        model: rec.Model,
        project: (rec.Project && rec.Project.toUpperCase() === 'TAXI') ? 'EV7' : (rec.Project || 'ไม่ระบุโครงการ'),
        projectType: rec.ProjectType,
        vehicleStatus: rec.VehicleStatus,
        vehicleStatusType: rec.VehicleStatusType,
        vehicleSubStatusName: rec.VehicleSubStatusName || rec.VehicleMainStatusName || 'ไม่ระบุสถานะ',
        carSubStatusName: rec.CarSubStatusName || rec.CarStatusCode || 'ไม่ระบุสถานะ',
        issueTitle: rec.IssueTitle || 'ไม่มีอาการระบุ',
        location: rec.ServiceLocationCode || 'ไม่ระบุสถานที่',
        reportDate: rec.ReportDate,
        incidentDate: rec.IncidentDate || null,
        startDate: rec.MaintenanceStartDate,
        finishDate: rec.MaintenanceFinishDate,
        maintenanceReturnDate: displayReturnDate,
        updateDate: rec.UpdateDate,
        createDate: rec.CreateDate,
        insuranceCode: rec.InsuranceCode || '-',
        claimNumber: rec.ClaimNumber || '-',
        contractNo: rec.ContractNo || '-',
        customerName: rec.CustomerFirstName ? `${rec.CustomerFirstName} ${rec.CustomerLastName || ''}`.trim() : 'ไม่ระบุลูกค้า',
        customerPhone: rec.CustomerPhone || '-',
        replacementVin: rec.ReplacementVin || null,
        replacementRegisterNo: rec.ReplacementRegisterNo || null,
        latestFollowUpDetail: rec.LatestFollowUpDetail || null,
        latestFollowUpDate: rec.LatestFollowUpDate || null,
        ageingDays: ageingDays !== null && ageingDays >= 0 ? ageingDays : null,
        carStatusCode: rec.CarStatusCode,
        activeTicketsCount: rec.ActiveTicketsCount || 1,
        mainVehicleRegisterNo: rec.MainVehicleRegisterNo || null,
        mainVehicleVin: rec.MainVehicleVin || null,
      }

      // Categorize based on VehicleStatus first, then CarStatusCode
      if (isAvailable) {
        column4.push(formattedRecord)
      } else if (status === 'COMPLETE') {
        // ปิดเคสแล้ว ไม่ต้องแสดงในบอร์ด
      } else if (status === 'READY_PICKUP_MAINTENANCE' && rec.VehicleStatus === 'MAINTENANCE') {
        column3.push(formattedRecord)
      } else if (status === 'STILL_WORK') {
        column1.push(formattedRecord)
      } else {
        // WAITING_FOR_MAINTENANCE, IN_MAINTENANCE, etc.
        column2.push(formattedRecord)
      }
    })

    const groupColumnCards = (cards: any[]) => {
      const groupedMap = new Map<number, any>()
      
      cards.forEach(card => {
        const existing = groupedMap.get(card.inventoryItemId)
        if (!existing) {
          groupedMap.set(card.inventoryItemId, {
            ...card,
            tickets: card.carStatusCode ? [ {
              maintenanceId: card.maintenanceId,
              issueTitle: card.issueTitle,
              reportDate: card.reportDate,
              incidentDate: card.incidentDate,
              startDate: card.startDate,
              finishDate: card.finishDate,
              insuranceCode: card.insuranceCode,
              claimNumber: card.claimNumber,
              latestFollowUpDetail: card.latestFollowUpDetail,
              latestFollowUpDate: card.latestFollowUpDate,
              carStatusCode: card.carStatusCode,
              carSubStatusName: card.carSubStatusName,
              location: card.location,
            } ] : []
          })
        } else if (card.carStatusCode) {
          existing.tickets.push({
            maintenanceId: card.maintenanceId,
            issueTitle: card.issueTitle,
            reportDate: card.reportDate,
            incidentDate: card.incidentDate,
            startDate: card.startDate,
            finishDate: card.finishDate,
            insuranceCode: card.insuranceCode,
            claimNumber: card.claimNumber,
            latestFollowUpDetail: card.latestFollowUpDetail,
            latestFollowUpDate: card.latestFollowUpDate,
            carStatusCode: card.carStatusCode,
            carSubStatusName: card.carSubStatusName,
            location: card.location,
          })
          
          // Keep the ticket with the highest maintenanceId or latest date as the primary ticket representation on the card
          if (card.maintenanceId > existing.maintenanceId) {
            existing.maintenanceId = card.maintenanceId
            existing.issueTitle = card.issueTitle
            existing.reportDate = card.reportDate
            existing.incidentDate = card.incidentDate
            existing.startDate = card.startDate
            existing.finishDate = card.finishDate
            existing.insuranceCode = card.insuranceCode
            existing.claimNumber = card.claimNumber
            existing.latestFollowUpDetail = card.latestFollowUpDetail
            existing.latestFollowUpDate = card.latestFollowUpDate
            existing.carStatusCode = card.carStatusCode
            existing.carSubStatusName = card.carSubStatusName
          }
        }
      })
      
      return Array.from(groupedMap.values())
    }

    const finalColumn1 = groupColumnCards(column1)
    const finalColumn2 = groupColumnCards(column2)
    const finalColumn3 = groupColumnCards(column3)
    const finalColumn4 = groupColumnCards(column4)

    return NextResponse.json({
      board: {
        column1: {
          id: 'still_work',
          title: '📁 แจ้งเคสยังขับได้',
          cards: finalColumn1
        },
        column2: {
          id: 'workshop_repair',
          title: '📁 กำลังซ่อม (อู่)',
          cards: finalColumn2
        },
        column3: {
          id: 'ready_pickup',
          title: '📁 ซ่อมเสร็จ รอส่งมอบคืน (EV7)',
          cards: finalColumn3
        },
        column4: {
          id: 'available_sales',
          title: '📁 รถว่าง รอจัดหาลูกค้า (EV7 & Sales)',
          cards: finalColumn4
        }
      }
    })
  } catch (err: any) {
    console.error('[GET Custody Kanban Error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Add a new follow-up record for a maintenance case
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { maintenanceId, followUpDetail, userId } = body

    if (!maintenanceId || !followUpDetail || !followUpDetail.trim()) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน (ต้องการ maintenanceId และ followUpDetail)' }, { status: 400 })
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลเขียนได้' }, { status: 500 })
    }

    const dbUserId = userId || 1 // Fallback to System User ID = 1

    const insReq = pool.request()
    insReq.input('maintId', sql.Int, maintenanceId)
    insReq.input('detail', sql.NVarChar, followUpDetail.trim())
    insReq.input('userId', sql.Int, dbUserId)

    await insReq.query(`
      INSERT INTO dbo.EV_MaintenanceFollowUp (
        MaintenanceItemID, FollowUpDate, FollowUpDetail, IsActive, CreateDate, CreateUserID, UpdateDate, UpdateUserID
      )
      VALUES (
        @maintId, GETDATE(), @detail, 1, GETDATE(), @userId, GETDATE(), @userId
      )
    `)

    // Update LastFollowUpDate on EV_MaintenanceItem
    const updReq = pool.request()
    updReq.input('maintId', sql.Int, maintenanceId)
    await updReq.query(`
      UPDATE dbo.EV_MaintenanceItem
      SET LastFollowUpDate = GETDATE(), UpdateDate = GETDATE()
      WHERE MaintenanceItemID = @maintId
    `)

    console.log(`[Follow-up Added] MaintenanceItemID=${maintenanceId}: ${followUpDetail}`)
    return NextResponse.json({ success: true, message: 'บันทึกความคืบหน้าถัดไปเรียบร้อยแล้ว' })
  } catch (err: any) {
    console.error('[POST Custody Follow-up Error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
