import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMSSQLPool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // Treat local dev mock user as SUPER_ADMIN
    if (userId === 'usr_mock_dev') {
      return NextResponse.json({
        userId,
        role: 'SUPER_ADMIN',
        isActive: true,
        displayName: 'คุณ เนย (Dev Mode)',
        pictureUrl: null,
      })
    }

    let userRole = 'USER'
    let isActive = false
    let displayName: string | null = null
    let pictureUrl: string | null = null
    let found = false

    // 1. Try PostgreSQL (Prisma)
    try {
      const reg = await prisma.lineRegistration.findUnique({
        where: { lineUserId: userId },
      })
      if (reg) {
        userRole = reg.role || 'USER'
        isActive = reg.isActive
        displayName = reg.displayName
        pictureUrl = reg.pictureUrl
        found = true
      }
    } catch (prismaErr) {
      console.warn('[Auth Role API] PostgreSQL unavailable, checking SQL Server EV_User:', prismaErr)
    }

    // 2. Fallback or augment with SQL Server EV_User
    if (!found || userRole === 'USER') {
      try {
        const pool = await getMSSQLPool()
        if (pool) {
          const isNumeric = /^\d+$/.test(userId)
          const reqSql = pool.request()
          let query = ''
          if (isNumeric) {
            reqSql.input('userId', sql.Int, parseInt(userId, 10))
            query = `
              SELECT RoleCode, IsActive, ISNULL(NULLIF(FirstName + ' ' + ISNULL(LastName, ''), ''), UserName) AS FullName
              FROM dbo.EV_User
              WHERE UserID = @userId
            `
          } else {
            reqSql.input('lineUserId', sql.NVarChar, userId)
            query = `
              SELECT RoleCode, IsActive, ISNULL(NULLIF(FirstName + ' ' + ISNULL(LastName, ''), ''), UserName) AS FullName
              FROM dbo.EV_User
              WHERE LineUserId = @lineUserId
            `
          }
          const userRes = await reqSql.query(query)
          if (userRes.recordset.length > 0) {
            const u = userRes.recordset[0]
            if (u.RoleCode) userRole = u.RoleCode
            if (u.IsActive !== undefined) isActive = u.IsActive === 1 || u.IsActive === true
            if (!displayName && u.FullName) displayName = u.FullName
            found = true
          }
        }
      } catch (sqlErr) {
        console.warn('[Auth Role API] SQL Server check error:', sqlErr)
      }
    }

    return NextResponse.json({
      userId,
      role: userRole,
      isActive,
      displayName,
      pictureUrl,
    })
  } catch (error) {
    console.error('[Auth Role API Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
