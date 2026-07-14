import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { lineClient } from '@/lib/line'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { requestId, action, passcode, userId } = body

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    // 1. Check database role of caller (must be Super Admin)
    const caller = userId === 'usr_mock_dev' ? { role: 'SUPER_ADMIN' } : await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 })
    }

    if (!requestId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // 2. Fetch the registration request
    const request = await prisma.registrationRequest.findUnique({
      where: { id: parseInt(String(requestId), 10) }
    })

    if (!request) {
      return NextResponse.json({ error: 'ไม่พบรายการคำขอลงทะเบียน' }, { status: 404 })
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: 'คำขอนี้ได้รับการจัดการไปแล้ว' }, { status: 400 })
    }

    if (action === 'approve') {
      // --- APPROVE FLOW ---
      const pool = await getMSSQLWritePool()
      if (!pool) {
        return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูล SQL Server ได้' }, { status: 500 })
      }

      // Check if email already exists in SQL Server EV_User
      const checkReq = pool.request()
      checkReq.input('email', sql.VarChar, request.email)
      const checkRes = await checkReq.query(`
        SELECT UserID FROM dbo.EV_User WHERE UserEmail = @email AND IsActive = 1
      `)
      if (checkRes.recordset.length > 0) {
        return NextResponse.json({ error: 'อีเมลผู้ใช้งานนี้มีอยู่ในระบบจริงแล้ว ไม่สามารถอนุมัติซ้ำได้' }, { status: 400 })
      }

      let newUserId: number | null = null

      // Insert new user to SQL Server EV_User
      try {
        const insReq = pool.request()
        insReq.input('userName', sql.VarChar, request.email)
        insReq.input('password', sql.VarChar, request.password)
        insReq.input('email', sql.VarChar, request.email)
        insReq.input('firstName', sql.VarChar, request.firstName)
        insReq.input('lastName', sql.VarChar, request.lastName)
        insReq.input('lineUserId', sql.VarChar, request.lineUserId)
        insReq.input('branchCode', sql.VarChar, request.branchCode)

        const insRes = await insReq.query(`
          INSERT INTO dbo.EV_User (
            UserName, UserPassword, UserEmail, FirstName, LastName, 
            IsActive, RoleCode, LineUserId, BranchCode, StartDate, CreatedDatetime
          )
          VALUES (
            @userName, @password, @email, @firstName, @lastName, 
            1, 'USER', @lineUserId, @branchCode, GETDATE(), GETDATE()
          );
          SELECT SCOPE_IDENTITY() AS NewUserID;
        `)

        newUserId = insRes.recordset[0].NewUserID
      } catch (sqlErr: any) {
        console.error('[Approve Registration SQL Insert Error]', sqlErr)
        return NextResponse.json({
          error: `ไม่สามารถเขียนบันทึกบัญชีลง SQL Server ได้: ${sqlErr.message}`
        }, { status: 500 })
      }

      if (!newUserId) {
        return NextResponse.json({ error: 'ไม่ได้รับ New User ID จากฐานข้อมูล' }, { status: 550 })
      }

      // Upsert LINE registration in PostgreSQL
      await prisma.lineRegistration.upsert({
        where: { lineUserId: request.lineUserId },
        update: {
          displayName: request.displayName || null,
          ev7UserId: newUserId,
          isActive: true
        },
        create: {
          lineUserId: request.lineUserId,
          displayName: request.displayName || null,
          ev7UserId: newUserId,
          system: 'EV7',
          isActive: true
        }
      })

      // Update request status to APPROVED and clear password for security
      await prisma.registrationRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          password: '' // Clear password
        }
      })

      // Send LINE push message notification on success (Approve only)
      try {
        await lineClient.pushMessage(request.lineUserId, {
          type: 'text',
          text: `🎉 บัญชีผู้ใช้งานระบบ EV7 ของคุณได้รับการอนุมัติเรียบร้อยแล้วค่ะ!\n\n📧 อีเมล: ${request.email}\n📍 สาขา: ${request.branchCode}\n\nท่านสามารถเข้าใช้งานระบบผ่าน LINE LIFF ได้ทันทีค่ะ`
        })
      } catch (lineErr) {
        console.error(`[Approve Notify Error] Failed to send LINE push notification to ${request.lineUserId}:`, lineErr)
      }

      return NextResponse.json({ success: true, message: 'อนุมัติผู้ใช้งานและส่งข้อความแจ้งเตือนเรียบร้อยแล้ว' })

    } else {
      // --- REJECT FLOW ---
      // Update request status to REJECTED and clear password for security
      await prisma.registrationRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          password: '' // Clear password
        }
      })

      // Do NOT send LINE Push message on rejection as requested
      return NextResponse.json({ success: true, message: 'ปฏิเสธคำขอเรียบร้อยแล้ว (ไม่ส่งข้อความแจ้งเตือน)' })
    }

  } catch (error) {
    console.error('[Admin Approve User API POST Error]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 })
  }
}
