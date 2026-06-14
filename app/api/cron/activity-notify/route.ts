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

function getCarStatusDisplay(
  statusName: string,
  statusCode: string,
  subStatusName?: string,
  subStatusCode?: string
): string {
  const emojiMap: Record<string, string> = {
    PRODUCTION: '🏭',
    AVAILABLE: '✅',
    ON_RENT: '🚗',
    MAINTENANCE: '🔧',
    REPLACEMENT: '🔄',
    WAITING_FOR_GR: '📦',
  }
  const emoji = emojiMap[statusCode || ''] || '📋'
  const name = subStatusName || statusName || statusCode || '-'
  if (statusCode && subStatusCode && statusCode !== subStatusCode) {
    return `${emoji} ${name} (${statusCode} / ${subStatusCode})`
  }
  if (statusCode) {
    return `${emoji} ${name} (${statusCode})`
  }
  return `${emoji} ${name}`
}

// ─── Build Flex: New Maintenance Alert ──────────────────────────────
function buildMaintenanceFlex(item: any): any {
  const projectDisplay = (item.ProjectType || '').toLowerCase() === 'taxi' ? 'EV7' : (item.ProjectType || '-')
  let usageStatus = '-'
  if (item.CarStatusCode === 'STILL_WORK') {
    usageStatus = '🟢 ยังใช้งานได้ (ยังวิ่งอยู่)'
  } else if (item.CarStatusCode === 'IN_MAINTENANCE') {
    usageStatus = '🔴 งดใช้งาน (อยู่ระหว่างซ่อม)'
  } else if (item.CarStatusCode === 'WAITING_FOR_MAINTENANCE') {
    usageStatus = '🟡 งดใช้งาน (รอเข้าซ่อม)'
  } else if (item.CarStatusCode === 'COMPLETE') {
    usageStatus = '🟢 ซ่อมเสร็จสิ้น (ใช้งานได้)'
  } else if (item.CarStatusCode) {
    usageStatus = item.CarStatusCode
  }

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
            { type: 'text', text: 'การใช้งาน', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: usageStatus, color: '#111827', size: 'sm', weight: 'bold', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'สถานะปัจจุบัน', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: getCarStatusDisplay(item.CarStatusName, item.CarInventoryStatusCode, item.CarSubStatusName, item.CarSubStatusCode), color: '#111827', size: 'sm', weight: 'bold', flex: 5, wrap: true },
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
            { type: 'text', text: 'สถานะปัจจุบัน', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: getCarStatusDisplay(item.CarStatusName, item.CarInventoryStatusCode, item.CarSubStatusName, item.CarSubStatusCode), color: '#111827', size: 'sm', weight: 'bold', flex: 5, wrap: true },
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

// ─── Build Flex: New Return Alert ───────────────────────────────────
function buildReturnFlex(item: any): any {
  const projectDisplay = (item.ProjectType || '').toLowerCase() === 'taxi' ? 'EV7' : (item.ProjectType || '-')
  const mileageDisplay = item.Mileage ? `${Number(item.Mileage).toLocaleString('th-TH')} กม.` : '-'
  return {
    type: 'flex',
    altText: `↩️ บันทึกคืนรถ: ${item.RegisterNo || item.VinNo}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#2E7D32', paddingAll: '16px',
        contents: [
          { type: 'text', text: '↩️ บันทึกคืนรถ', color: '#ffffff', weight: 'bold', size: 'lg' },
          { type: 'text', text: item.RegisterNo || item.VinNo || '-', color: '#c8e6c9', size: 'sm', margin: 'xs' },
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
            { type: 'text', text: item.CustomerName || '-', color: '#111827', size: 'sm', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'เลขสัญญา', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: item.ContractNo || '-', color: '#111827', size: 'sm', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'วันคืนรถ', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: formatDateTh(item.ReturnDate || item.ReceiveDate), color: '#111827', size: 'sm', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'เลขไมล์คืน', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: mileageDisplay, color: '#111827', size: 'sm', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'สถานที่จอด', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: item.ParkLocation || '-', color: '#111827', size: 'sm', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'สถานะปัจจุบัน', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: getCarStatusDisplay(item.CarStatusName, item.CarInventoryStatusCode, item.CarSubStatusName, item.CarSubStatusCode), color: '#111827', size: 'sm', weight: 'bold', flex: 5, wrap: true },
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        contents: [{
          type: 'button', style: 'primary', color: '#2E7D32',
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

    // ─── Test Mode (if testVin, testMaintVin or testReturnVin is provided) ──
    const testVin = req.nextUrl.searchParams.get('testVin')
    const testMaintVin = req.nextUrl.searchParams.get('testMaintVin')
    const testReturnVin = req.nextUrl.searchParams.get('testReturnVin')

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
            i.Status AS CarInventoryStatusCode,
            s.DescriptionStatus AS CarStatusName,
            sub.DescriptionStatus AS CarSubStatusName,
            i.StatusType AS CarSubStatusCode
          FROM dbo.EV_RentItem r
          LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
          LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
          LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
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
            i.ProjectType,
            i.Status AS CarInventoryStatusCode,
            s.DescriptionStatus AS CarStatusName,
            sub.DescriptionStatus AS CarSubStatusName,
            i.StatusType AS CarSubStatusCode
          FROM dbo.EV_MaintenanceItem m
          LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
          LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
          LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
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

    if (testReturnVin) {
      const returnResult = await pool.request()
        .input('vin', sql.NVarChar, testReturnVin)
        .query(`
          SELECT TOP 1
            r.ReturnItemID,
            r.VinNo,
            r.CustomerName,
            r.Model,
            rent.ContractNo,
            r.ReceiveDate,
            r.ReturnDate,
            r.Mileage,
            r.ParkLocation,
            i.RegisterNo,
            i.ProjectType,
            i.Status AS CarInventoryStatusCode,
            s.DescriptionStatus AS CarStatusName,
            sub.DescriptionStatus AS CarSubStatusName,
            i.StatusType AS CarSubStatusCode
          FROM dbo.EV_ReturnItem r
          LEFT JOIN dbo.EV_RentItem rent ON r.RentItemID = rent.RentItemID
          LEFT JOIN dbo.EV_InventoryItem i ON i.VinNo = r.VinNo
          LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
          LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
          WHERE r.VinNo = @vin OR i.RegisterNo = @vin
          ORDER BY r.ReturnItemID DESC
        `)
      
      const item = returnResult.recordset[0]
      if (!item) {
        return NextResponse.json({ error: `No return record found for VIN/RegisterNo: ${testReturnVin}` }, { status: 404 })
      }
      
      const flexMsg = buildReturnFlex(item)
      let sentCount = 0
      for (const group of activeGroups) {
        if (!env.MOCK_MODE) {
          await lineClient.pushMessage({ to: group.groupId, messages: [flexMsg] })
        }
        sentCount++
      }
      return NextResponse.json({ success: true, message: `Test return alert sent for ${item.RegisterNo || item.VinNo}`, item, sentCount })
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
    const sentReturn = await prisma.activityNotification.findMany({
      where: { recordType: 'RETURN' },
      select: { recordId: true },
    })
    const sentMaintIds = new Set(sentMaint.map(s => s.recordId))
    const sentDeliveryIds = new Set(sentDelivery.map(s => s.recordId))
    const sentReturnIds = new Set(sentReturn.map(s => s.recordId))

    // ── Poll new records since start of today (Bangkok midnight) ──
    const now = new Date()
    const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
    // Midnight Bangkok = 17:00 UTC previous day
    const since = new Date(`${bangkokDate}T00:00:00+07:00`)

    // Parallelize SQL queries for maximum performance
    const maintQueryPromise = pool.request()
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
          i.ProjectType,
          i.Status AS CarInventoryStatusCode,
          s.DescriptionStatus AS CarStatusName,
          sub.DescriptionStatus AS CarSubStatusName,
          i.StatusType AS CarSubStatusCode
        FROM dbo.EV_MaintenanceItem m
        LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
        LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
        WHERE m.IsActive = 1
          AND m.ReportDate >= @since
        ORDER BY m.ReportDate DESC
      `)

    const deliveryQueryPromise = pool.request()
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
          i.Status AS CarInventoryStatusCode,
          s.DescriptionStatus AS CarStatusName,
          sub.DescriptionStatus AS CarSubStatusName,
          i.StatusType AS CarSubStatusCode
        FROM dbo.EV_RentItem r
        LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
        LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
        WHERE r.IsActive = 1
          AND r.ReleaseDate >= @since
          AND r.ReleaseDate IS NOT NULL
        ORDER BY r.ReleaseDate DESC
      `)

    const returnQueryPromise = pool.request()
      .input('since', sql.DateTime, since)
      .query(`
        SELECT 
          r.ReturnItemID,
          r.VinNo,
          r.CustomerName,
          r.Model,
          rent.ContractNo,
          r.ReceiveDate,
          r.ReturnDate,
          r.Mileage,
          r.ParkLocation,
          i.RegisterNo,
          i.ProjectType,
          i.Status AS CarInventoryStatusCode,
          s.DescriptionStatus AS CarStatusName,
          sub.DescriptionStatus AS CarSubStatusName,
          i.StatusType AS CarSubStatusCode
        FROM dbo.EV_ReturnItem r
        LEFT JOIN dbo.EV_RentItem rent ON r.RentItemID = rent.RentItemID
        LEFT JOIN dbo.EV_InventoryItem i ON i.VinNo = r.VinNo
        LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
        LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
        WHERE r.ReceiveDate >= @since OR r.ReturnDate >= @since
        ORDER BY r.ReceiveDate DESC, r.ReturnDate DESC
      `)

    const [maintResult, deliveryResult, returnResult] = await Promise.all([
      maintQueryPromise,
      deliveryQueryPromise,
      returnQueryPromise
    ])

    // Filter out already-sent
    const newMaint = maintResult.recordset.filter(
      (m: any) => !sentMaintIds.has(Number(m.MaintenanceItemID))
    )
    const newDelivery = deliveryResult.recordset.filter(
      (d: any) => !sentDeliveryIds.has(Number(d.RentItemID))
    )
    const newReturn = returnResult.recordset.filter(
      (r: any) => !sentReturnIds.has(Number(r.ReturnItemID))
    )

    console.log(`[Activity] Found ${newMaint.length} new maintenance, ${newDelivery.length} new deliveries, ${newReturn.length} new returns`)

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

    // Send return alerts (max 5 per poll)
    for (const item of newReturn.slice(0, 5)) {
      const flexMsg = buildReturnFlex(item)
      for (const group of activeGroups) {
        try {
          if (!env.MOCK_MODE) {
            await lineClient.pushMessage({ to: group.groupId, messages: [flexMsg] })
          }
          console.log(`[Activity] ✅ Return alert ${item.ReturnItemID} → ${group.groupName}`)
        } catch (err: any) {
          console.error(`[Activity] ❌ Return push failed:`, err.message)
        }
      }
      // Mark as sent (cast to number to match Prisma schema)
      await prisma.activityNotification.create({
        data: { recordType: 'RETURN', recordId: Number(item.ReturnItemID) },
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
      newReturns: newReturn.length,
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
