import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { getMSSQLPool, sql } from '@/lib/mssql'
import * as line from '@line/bot-sdk'

export const dynamic = 'force-dynamic'

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
})

function formatDateTh(d: Date | string | null): string {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric',
      timeZone: 'Asia/Bangkok',
    })
  } catch { return String(d) }
}

// ─── Build Flex: New Maintenance Alert ──────────────────────────────
function buildMaintenanceFlex(item: any): any {
  const projectDisplay = (item.ProjectType || '').toLowerCase() === 'taxi' ? 'EV7' : (item.ProjectType || '-')
  return {
    type: 'flex',
    altText: `🔧 แจ้งซ่อมใหม่: ${item.RegisterNo || item.VinNo}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#C62828', paddingAll: '16px',
        contents: [
          { type: 'text', text: '🔧 แจ้งซ่อมใหม่', color: '#ffffff', weight: 'bold', size: 'lg' },
          { type: 'text', text: item.RegisterNo || item.VinNo || '-', color: '#ffcdd2', size: 'sm', margin: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md',
        contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'รุ่น', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: item.Model || '-', color: '#111827', size: 'sm', weight: 'bold', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'โครงการ', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: projectDisplay, color: '#111827', size: 'sm', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'อาการ', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: item.IssueTitle || '-', color: '#111827', size: 'sm', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'วันที่แจ้ง', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: formatDateTh(item.ReportDate), color: '#111827', size: 'sm', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'สถานที่ซ่อม', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: item.ServiceLocationCode || '-', color: '#111827', size: 'sm', flex: 5, wrap: true },
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        contents: [{
          type: 'button', style: 'primary', color: '#C62828',
          action: {
            type: 'uri', label: 'ดูรายละเอียดเพิ่มเติม',
            uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/vehicle/${item.RegisterNo || item.VinNo}`)}`,
          },
        }],
      },
    },
  }
}

// ─── Build Flex: New Delivery Alert ─────────────────────────────────
function buildDeliveryFlex(item: any): any {
  const projectDisplay = (item.ProjectType || '').toLowerCase() === 'taxi' ? 'EV7' : (item.ProjectType || '-')
  const customerName = item.FirstName ? `${item.FirstName} ${item.LastName ? '***' : ''}`.trim() : '-'
  return {
    type: 'flex',
    altText: `🚗 ปล่อยรถใหม่: ${item.RegisterNo || item.VinNo}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#1565C0', paddingAll: '16px',
        contents: [
          { type: 'text', text: '🚗 ปล่อยรถใหม่', color: '#ffffff', weight: 'bold', size: 'lg' },
          { type: 'text', text: item.RegisterNo || item.VinNo || '-', color: '#bbdefb', size: 'sm', margin: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md',
        contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'รุ่น', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: item.Model || '-', color: '#111827', size: 'sm', weight: 'bold', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'โครงการ', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: projectDisplay, color: '#111827', size: 'sm', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'ลูกค้า', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: customerName, color: '#111827', size: 'sm', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'เลขสัญญา', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: item.ContractNo || '-', color: '#111827', size: 'sm', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'วันส่งมอบ', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: formatDateTh(item.ReleaseDate), color: '#111827', size: 'sm', flex: 5 },
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        contents: [{
          type: 'button', style: 'primary', color: '#1565C0',
          action: {
            type: 'uri', label: 'ดูรายละเอียดเพิ่มเติม',
            uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/vehicle/${item.RegisterNo || item.VinNo}`)}`,
          },
        }],
      },
    },
  }
}

// ─── Main GET handler ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'MSSQL connection failed' }, { status: 500 })
    }

    // Get active groups
    const activeGroups = await prisma.lineGroup.findMany({
      where: { isActive: true, enableReport: true },
    })
    if (activeGroups.length === 0) {
      return NextResponse.json({ success: true, message: 'No active groups', alerts: 0 })
    }

    // ─── Test Mode (if testVin or testMaintVin is provided) ──────────
    const testVin = req.nextUrl.searchParams.get('testVin')
    const testMaintVin = req.nextUrl.searchParams.get('testMaintVin')

    if (testVin) {
      const deliveryResult = await pool.request()
        .input('vin', sql.NVarChar, testVin)
        .query(`
          SELECT TOP 1
            r.RentItemID,
            r.VinNo,
            r.ContractNo,
            r.FirstName,
            r.LastName,
            r.ReleaseDate,
            i.RegisterNo,
            i.Model,
            i.ProjectType,
            i.Status AS CarStatus
          FROM dbo.EV_RentItem r
          LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
          WHERE r.IsActive = 1
            AND (r.VinNo = @vin OR i.RegisterNo = @vin)
          ORDER BY r.RentItemID DESC
        `)
      
      const item = deliveryResult.recordset[0]
      if (!item) {
        return NextResponse.json({ error: `No rent record found for VIN/RegisterNo: ${testVin}` }, { status: 404 })
      }
      
      const flexMsg = buildDeliveryFlex(item)
      let sentCount = 0
      for (const group of activeGroups) {
        if (!env.MOCK_MODE) {
          await lineClient.pushMessage({ to: group.groupId, messages: [flexMsg] })
        }
        sentCount++
      }
      return NextResponse.json({ success: true, message: `Test delivery alert sent for ${item.RegisterNo || item.VinNo}`, item, sentCount })
    }

    if (testMaintVin) {
      const maintResult = await pool.request()
        .input('vin', sql.NVarChar, testMaintVin)
        .query(`
          SELECT TOP 1
            m.MaintenanceItemID,
            m.VinNo,
            m.IssueTitle,
            m.CarStatusCode,
            m.ServiceLocationCode,
            m.ReportDate,
            i.RegisterNo,
            i.Model,
            i.ProjectType
          FROM dbo.EV_MaintenanceItem m
          LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
          WHERE m.IsActive = 1
            AND (m.VinNo = @vin OR i.RegisterNo = @vin)
          ORDER BY m.MaintenanceItemID DESC
        `)
      
      const item = maintResult.recordset[0]
      if (!item) {
        return NextResponse.json({ error: `No maintenance record found for VIN/RegisterNo: ${testMaintVin}` }, { status: 404 })
      }
      
      const flexMsg = buildMaintenanceFlex(item)
      let sentCount = 0
      for (const group of activeGroups) {
        if (!env.MOCK_MODE) {
          await lineClient.pushMessage({ to: group.groupId, messages: [flexMsg] })
        }
        sentCount++
      }
      return NextResponse.json({ success: true, message: `Test maintenance alert sent for ${item.RegisterNo || item.VinNo}`, item, sentCount })
    }

    // Get already-sent IDs to skip
    const sentMaint = await prisma.activityNotification.findMany({
      where: { recordType: 'MAINTENANCE' },
      select: { recordId: true },
    })
    const sentDelivery = await prisma.activityNotification.findMany({
      where: { recordType: 'DELIVERY' },
      select: { recordId: true },
    })
    const sentMaintIds = new Set(sentMaint.map(s => s.recordId))
    const sentDeliveryIds = new Set(sentDelivery.map(s => s.recordId))

    // ── Poll new records since start of today (Bangkok midnight) ──
    const now = new Date()
    const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
    // Midnight Bangkok = 17:00 UTC previous day
    const since = new Date(`${bangkokDate}T00:00:00+07:00`)

    const maintResult = await pool.request()
      .input('since', sql.DateTime, since)
      .query(`
        SELECT 
          m.MaintenanceItemID,
          m.VinNo,
          m.IssueTitle,
          m.CarStatusCode,
          m.ServiceLocationCode,
          m.ReportDate,
          i.RegisterNo,
          i.Model,
          i.ProjectType
        FROM dbo.EV_MaintenanceItem m
        LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.IsActive = 1
          AND m.ReportDate >= @since
        ORDER BY m.ReportDate DESC
      `)

    // ── Poll new Deliveries (actually released today) ─────────────
    const deliveryResult = await pool.request()
      .input('since', sql.DateTime, since)
      .query(`
        SELECT
          r.RentItemID,
          r.VinNo,
          r.ContractNo,
          r.FirstName,
          r.LastName,
          r.ReleaseDate,
          i.RegisterNo,
          i.Model,
          i.ProjectType,
          i.Status AS CarStatus
        FROM dbo.EV_RentItem r
        LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
        WHERE r.IsActive = 1
          AND r.ReleaseDate >= @since
          AND r.ReleaseDate IS NOT NULL
        ORDER BY r.ReleaseDate DESC
      `)

    // Filter out already-sent (cast string/bigint to number to match PostgreSQL type)
    const newMaint = maintResult.recordset.filter(
      (m: any) => !sentMaintIds.has(Number(m.MaintenanceItemID))
    )
    const newDelivery = deliveryResult.recordset.filter(
      (d: any) => !sentDeliveryIds.has(Number(d.RentItemID))
    )

    console.log(`[Activity] Found ${newMaint.length} new maintenance, ${newDelivery.length} new deliveries`)

    let alertsSent = 0

    // Send maintenance alerts (max 5 per poll to avoid rate limit)
    for (const item of newMaint.slice(0, 5)) {
      const flexMsg = buildMaintenanceFlex(item)
      for (const group of activeGroups) {
        try {
          if (!env.MOCK_MODE) {
            await lineClient.pushMessage({ to: group.groupId, messages: [flexMsg] })
          }
          console.log(`[Activity] ✅ Maint alert ${item.MaintenanceItemID} → ${group.groupName}`)
        } catch (err: any) {
          console.error(`[Activity] ❌ Maint push failed:`, err.message)
        }
      }
      // Mark as sent (cast to number to match Prisma schema)
      await prisma.activityNotification.create({
        data: { recordType: 'MAINTENANCE', recordId: Number(item.MaintenanceItemID) },
      }).catch(() => { /* unique constraint = already sent */ })
      alertsSent++
    }

    // Send delivery alerts (max 5 per poll)
    for (const item of newDelivery.slice(0, 5)) {
      const flexMsg = buildDeliveryFlex(item)
      for (const group of activeGroups) {
        try {
          if (!env.MOCK_MODE) {
            await lineClient.pushMessage({ to: group.groupId, messages: [flexMsg] })
          }
          console.log(`[Activity] ✅ Delivery alert ${item.RentItemID} → ${group.groupName}`)
        } catch (err: any) {
          console.error(`[Activity] ❌ Delivery push failed:`, err.message)
        }
      }
      // Mark as sent (cast to number to match Prisma schema)
      await prisma.activityNotification.create({
        data: { recordType: 'DELIVERY', recordId: Number(item.RentItemID) },
      }).catch(() => { /* unique constraint = already sent */ })
      alertsSent++
    }

    // Cleanup old records (> 7 days) to prevent table bloat
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    await prisma.activityNotification.deleteMany({
      where: { sentAt: { lt: weekAgo } },
    })

    return NextResponse.json({
      success: true,
      newMaintenance: newMaint.length,
      newDeliveries: newDelivery.length,
      alertsSent,
      groupsNotified: activeGroups.length,
    })
  } catch (error: any) {
    console.error('[Activity Notify Error]', error)
    return NextResponse.json(
      { error: 'Activity notify failed', details: error.message },
      { status: 500 }
    )
  }
}
