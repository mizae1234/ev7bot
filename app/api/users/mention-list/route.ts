import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // 1. ดึงผู้ใช้ LINE ที่ลงทะเบียนสำเร็จและมีการผูก ev7UserId (ไม่เป็น null)
    const lineUsers = await prisma.lineRegistration.findMany({
      where: { 
        isActive: true,
        ev7UserId: { not: null }
      },
      select: { ev7UserId: true, displayName: true }
    })

    if (lineUsers.length === 0) {
      return NextResponse.json([])
    }

    // 2. นำ ev7UserId ทั้งหมดมาค้นหารายชื่อจาก SQL Server EV_User ที่ยังทำงานอยู่ (IsActive = 1)
    const ev7UserIds = lineUsers.map(u => u.ev7UserId as number)
    const usersReq = pool.request()
    
    // สร้าง IN clause parameterized
    const idParams = ev7UserIds.map((id, index) => `@id${index}`).join(',')
    ev7UserIds.forEach((id, index) => {
      usersReq.input(`id${index}`, sql.Int, id)
    })

    const usersRes = await usersReq.query(`
      SELECT UserID, FirstName, LastName 
      FROM dbo.EV_User 
      WHERE UserID IN (${idParams}) AND IsActive = 1
    `)

    const sqlUsersMap = new Map(usersRes.recordset.map((u: any) => [u.UserID, u]))

    const finalUsers: any[] = []
    const seenNames = new Set<string>()

    for (const lu of lineUsers) {
      const sqlUser = sqlUsersMap.get(lu.ev7UserId)
      if (!sqlUser) continue // ข้ามกรณีที่ผู้ใช้ใน EV_User ปิดใช้งาน หรือหาไม่พบ

      // ชื่อที่จะใช้ในการ @mention (ใช้ LINE displayName เป็นหลัก ถ้าไม่มีใช้ FirstName)
      const displayName = lu.displayName || sqlUser.FirstName
      const fullName = `${sqlUser.FirstName} ${sqlUser.LastName || ''}`.trim()
      const cleanName = displayName.trim()

      if (cleanName && !seenNames.has(cleanName.toLowerCase())) {
        seenNames.add(cleanName.toLowerCase())
        finalUsers.push({
          id: sqlUser.UserID,
          name: cleanName,
          fullName: fullName
        })
      }
    }

    // เรียงลำดับตัวอักษรของชื่อเรียก
    finalUsers.sort((a, b) => a.name.localeCompare(b.name, 'th'))

    return NextResponse.json(finalUsers)
  } catch (err: any) {
    console.error('[Mention List Error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
