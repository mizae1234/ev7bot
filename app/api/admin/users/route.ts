import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMSSQLPool, getMSSQLWritePool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const passcode = searchParams.get('passcode')
    const userId = searchParams.get('userId')

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    // Check database role of caller
    const caller = userId === 'usr_mock_dev' ? { role: 'SUPER_ADMIN' } : await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 })
    }

    const isExport = searchParams.get('export') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || 'all'
    const status = searchParams.get('status') || 'all'

    const skip = (page - 1) * limit
    const where: any = {}

    if (role !== 'all') {
      where.role = role
    }

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { lineUserId: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [rawUsers, total, totalSuperAdmin, totalAdmin, totalUser] = await Promise.all([
      prisma.lineRegistration.findMany({
        where,
        orderBy: { registeredAt: 'desc' },
        ...(isExport ? {} : { skip, take: limit })
      }),
      prisma.lineRegistration.count({ where }),
      prisma.lineRegistration.count({ where: { role: 'SUPER_ADMIN' } }),
      prisma.lineRegistration.count({ where: { role: 'ADMIN' } }),
      prisma.lineRegistration.count({ where: { role: 'USER' } })
    ])

    // Fetch registration requests in Postgres to fallback if SQL Server is not linked
    const lineUserIds = rawUsers.map(u => u.lineUserId)
    const regRequests = await prisma.registrationRequest.findMany({
      where: { lineUserId: { in: lineUserIds } },
      select: {
        lineUserId: true,
        firstName: true,
        lastName: true,
        email: true,
        branchCode: true
      }
    })
    const regReqMap = new Map(regRequests.map(r => [r.lineUserId, r]))

    // Enrich with SQL Server EV_User & Branch Names (Best Effort)
    let sqlUsersById = new Map<number, any>()
    let sqlUsersByLineId = new Map<string, any>()
    let branchNameMap = new Map<string, string>()

    try {
      const pool = await getMSSQLPool()
      if (pool) {
        // Fetch EV_User records
        const evUsersRes = await pool.request().query(`
          SELECT 
            UserID,
            FirstName,
            LastName,
            UserEmail,
            LineUserId,
            BranchCode,
            IsActive
          FROM dbo.EV_User
        `)
        for (const row of evUsersRes.recordset) {
          if (row.UserID) sqlUsersById.set(row.UserID, row)
          if (row.LineUserId) sqlUsersByLineId.set(row.LineUserId, row)
        }

        // Fetch Branch Locations
        const branchRes = await pool.request().query(`
          SELECT StatusCode, StatusName 
          FROM dbo.EV_MsSubStatus 
          WHERE Type = 'LOCATION' AND IsActive = 1
        `)
        for (const b of branchRes.recordset) {
          if (b.StatusCode) branchNameMap.set(b.StatusCode, b.StatusName)
        }
      }
    } catch (sqlErr) {
      console.warn('[Admin Users API] Warning: Failed to query SQL Server for enrichment:', sqlErr)
    }

    // Combine data
    const users = rawUsers.map(u => {
      const sqlUser = (u.ev7UserId ? sqlUsersById.get(u.ev7UserId) : null) || sqlUsersByLineId.get(u.lineUserId)
      const regReq = regReqMap.get(u.lineUserId)

      const branchCode = sqlUser?.BranchCode || regReq?.branchCode || null
      const branchName = branchCode ? (branchNameMap.get(branchCode) || branchCode) : null

      return {
        ...u,
        firstName: sqlUser?.FirstName || regReq?.firstName || null,
        lastName: sqlUser?.LastName || regReq?.lastName || null,
        email: sqlUser?.UserEmail || regReq?.email || null,
        branchCode,
        branchName,
        isMapped: !!sqlUser
      }
    })

    return NextResponse.json({
      users,
      total,
      page: isExport ? 1 : page,
      limit: isExport ? total : limit,
      totalPages: isExport ? 1 : Math.ceil(total / limit),
      summary: {
        totalSuperAdmin,
        totalAdmin,
        totalUser,
        total: totalSuperAdmin + totalAdmin + totalUser
      }
    })
  } catch (error) {
    console.error('[Admin Users API GET Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { lineUserId, role, isActive, ev7UserId, receiveAllNotes, branchCode, passcode, userId } = body

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    // Check database role of caller
    const caller = userId === 'usr_mock_dev' ? { role: 'SUPER_ADMIN' } : await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 })
    }

    if (!lineUserId) {
      return NextResponse.json({ error: 'Missing lineUserId' }, { status: 400 })
    }

    const user = await prisma.lineRegistration.findUnique({
      where: { lineUserId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (role !== undefined) {
      if (!['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      updateData.role = role
    }
    if (isActive !== undefined) {
      updateData.isActive = !!isActive
    }
    if (ev7UserId !== undefined) {
      updateData.ev7UserId = ev7UserId === null ? null : parseInt(String(ev7UserId), 10)
    }
    if (receiveAllNotes !== undefined) {
      updateData.receiveAllNotes = !!receiveAllNotes
    }

    const updatedUser = await prisma.lineRegistration.update({
      where: { lineUserId },
      data: updateData
    })

    // If branchCode is provided, update SQL Server EV_User & PostgreSQL registration_requests
    const targetEv7UserId = ev7UserId !== undefined ? updateData.ev7UserId : user.ev7UserId

    if (branchCode !== undefined) {
      try {
        const pool = await getMSSQLWritePool()
        if (pool) {
          const updSqlReq = pool.request()
          updSqlReq.input('branchCode', sql.VarChar, branchCode || null)
          updSqlReq.input('lineUserId', sql.VarChar, lineUserId)

          if (targetEv7UserId) {
            updSqlReq.input('ev7UserId', sql.Int, targetEv7UserId)
            await updSqlReq.query(`
              UPDATE dbo.EV_User 
              SET BranchCode = @branchCode, ModifiedDatetime = GETDATE()
              WHERE UserID = @ev7UserId OR LineUserId = @lineUserId
            `)
          } else {
            await updSqlReq.query(`
              UPDATE dbo.EV_User 
              SET BranchCode = @branchCode, ModifiedDatetime = GETDATE()
              WHERE LineUserId = @lineUserId
            `)
          }
        }

        // Also update registration_requests in Postgres if exists
        await prisma.registrationRequest.updateMany({
          where: { lineUserId },
          data: { branchCode: branchCode || '' }
        })
      } catch (sqlErr: any) {
        console.warn('[Admin Users API PATCH] Warning: Failed to update SQL Server EV_User BranchCode:', sqlErr.message)
      }
    }

    return NextResponse.json({ success: true, user: updatedUser })
  } catch (error) {
    console.error('[Admin Users API PATCH Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
