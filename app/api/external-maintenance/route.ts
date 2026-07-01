import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[External API Proxy] Received Payload:', body)

    if (env.MOCK_MODE) {
      // Simulate saving delay
      await new Promise(resolve => setTimeout(resolve, 800))
      return NextResponse.json({
        success: true,
        message: 'บันทึกข้อมูลเรียบร้อยแล้ว (จำลองสถานะ MOCK_MODE)',
        data: {
          maintenanceId: Math.floor(Math.random() * 100000) + 10000,
          createdAt: new Date().toISOString()
        }
      })
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูล SQL Server ได้' }, { status: 500 })
    }

    // 1. Get InventoryItemID from RegisterNo or VinNo
    const registerNo = body.carInfo?.registerNo
    const vinNo = body.carInfo?.vin

    if (!registerNo && !vinNo) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลทะเบียนรถหรือหมายเลขตัวถังในการแจ้งซ่อม' }, { status: 400 })
    }

    const carReq = pool.request()
    carReq.input('registerNo', sql.NVarChar, registerNo || '')
    carReq.input('vinNo', sql.NVarChar, vinNo || '')
    const carRes = await carReq.query(`
      SELECT TOP 1 InventoryItemID 
      FROM dbo.EV_InventoryItem 
      WHERE (RegisterNo = @registerNo OR VinNo = @vinNo) AND IsActive = 1
    `)

    if (carRes.recordset.length === 0) {
      return NextResponse.json({ error: `ไม่พบข้อมูลรถในระบบสำหรับทะเบียน ${registerNo || vinNo}` }, { status: 404 })
    }

    const inventoryItemId = carRes.recordset[0].InventoryItemID

    // 2. Resolve ev7UserId from lineUserId
    let dbUserId = 1 // Default to 1 (System / LIFF User)
    if (body.lineUserId) {
      try {
        const reg = await prisma.lineRegistration.findUnique({
          where: { lineUserId: body.lineUserId }
        })
        if (reg && reg.ev7UserId !== null) {
          dbUserId = reg.ev7UserId
        }
      } catch (e) {
        console.error('[Prisma read ev7UserId Error]', e)
      }
    }

    // 3. Execute Stored Procedure sp_InsertMaintenanceItemJson
    const maintenanceObj = {
      inventoryItemId,
      registerNo: registerNo || null,
      vinNo: vinNo || null,
      driverName: body.driverName || null,
      incidentDate: body.incidentDate ? new Date(body.incidentDate).toISOString() : null,
      carStatusCode: body.carStatusCode || null,
      issueTitle: body.issueDescription || null,
      problemTypeCode: body.problemType || null,
      faultPartyCode: body.faultPartyCode || null,
      carCaseCode: body.carCaseCode || null,
      serviceLocationCode: body.serviceLocationCode || null,
      insuranceCode: body.insurance || null,
      followUpDetail: body.issueDescription || null,
      createUserId: dbUserId,
      claimNumber: body.claimNo || null
    }

    const insertReq = pool.request()
    insertReq.input('MaintenanceJson', sql.NVarChar, JSON.stringify(maintenanceObj))
    insertReq.output('NewMaintenanceItemID', sql.Int)

    const insertRes = await insertReq.execute('dbo.sp_InsertMaintenanceItemJson')
    const newMaintenanceId = insertRes.output.NewMaintenanceItemID

    return NextResponse.json({
      success: true,
      message: 'บันทึกข้อมูลแจ้งซ่อมเรียบร้อยแล้ว',
      data: {
        maintenanceId: newMaintenanceId,
        createdAt: new Date().toISOString()
      }
    })
  } catch (err: any) {
    console.error('[External API Proxy] Error:', err.message)
    return NextResponse.json({ error: `เกิดข้อผิดพลาดในการบันทึก: ${err.message}` }, { status: 500 })
  }
}
