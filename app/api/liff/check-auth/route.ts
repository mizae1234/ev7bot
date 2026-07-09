import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMSSQLWritePool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ authenticated: false, reason: 'Missing userId' })
    }

    if (userId === 'usr_mock_dev') {
      return NextResponse.json({ 
        authenticated: true, 
        ev7UserId: 9999,
        role: 'SUPER_ADMIN'
      })
    }

    const reg = await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!reg || !reg.ev7UserId) {
      return NextResponse.json({ authenticated: false, reason: 'Not mapped' })
    }

    let userRole = reg.role || 'USER'

    // Fetch RoleCode from SQL Server EV_User table
    try {
      const pool = await getMSSQLWritePool()
      if (pool) {
        const userReq = pool.request()
        userReq.input('userId', sql.Int, reg.ev7UserId)
        const userRes = await userReq.query(`
          SELECT RoleCode FROM dbo.EV_User WHERE UserID = @userId AND IsActive = 1
        `)
        if (userRes.recordset.length > 0) {
          userRole = userRes.recordset[0].RoleCode || userRole
        }
      }
    } catch (sqlErr) {
      console.warn('[Check Auth API] Failed to fetch RoleCode from SQL Server EV_User, using Postgres fallback. Error:', sqlErr)
    }

    return NextResponse.json({ 
      authenticated: true, 
      ev7UserId: reg.ev7UserId,
      role: userRole
    })

  } catch (error: any) {
    console.error('[Check Auth API Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
