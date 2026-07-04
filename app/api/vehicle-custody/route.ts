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
        m.CarStatusCode,
        m.IssueTitle,
        m.ServiceLocationCode,
        m.ReportDate,
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
        f.FollowUpDate AS LatestFollowUpDate
      FROM dbo.EV_MaintenanceItem m
      JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
      LEFT JOIN dbo.EV_RentItem r ON i.InventoryItemID = r.InventoryItemID AND r.IsActive = 1
      LEFT JOIN dbo.EV_ReplacementItem rep ON m.MaintenanceItemID = rep.MaintenanceItemID AND rep.IsActive = 1
      LEFT JOIN dbo.EV_InventoryItem repi ON rep.VinNo = repi.VinNo AND repi.IsActive = 1
      OUTER APPLY (
        SELECT TOP 1 FollowUpDetail, FollowUpDate
        FROM dbo.EV_MaintenanceFollowUp
        WHERE MaintenanceItemID = m.MaintenanceItemID AND IsActive = 1
        ORDER BY FollowUpDate DESC, MaintenanceFollowUpID DESC
      ) f
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

      const formattedRecord = {
        maintenanceId: rec.MaintenanceItemID,
        inventoryItemId: rec.InventoryItemID,
        registerNo: rec.RegisterNo || rec.VinNo || 'ไม่ระบุทะเบียน',
        vin: rec.VinNo,
        model: rec.Model,
        project: rec.Project || 'ไม่ระบุโครงการ',
        projectType: rec.ProjectType,
        issueTitle: rec.IssueTitle || 'ไม่มีอาการระบุ',
        location: rec.ServiceLocationCode || 'ไม่ระบุสถานที่',
        reportDate: rec.ReportDate,
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
      }

      // Categorize based on dates
      if (hasFinishDate) {
        column3.push(formattedRecord)
      } else if (hasStartDate || status === 'IN_MAINTENANCE') {
        column2.push(formattedRecord)
      } else {
        column1.push(formattedRecord)
      }
    })

    return NextResponse.json({
      board: {
        column1: {
          id: 'claims_queue',
          title: '📁 แจ้งเคส / รอคิวเข้าซ่อม (ICI Claims)',
          cards: column1
        },
        column2: {
          id: 'workshop_repair',
          title: '📁 กำลังซ่อม & จัดหารถทดแทน (Workshop & Replacement)',
          cards: column2
        },
        column3: {
          id: 'ready_pickup',
          title: '📁 ซ่อมเสร็จ รอส่งมอบคืน (EV7 Operations)',
          cards: column3
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
