import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMSSQLPool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, displayName, email, password, firstName, lastName, branchCode } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'ไม่พบ LINE User ID' }, { status: 400 })
    }

    if (!email || !password || !firstName || !lastName || !branchCode) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วนและเลือกสาขา' }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูล SQL Server ได้' }, { status: 500 })
    }

    // 1. ตรวจสอบ LINE ID ซ้ำในระบบ
    // 1.1 เช็คใน SQL Server
    const checkLineSql = pool.request()
    checkLineSql.input('lineUserId', sql.VarChar, userId)
    const lineSqlRes = await checkLineSql.query(`
      SELECT UserID FROM dbo.EV_User WHERE LineUserId = @lineUserId AND IsActive = 1
    `)
    if (lineSqlRes.recordset.length > 0) {
      return NextResponse.json({ error: 'บัญชี LINE นี้ถูกเชื่อมโยงใช้งานในระบบแล้ว' }, { status: 400 })
    }

    // 1.2 เช็คใน PostgreSQL
    const linePgRes = await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })
    if (linePgRes && linePgRes.ev7UserId) {
      return NextResponse.json({ error: 'บัญชี LINE นี้ถูกลงทะเบียนไว้ในระบบแล้ว' }, { status: 400 })
    }

    // 2. ตรวจสอบ Email ซ้ำในระบบ
    // 2.1 เช็คใน SQL Server
    const checkEmailSql = pool.request()
    checkEmailSql.input('email', sql.VarChar, email.trim())
    const emailSqlRes = await checkEmailSql.query(`
      SELECT UserID FROM dbo.EV_User WHERE UserEmail = @email AND IsActive = 1
    `)
    if (emailSqlRes.recordset.length > 0) {
      return NextResponse.json({ error: 'อีเมลผู้ใช้งานนี้มีอยู่ในระบบแล้ว' }, { status: 400 })
    }

    // 2.2 เช็คใน PostgreSQL (คำขอที่อยู่ระหว่างรออนุมัติ)
    const emailPgPending = await prisma.registrationRequest.findFirst({
      where: {
        email: email.trim(),
        status: 'PENDING'
      }
    })
    if (emailPgPending) {
      return NextResponse.json({ error: 'อีเมลนี้กำลังอยู่ระหว่างรออนุมัติสิทธิ์การใช้งาน' }, { status: 400 })
    }

    // 3. บันทึก/อัปเดตคำขอลงทะเบียน (Temp Table)
    console.log(`[LIFF Register Request] Saving pending request for: ${email} (${firstName} ${lastName})`)
    
    const request = await prisma.registrationRequest.upsert({
      where: { lineUserId: userId },
      update: {
        displayName: displayName || null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        branchCode,
        status: 'PENDING',
        updatedAt: new Date()
      },
      create: {
        lineUserId: userId,
        displayName: displayName || null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        branchCode,
        status: 'PENDING'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'ลงทะเบียนสำเร็จ! กรุณารอ Super Admin ตรวจสอบและอนุมัติสิทธิ์การเข้าใช้งานระบบนะคะ',
      request
    })

  } catch (error) {
    console.error('[API Register Request Error]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบในการส่งคำขอ' }, { status: 500 })
  }
}
