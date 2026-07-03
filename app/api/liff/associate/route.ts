import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMSSQLWritePool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { action, userId, displayName, email, password, firstName, lastName } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'ไม่พบ LINE User ID' }, { status: 400 })
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูล SQL Server ได้' }, { status: 500 })
    }

    let dbUserId: number | null = null

    if (action === 'link') {
      // --- LINK EXISTING ACCOUNT ---
      if (!email || !password) {
        return NextResponse.json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 })
      }

      const userReq = pool.request()
      userReq.input('email', sql.VarChar, email.trim())
      userReq.input('password', sql.VarChar, password)
      const userRes = await userReq.query(`
        SELECT UserID, FirstName, LastName 
        FROM dbo.EV_User 
        WHERE UserEmail = @email AND UserPassword = @password AND IsActive = 1
      `)

      if (userRes.recordset.length === 0) {
        return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีของคุณถูกระงับการใช้งาน' }, { status: 400 })
      }

      dbUserId = userRes.recordset[0].UserID

      // Update LineUserId in SQL Server EV_User (Best effort - proceed even if UPDATE permission is denied)
      try {
        const updSqlReq = pool.request()
        updSqlReq.input('userId', sql.Int, dbUserId)
        updSqlReq.input('lineUserId', sql.VarChar, userId)
        await updSqlReq.query(`
          UPDATE dbo.EV_User 
          SET LineUserId = @lineUserId, ModifiedDatetime = GETDATE()
          WHERE UserID = @userId
        `)
      } catch (sqlErr: any) {
        console.warn('[Liff Associate] Denied or failed to update SQL Server EV_User LineUserId, proceeding with Postgres association. Error:', sqlErr.message)
      }

    } else if (action === 'create') {
      // --- CREATE NEW ACCOUNT ---
      if (!email || !password || !firstName || !lastName) {
        return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง' }, { status: 400 })
      }

      // Check if email already exists
      const checkReq = pool.request()
      checkReq.input('email', sql.VarChar, email.trim())
      const checkRes = await checkReq.query(`
        SELECT UserID FROM dbo.EV_User WHERE UserEmail = @email
      `)

      if (checkRes.recordset.length > 0) {
        return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาเลือกผูกบัญชีเดิมหรือเปลี่ยนอีเมล' }, { status: 400 })
      }

      // Insert new user
      const insReq = pool.request()
      insReq.input('userName', sql.VarChar, email.trim())
      insReq.input('password', sql.VarChar, password)
      insReq.input('email', sql.VarChar, email.trim())
      insReq.input('firstName', sql.VarChar, firstName.trim())
      insReq.input('lastName', sql.VarChar, lastName.trim())
      insReq.input('lineUserId', sql.VarChar, userId)

      const insRes = await insReq.query(`
        INSERT INTO dbo.EV_User (
          UserName, UserPassword, UserEmail, FirstName, LastName, 
          IsActive, RoleCode, LineUserId, StartDate, CreatedDatetime
        )
        VALUES (
          @userName, @password, @email, @firstName, @lastName, 
          1, 'USER', @lineUserId, GETDATE(), GETDATE()
        );
        SELECT SCOPE_IDENTITY() AS NewUserID;
      `)

      dbUserId = insRes.recordset[0].NewUserID
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (!dbUserId) {
      return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างหรือหาบัญชีผู้ใช้' }, { status: 500 })
    }

    // Update ev7UserId in PostgreSQL line_registrations
    const reg = await prisma.lineRegistration.upsert({
      where: { lineUserId: userId },
      update: {
        ev7UserId: dbUserId,
        displayName: displayName || null,
        isActive: true,
      },
      create: {
        lineUserId: userId,
        displayName: displayName || null,
        ev7UserId: dbUserId,
        system: 'EV7',
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: action === 'link' ? 'ผูกบัญชีสำเร็จเรียบร้อยแล้ว!' : 'ลงทะเบียนและเปิดใช้สิทธิ์บัญชีเรียบร้อยแล้ว!',
      registration: reg
    })

  } catch (err: any) {
    console.error('[Liff Associate API Error]', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาดภายในระบบ: ${err.message}` }, { status: 500 })
  }
}
