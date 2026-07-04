import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, getMSSQLWritePool, sql } from '@/lib/mssql'

// GET: Fetch all active vehicles in the custody tracking pipeline
export async function GET(req: NextRequest) {
  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // Single query to fetch all active cases and their custody info
    const result = await pool.request().query(`
      SELECT 
        m.MaintenanceItemID,
        m.InventoryItemID,
        i.RegisterNo,
        i.VinNo,
        i.Model,
        i.Project,
        i.ProjectType,
        i.Status AS VehicleStatus,
        i.StatusType AS VehicleStatusType,
        sub.DescriptionStatus AS VehicleSubStatusName,
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
        tc.ActiveTicketsCount
      FROM dbo.EV_MaintenanceItem m
      JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
      LEFT JOIN dbo.EV_RentItem r ON i.InventoryItemID = r.InventoryItemID AND r.IsActive = 1
      LEFT JOIN dbo.EV_ReplacementItem rep ON m.MaintenanceItemID = rep.MaintenanceItemID AND rep.IsActive = 1
      LEFT JOIN dbo.EV_InventoryItem repi ON rep.VinNo = repi.VinNo AND repi.IsActive = 1
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
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
      WHERE m.IsActive = 1
        AND m.CarStatusCode IN ('WAITING_FOR_MAINTENANCE', 'IN_MAINTENANCE', 'STILL_WORK', 'READY_PICKUP_MAINTENANCE', 'COMPLETE')
        AND m.MaintenanceReturnDate IS NULL
      ORDER BY m.ReportDate DESC
    `)

    const records = result.recordset

    // Classify into columns
    const column1: any[] = [] // แจ้งเคส / รอคิวเข้าซ่อม (ICI Claims)
    const column2: any[] = [] // กำลังซ่อม & จัดหารถทดแทน (Workshop & Replacement)
    const column3: any[] = [] // ซ่อมเสร็จ รอส่งมอบคืน (EV7 Operations)

    const now = new Date()

    records.forEach((rec) => {
      const status = rec.CarStatusCode
      const hasStartDate = !!rec.MaintenanceStartDate
      const hasFinishDate = !!rec.MaintenanceFinishDate

      // Calculate Ageing Days (Days in current column)
      let ageingDays = 0
      if (hasFinishDate) {
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

      const getStatusThai = (status: string | null) => {
        if (!status) return null
        switch (status.toUpperCase()) {
          case 'ON_RENT':
          case 'RENTED':
          case 'RENT':
            return 'อยู่ระหว่างเช่า'
          case 'AVAILABLE':
            return 'พร้อมใช้งาน'
          case 'MAINTENANCE':
            return 'อยู่ระหว่างซ่อม'
          case 'RESERVED':
            return 'จองแล้ว'
          default:
            return status
        }
      }

      const formattedRecord = {
        maintenanceId: rec.MaintenanceItemID,
        inventoryItemId: rec.InventoryItemID,
        registerNo: rec.RegisterNo || rec.VinNo || 'ไม่ระบุทะเบียน',
        vin: rec.VinNo,
        model: rec.Model,
        project: (rec.Project && rec.Project.toUpperCase() === 'TAXI') ? 'EV7' : (rec.Project || 'ไม่ระบุโครงการ'),
        projectType: rec.ProjectType,
        vehicleStatus: rec.VehicleStatus,
        vehicleStatusType: rec.VehicleStatusType,
        vehicleSubStatusName: rec.VehicleSubStatusName || rec.VehicleStatusType || getStatusThai(rec.VehicleStatus) || 'ไม่ระบุสถานะ',
        issueTitle: rec.IssueTitle || 'ไม่มีอาการระบุ',
        location: rec.ServiceLocationCode || 'ไม่ระบุสถานที่',
        reportDate: rec.ReportDate,
        incidentDate: rec.IncidentDate || null,
        startDate: rec.MaintenanceStartDate,
        finishDate: rec.MaintenanceFinishDate,
        insuranceCode: rec.InsuranceCode || '-',
        claimNumber: rec.ClaimNumber || '-',
        contractNo: rec.ContractNo || '-',
        customerName: rec.CustomerFirstName ? `${rec.CustomerFirstName} ${rec.CustomerLastName || ''}`.trim() : 'ไม่ระบุลูกค้า',
        customerPhone: rec.CustomerPhone || '-',
        replacementVin: rec.ReplacementVin || null,
        replacementRegisterNo: rec.ReplacementRegisterNo || null,
        latestFollowUpDetail: rec.LatestFollowUpDetail || null,
        latestFollowUpDate: rec.LatestFollowUpDate || null,
        ageingDays: ageingDays >= 0 ? ageingDays : 0,
        carStatusCode: rec.CarStatusCode,
        activeTicketsCount: rec.ActiveTicketsCount || 1,
      }

      // Categorize based on dates
      if (hasFinishDate) {
        if (rec.VehicleStatus !== 'AVAILABLE') {
          column3.push(formattedRecord)
        }
      } else if (hasStartDate || status === 'IN_MAINTENANCE') {
        column2.push(formattedRecord)
      } else {
        column1.push(formattedRecord)
      }
    })

    const groupColumnCards = (cards: any[]) => {
      const groupedMap = new Map<number, any>()
      
      cards.forEach(card => {
        const existing = groupedMap.get(card.inventoryItemId)
        if (!existing) {
          groupedMap.set(card.inventoryItemId, {
            ...card,
            tickets: [ {
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
              location: card.location,
            } ]
          })
        } else {
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
          }
        }
      })
      
      return Array.from(groupedMap.values())
    }

    const finalColumn1 = groupColumnCards(column1)
    const finalColumn2 = groupColumnCards(column2)
    const finalColumn3 = groupColumnCards(column3)

    return NextResponse.json({
      board: {
        column1: {
          id: 'claims_queue',
          title: '📁 แจ้งเคส / รอคิวเข้าซ่อม (ICI Claims)',
          cards: finalColumn1
        },
        column2: {
          id: 'workshop_repair',
          title: '📁 กำลังซ่อม & จัดหารถทดแทน (Workshop & Replacement)',
          cards: finalColumn2
        },
        column3: {
          id: 'ready_pickup',
          title: '📁 ซ่อมเสร็จ รอส่งมอบคืน (EV7 Operations)',
          cards: finalColumn3
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
