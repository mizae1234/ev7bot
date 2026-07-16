import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { prisma } from '@/lib/prisma'
import { sendVehicleNoteMentionNotifications } from '@/lib/line'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { inventoryItemId, noteDetail, registerNo, lineUserId } = body

    if (!inventoryItemId) {
      return NextResponse.json({ error: 'ไม่พบรหัสครุภัณฑ์ (InventoryItemID)' }, { status: 400 })
    }

    if (env.MOCK_MODE) {
      console.log('[Mock Mode] Create Vehicle Note:', { inventoryItemId, noteDetail, registerNo, lineUserId })
      return NextResponse.json({
        success: true,
        message: 'บันทึกโน้ตสำเร็จ (จำลองสถานะ MOCK_MODE)'
      })
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // Resolve ev7UserId from lineUserId
    let dbUserId: number | null = null
    let senderName = 'ผู้ใช้ LINE'
    
    if (lineUserId) {
      try {
        const reg = await prisma.lineRegistration.findUnique({
          where: { lineUserId }
        })
        if (reg?.ev7UserId) {
          dbUserId = reg.ev7UserId
        } else {
          return NextResponse.json({ error: 'กรุณาทำการลงทะเบียน/ผูกบัญชีเพื่อเปิดสิทธิ์การใช้งานก่อนทำรายการ' }, { status: 400 })
        }
        if (reg?.displayName) {
          senderName = reg.displayName
        }
      } catch (prismaErr) {
        console.error('[Prisma read ev7UserId Error]', prismaErr)
      }
    }

    // Verify if dbUserId exists in SQL Server EV_User table
    if (dbUserId && dbUserId < 10000) {
      try {
        const userCheckReq = pool.request()
        userCheckReq.input('userId', sql.Int, dbUserId)
        const userCheckRes = await userCheckReq.query(`
          SELECT UserID, FirstName, LastName FROM dbo.EV_User WHERE UserID = @userId AND IsActive = 1
        `)
        if (userCheckRes.recordset.length === 0) {
          return NextResponse.json({
            error: 'บัญชีผู้ใช้งานของคุณไม่มีอยู่ในตาราง EV_User หรือถูกระงับการใช้งาน กรุณาผูกบัญชีผู้ใช้จริงก่อนทำรายการ'
          }, { status: 400 })
        }
        const userRow = userCheckRes.recordset[0]
        senderName = userRow.FirstName.trim()
      } catch (checkErr: any) {
        console.error('[User check error]', checkErr)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ผู้ใช้งาน: ' + checkErr.message }, { status: 500 })
      }
    }

    // Insert Note into dbo.EV_VehicleNote
    const insertReq = pool.request()
    insertReq.input('itemId', sql.Int, inventoryItemId)
    insertReq.input('noteDetail', sql.NVarChar, noteDetail || null)
    insertReq.input('userId', sql.Int, dbUserId || null)

    const insertRes = await insertReq.query(`
      INSERT INTO dbo.EV_VehicleNote (InventoryItemID, NoteDetail, CreateDate, CreateUserID, IsActive)
      OUTPUT INSERTED.VehicleNoteID
      VALUES (@itemId, @noteDetail, GETDATE(), @userId, 1)
    `)

    const newNoteId = insertRes.recordset[0]?.VehicleNoteID

    // Fetch Current Location of the vehicle to include in the notification
    let currentLocationName: string | null = null
    try {
      const locQueryReq = pool.request()
      locQueryReq.input('itemId', sql.Int, inventoryItemId)
      const locQueryResult = await locQueryReq.query(`
        SELECT TOP 1
          sub.StatusName AS LocationName,
          i.CurrentLocation AS LocationCode
        FROM dbo.EV_InventoryItem i
        LEFT JOIN dbo.EV_MsSubStatus sub ON i.CurrentLocation = sub.StatusCode AND sub.Type = 'LOCATION'
        WHERE i.InventoryItemID = @itemId
      `)
      if (locQueryResult.recordset.length > 0) {
        const row = locQueryResult.recordset[0]
        currentLocationName = row.LocationName || row.LocationCode || null
      }
    } catch (locErr) {
      console.error('[Fetch CurrentLocation Error]', locErr)
    }

    // Send LINE Notifications (mention + receiveAllNotes subscribers)
    if (noteDetail && noteDetail.trim() && newNoteId && registerNo) {
      try {
        await sendVehicleNoteMentionNotifications(noteDetail, Number(newNoteId), registerNo, senderName, lineUserId, currentLocationName)
      } catch (err) {
        console.error('[LINE Vehicle Note Notification Error]', err)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกโน้ตตัวรถเรียบร้อยแล้ว',
      noteId: newNoteId
    })
  } catch (err: any) {
    console.error('[Create Vehicle Note Error]', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาดในการบันทึก: ${err.message}` }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const inventoryItemId = searchParams.get('inventoryItemId')

    if (!inventoryItemId) {
      return NextResponse.json({ error: 'ไม่พบรหัสครุภัณฑ์ (InventoryItemID)' }, { status: 400 })
    }

    if (env.MOCK_MODE) {
      return NextResponse.json({
        success: true,
        vehicleNotes: [
          {
            VehicleNoteID: 1,
            InventoryItemID: Number(inventoryItemId),
            NoteDetail: 'MOCK NOTE: เจอรถจอดอยู่ที่ร้านสะดวกซื้อ ล้อยางหน้าแบนเล็กน้อย @คุณ เนย (Dev Mode)',
            CreateDate: new Date().toISOString(),
            CreateUserID: 1,
            CreateUserName: 'คุณ เนย (Dev Mode)',
            IsActive: true
          }
        ]
      })
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    const notesReq = pool.request()
    notesReq.input('inventoryItemId', sql.Int, Number(inventoryItemId))

    const notesResult = await notesReq.query(`
      SELECT
        n.VehicleNoteID,
        n.InventoryItemID,
        n.NoteDetail,
        n.CreateDate,
        n.CreateUserID,
        n.IsActive,
        ISNULL(NULLIF(u.FirstName + ' ' + ISNULL(u.LastName, ''), ''), u.UserName) AS CreateUserName
      FROM dbo.EV_VehicleNote n
      LEFT JOIN dbo.EV_User u ON n.CreateUserID = u.UserID
      WHERE n.InventoryItemID = @inventoryItemId AND n.IsActive = 1
      ORDER BY n.CreateDate DESC
    `)

    // Resolve names from lineRegistration in Postgres for any mock/custom UserIDs
    let regMap = new Map<number, string>()
    try {
      const registrations = await prisma.lineRegistration.findMany({
        select: { ev7UserId: true, displayName: true }
      })
      for (const reg of registrations) {
        if (reg.ev7UserId && reg.displayName) {
          regMap.set(Number(reg.ev7UserId), reg.displayName)
        }
      }
    } catch (pgErr) {
      console.warn('[Vehicle Note API] PostgreSQL unavailable for name resolution, skipping:', (pgErr as Error).message)
    }

    // Process Vehicle Notes
    const vehicleNotes = (notesResult.recordset || []).map((n: any) => {
      const originalName = (n.CreateUserName || '').trim();
      const lineDisplayName = n.CreateUserID ? regMap.get(Number(n.CreateUserID)) : null;

      let creatorName = '-';
      if (originalName && lineDisplayName) {
        if (originalName.includes('@')) {
          creatorName = lineDisplayName;
        } else if (originalName !== lineDisplayName) {
          creatorName = `${originalName} (${lineDisplayName})`;
        } else {
          creatorName = originalName;
        }
      } else if (lineDisplayName) {
        creatorName = lineDisplayName;
      } else if (originalName) {
        creatorName = originalName;
      }

      return {
        VehicleNoteID: n.VehicleNoteID,
        InventoryItemID: n.InventoryItemID,
        NoteDetail: n.NoteDetail,
        CreateDate: n.CreateDate,
        CreateUserID: n.CreateUserID,
        CreateUserName: creatorName,
        IsActive: n.IsActive
      }
    })

    return NextResponse.json({
      success: true,
      vehicleNotes
    })
  } catch (err: any) {
    console.error('[Get Vehicle Note Error]', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${err.message}` }, { status: 500 })
  }
}
