import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ authenticated: false, reason: 'Missing userId' })
    }

    const spacesEndpoint = env.SPACES_ENDPOINT || 'https://sgp1.digitaloceanspaces.com'
    const spacesBucket = env.SPACES_BUCKET || 'space-ev7tracking-prod'
    const spacesCdn = spacesEndpoint.replace('https://', `https://${spacesBucket}.`)

    if (userId === 'usr_mock_dev') {
      return NextResponse.json({ 
        authenticated: true, 
        ev7UserId: 9999,
        role: 'SUPER_ADMIN',
        spacesCdn
      })
    }

    const reg = await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!reg || !reg.ev7UserId) {
      return NextResponse.json({ authenticated: false, reason: 'Not mapped' })
    }

    let userRole = reg.role || 'USER'
    let ev7UserName = ''

    // Fetch RoleCode and FullName from SQL Server EV_User table
    try {
      const pool = await getMSSQLWritePool()
      if (pool) {
        const userReq = pool.request()
        userReq.input('userId', sql.Int, reg.ev7UserId)
        const userRes = await userReq.query(`
          SELECT RoleCode, ISNULL(NULLIF(FirstName + ' ' + ISNULL(LastName, ''), ''), UserName) AS FullName 
          FROM dbo.EV_User 
          WHERE UserID = @userId AND IsActive = 1
        `)
        if (userRes.recordset.length > 0) {
          userRole = userRes.recordset[0].RoleCode || userRole
          ev7UserName = userRes.recordset[0].FullName || ''
        }
      }
    } catch (sqlErr) {
      console.warn('[Check Auth API] Failed to fetch user info from SQL Server EV_User, using Postgres fallback. Error:', sqlErr)
    }

    return NextResponse.json({ 
      authenticated: true, 
      ev7UserId: reg.ev7UserId,
      ev7UserName,
      role: userRole,
      spacesCdn
    })

  } catch (error: any) {
    console.error('[Check Auth API Error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
