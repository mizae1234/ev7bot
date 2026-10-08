import { prisma } from '@/lib/prisma'
import { getMSSQLWritePool, sql } from '@/lib/mssql'

export class ImportAuthError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/**
 * Strictly resolve the acting user for a write: the LINE account must be linked to an
 * EV7 user (same rule as /api/maintenance/update-quick). No fallback to the system user.
 */
export async function resolveImportUser(lineUserId: string | null | undefined): Promise<{ userId: number; name: string }> {
  if (!lineUserId) {
    throw new ImportAuthError('ไม่พบข้อมูลผู้ใช้งาน LINE กรุณาเข้าสู่ระบบก่อนนำเข้าข้อมูล', 401)
  }

  let reg: Awaited<ReturnType<typeof prisma.lineRegistration.findUnique>>
  try {
    reg = await prisma.lineRegistration.findUnique({ where: { lineUserId } })
  } catch (err) {
    console.error('[Maintenance Import] Cannot read line_registrations:', err)
    throw new ImportAuthError('เชื่อมต่อฐานข้อมูลผู้ใช้ (Postgres) ไม่ได้ จึงตรวจสอบสิทธิ์ไม่ได้ กรุณาตรวจสอบ DATABASE_URL / การเชื่อมต่อ', 503)
  }
  if (!reg?.ev7UserId) {
    throw new ImportAuthError('กรุณาทำการลงทะเบียน/ผูกบัญชีเพื่อเปิดสิทธิ์การใช้งานก่อนทำรายการ')
  }

  let name = reg.displayName || 'ผู้ใช้ LINE'
  // Same check as update-quick: SQL Server-registered users (id < 10000) must exist and be active.
  if (reg.ev7UserId < 10000) {
    const pool = await getMSSQLWritePool()
    if (!pool) throw new ImportAuthError('ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 500)
    const res = await pool.request()
      .input('userId', sql.Int, reg.ev7UserId)
      .query('SELECT FirstName FROM dbo.EV_User WHERE UserID = @userId AND IsActive = 1')
    if (res.recordset.length === 0) {
      throw new ImportAuthError('บัญชีผู้ใช้งานของคุณไม่มีอยู่ในตาราง EV_User หรือถูกระงับการใช้งาน')
    }
    name = (res.recordset[0].FirstName || name).trim()
  }

  return { userId: reg.ev7UserId, name }
}
