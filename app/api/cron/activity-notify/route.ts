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

const locationMap: Record<string, string> = {
  'AION_GI_KANCHANAPISEK': 'Aion กาญจนาฯ',
  'AION_GI_RAMINTRA_EXPRESSWAY': 'Aion เลียบด่วนฯ',
  'AION_GI_PIBULSONGKRAM': 'Aion พิบูลฯ',
  'AION_GI_MINBURI': 'Aion มีนบุรี',
  'AION_GI_MAHACHAI': 'Aion มหาชัย',
  'AION_GI_SALAYA': 'Aion ศาลายา',
  'EV7_YARD_PRAPADAENG': 'EV7 Yard พระประแดง',
  'SMART_TAXI': 'สมาร์ทเแท็กซี่',
  'GARAGE_BUNGKHWANG': 'อู่ บึงขวาง',
  'GARAGE_TS': 'อู่ TS',
  'GARAGE_88_CAR': 'อู่ 88 คาร์',
  'GARAGE_CRN_PAKKRET': 'อู่ CRN ปากเกร็ด',
  'GARAGE_56_COLOR': 'อู่ 56 Color',
  'GARAGE_PRICHA': 'อู่ ปรีชา',
  'GARAGE_PERFECTCAR': 'อู่ เพอร์เฟคคาร์',
  'GARAGE_SAHACAR': 'อู่ สหาคาร์',
  'GARAGE_PREMIUMCAR': 'อู่ พรีเมี่ยมคาร์',
  'GARAGE_BESTCARPAINT': 'อู่ เบสท์คาร์เพ้นท์',
}

function getLocationName(code: string | null | undefined): string {
  if (!code) return '-'
  return locationMap[code] || code.replace(/_/g, ' ')
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
        type: 'box', layout: 'vertical', backgroundColor: '#C62828', paddingStart: '16px', paddingEnd: '16px', paddingTop: '12px', paddingBottom: '12px',
        contents: [
          { type: 'text', text: '🔧 แจ้งซ่อมใหม่', color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: item.RegisterNo || item.VinNo || '-', color: '#ffcdd2', size: 'xs', margin: 'xs', weight: 'bold' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingTop: '10px', paddingBottom: '10px', spacing: 'sm',
        contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'รุ่น/โครงการ', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${item.Model || '-'} (${projectDisplay})`, color: '#111827', size: 'xs', weight: 'bold', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'อาการ', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: item.IssueTitle || '-', color: '#111827', size: 'xs', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'การใช้งาน/อู่', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${usageStatus} / ${item.ServiceLocationCode || '-'}`, color: '#111827', size: 'xs', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'วันเกิดเหตุ/บันทึก', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${formatDateTh(item.IncidentDate)} / ${formatDateTh(item.CreateDate)}`, color: '#111827', size: 'xs', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'วันที่แจ้ง/ผู้แจ้ง', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${formatDateTh(item.ReportDate)} (${item.CreatorName || '-'})`, color: '#111827', size: 'xs', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'สถานะปัจจุบัน', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: getCarStatusDisplay(item.CarStatusName, item.CarInventoryStatusCode, item.CarSubStatusName, item.CarSubStatusCode), color: (item.CarInventoryStatusCode === 'MAINTENANCE' || item.CarSubStatusCode === 'ON_RENT_MAINTENANCE') ? '#dc2626' : '#111827', size: 'xs', weight: 'bold', flex: 5, wrap: true },
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingTop: '8px', paddingBottom: '12px',
        contents: [{
          type: 'button', style: 'primary', color: '#C62828', height: 'sm',
          action: {
            type: 'uri', label: 'ดูรายละเอียดเพิ่มเติม',
            uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/vehicle/${item.RegisterNo || item.VinNo}`)}`,
          },
        }],
      },
    },
  }
}

// ─── Build Flex: Ready Pickup Alert ──────────────────────────────────
function buildReadyPickupFlex(item: any): any {
  const projectDisplay = (item.ProjectType || '').toLowerCase() === 'taxi' ? 'EV7' : (item.ProjectType || '-')
  const isComplete = item.CarStatusCode === 'COMPLETE'
  const accentColor = isComplete ? '#2E7D32' : '#E65100'
  const titleText = isComplete ? '🟢 รถซ่อมเสร็จพร้อมใช้' : '🟠 รถซ่อมเสร็จ รอปล่อย'
  const nextToDoText = isComplete ? '📌 Next to do : รถซ่อมเสร็จ สแตนบายรอปล่อยงาน / รอสลับรถ' : '📌 Next to do : ติดตามลูกค้าเข้ารับรถ'
  const bannerBg = isComplete ? '#E8F5E9' : '#FFF3E0'
  const headerBg = isComplete ? '#c8e6c9' : '#ffe0b2'
  const altText = `${isComplete ? '🟢 รถซ่อมเสร็จพร้อมใช้' : '🟠 รถซ่อมเสร็จ รอปล่อย'}: ${item.RegisterNo || item.VinNo}`
  const usageStatus = isComplete ? '🟢 พร้อมใช้ (ซ่อมเสร็จ)' : '🟠 พร้อมรับรถ (ซ่อมเสร็จ รอปล่อย)'

  return {
    type: 'flex',
    altText: altText,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: accentColor, paddingStart: '16px', paddingEnd: '16px', paddingTop: '12px', paddingBottom: '12px',
        contents: [
          { type: 'text', text: titleText, color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: item.RegisterNo || item.VinNo || '-', color: headerBg, size: 'xs', margin: 'xs', weight: 'bold' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingTop: '10px', paddingBottom: '10px', spacing: 'sm',
        contents: [
          // Next to do banner
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: bannerBg,
            cornerRadius: 'md',
            paddingTop: '10px',
            paddingBottom: '10px',
            paddingStart: '10px',
            paddingEnd: '10px',
            contents: [
              {
                type: 'text',
                text: nextToDoText,
                color: accentColor,
                weight: 'bold',
                size: 'xs',
                wrap: true
              }
            ]
          },
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'รุ่น/โครงการ', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${item.Model || '-'} (${projectDisplay})`, color: '#111827', size: 'xs', weight: 'bold', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'อาการ', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: item.IssueTitle || '-', color: '#111827', size: 'xs', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'การใช้งาน/อู่', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${usageStatus} / ${getLocationName(item.ServiceLocationCode)}`, color: '#111827', size: 'xs', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'วันเกิดเหตุ/บันทึก', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${formatDateTh(item.IncidentDate)} / ${formatDateTh(item.CreateDate)}`, color: '#111827', size: 'xs', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'วันที่ซ่อมเสร็จ', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: formatDateTh(item.MaintenanceFinishDate || item.UpdateDate), color: isComplete ? '#2E7D32' : '#d84315', size: 'xs', weight: 'bold', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'ผู้บันทึกซ่อมเสร็จ', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: item.UpdaterName || item.CreatorName || '-', color: '#111827', size: 'xs', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'สถานะปัจจุบัน', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: getCarStatusDisplay(item.CarStatusName, item.CarInventoryStatusCode, item.CarSubStatusName, item.CarSubStatusCode), color: '#111827', size: 'xs', weight: 'bold', flex: 5, wrap: true },
          ]}
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingTop: '8px', paddingBottom: '12px',
        contents: [{
          type: 'button', style: 'primary', color: accentColor, height: 'sm',
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
        type: 'box', layout: 'vertical', backgroundColor: '#2E7D32', paddingStart: '16px', paddingEnd: '16px', paddingTop: '12px', paddingBottom: '12px',
        contents: [
          { type: 'text', text: '🚗 ปล่อยรถใหม่', color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: item.RegisterNo || item.VinNo || '-', color: '#c8e6c9', size: 'xs', margin: 'xs', weight: 'bold' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingTop: '10px', paddingBottom: '10px', spacing: 'sm',
        contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'รุ่น/โครงการ', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${item.Model || '-'} (${projectDisplay})`, color: '#111827', size: 'xs', weight: 'bold', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'ลูกค้า/สัญญา', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${customerName} (${item.ContractNo || '-'})`, color: '#111827', size: 'xs', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'วันส่งมอบ/ผู้ส่ง', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${formatDateTh(item.ReleaseDate)} (${item.CreatorName || '-'})`, color: '#111827', size: 'xs', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'สถานะปัจจุบัน', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: getCarStatusDisplay(item.CarStatusName, item.CarInventoryStatusCode, item.CarSubStatusName, item.CarSubStatusCode), color: (item.CarInventoryStatusCode === 'MAINTENANCE' || item.CarSubStatusCode === 'ON_RENT_MAINTENANCE') ? '#dc2626' : '#111827', size: 'xs', weight: 'bold', flex: 5, wrap: true },
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingTop: '8px', paddingBottom: '12px',
        contents: [{
          type: 'button', style: 'primary', color: '#2E7D32', height: 'sm',
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
        type: 'box', layout: 'vertical', backgroundColor: '#1565C0', paddingStart: '16px', paddingEnd: '16px', paddingTop: '12px', paddingBottom: '12px',
        contents: [
          { type: 'text', text: '↩️ บันทึกคืนรถ', color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: item.RegisterNo || item.VinNo || '-', color: '#bbdefb', size: 'xs', margin: 'xs', weight: 'bold' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingTop: '10px', paddingBottom: '10px', spacing: 'sm',
        contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'รุ่น/โครงการ', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${item.Model || '-'} (${projectDisplay})`, color: '#111827', size: 'xs', weight: 'bold', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'ลูกค้า/สัญญา', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${item.CustomerName || '-'} (${item.ContractNo || '-'})`, color: '#111827', size: 'xs', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'วันนัดคืน/เลขไมล์', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${formatDateTh(item.ReturnDate)} / ${mileageDisplay}`, color: '#111827', size: 'xs', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'บันทึกคืน/ผู้บันทึก', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${formatDateTh(item.CreateDate)} (${item.CreatorName || '-'})`, color: '#111827', size: 'xs', flex: 5 },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'สถานที่จอด', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: item.ParkLocation || '-', color: '#111827', size: 'xs', flex: 5, wrap: true },
          ]},
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'สถานะปัจจุบัน', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: getCarStatusDisplay(item.CarStatusName, item.CarInventoryStatusCode, item.CarSubStatusName, item.CarSubStatusCode), color: (item.CarInventoryStatusCode === 'MAINTENANCE' || item.CarSubStatusCode === 'ON_RENT_MAINTENANCE') ? '#dc2626' : '#111827', size: 'xs', weight: 'bold', flex: 5, wrap: true },
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingStart: '16px', paddingEnd: '16px', paddingTop: '8px', paddingBottom: '12px',
        contents: [{
          type: 'button', style: 'primary', color: '#1565C0', height: 'sm',
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

    // ─── Test Mode (if testVin, testMaintVin, testReturnVin or testReadyPickupVin is provided) ──
    const testVin = req.nextUrl.searchParams.get('testVin')
    const testMaintVin = req.nextUrl.searchParams.get('testMaintVin')
    const testReturnVin = req.nextUrl.searchParams.get('testReturnVin')
    const testReadyPickupVin = req.nextUrl.searchParams.get('testReadyPickupVin')

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
            i.StatusType AS CarSubStatusCode,
            ISNULL(NULLIF(u.FirstName, ''), u.UserName) AS CreatorName
          FROM dbo.EV_RentItem r
          LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
          LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
          LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
          LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
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
            m.CreateDate,
            m.IncidentDate,
            i.RegisterNo,
            i.Model,
            i.ProjectType,
            i.Status AS CarInventoryStatusCode,
            s.DescriptionStatus AS CarStatusName,
            sub.DescriptionStatus AS CarSubStatusName,
            i.StatusType AS CarSubStatusCode,
            ISNULL(NULLIF(u.FirstName, ''), u.UserName) AS CreatorName
          FROM dbo.EV_MaintenanceItem m
          LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
          LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
          LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
          LEFT JOIN dbo.EV_User u ON m.CreateUserID = u.UserID
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
            r.CreateDate,
            i.RegisterNo,
            i.ProjectType,
            i.Status AS CarInventoryStatusCode,
            s.DescriptionStatus AS CarStatusName,
            sub.DescriptionStatus AS CarSubStatusName,
            i.StatusType AS CarSubStatusCode,
            ISNULL(NULLIF(u.FirstName, ''), u.UserName) AS CreatorName
          FROM dbo.EV_ReturnItem r
          LEFT JOIN dbo.EV_RentItem rent ON r.RentItemID = rent.RentItemID
          LEFT JOIN dbo.EV_InventoryItem i ON i.VinNo = r.VinNo
          LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
          LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
          LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
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

    if (testReadyPickupVin) {
      const maintResult = await pool.request()
        .input('vin', sql.NVarChar, testReadyPickupVin)
        .query(`
          SELECT TOP 1
            m.MaintenanceItemID,
            m.VinNo,
            m.IssueTitle,
            m.CarStatusCode,
            m.ServiceLocationCode,
            m.ReportDate,
            m.CreateDate,
            m.IncidentDate,
            m.UpdateDate,
            m.MaintenanceFinishDate,
            i.RegisterNo,
            i.Model,
            i.ProjectType,
            i.Status AS CarInventoryStatusCode,
            s.DescriptionStatus AS CarStatusName,
            sub.DescriptionStatus AS CarSubStatusName,
            i.StatusType AS CarSubStatusCode,
            ISNULL(NULLIF(cu.FirstName, ''), cu.UserName) AS CreatorName,
            ISNULL(NULLIF(uu.FirstName, ''), uu.UserName) AS UpdaterName,
            m.CreateUserID AS CreateUserID,
            m.UpdateUserID AS UpdateUserID
          FROM dbo.EV_MaintenanceItem m
          LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
          LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
          LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
          LEFT JOIN dbo.EV_User cu ON m.CreateUserID = cu.UserID
          LEFT JOIN dbo.EV_User uu ON m.UpdateUserID = uu.UserID
          WHERE m.IsActive = 1
            AND (m.VinNo = @vin OR i.RegisterNo = @vin)
          ORDER BY m.MaintenanceItemID DESC
        `)
      
      const item = maintResult.recordset[0]
      if (!item) {
        return NextResponse.json({ error: `No maintenance record found for VIN/RegisterNo: ${testReadyPickupVin}` }, { status: 404 })
      }
      
      if (!item.UpdaterName || item.UpdaterName.trim() === '') {
        if (item.UpdateUserID) {
          const reg = await prisma.lineRegistration.findFirst({
            where: { ev7UserId: Number(item.UpdateUserID) }
          })
          if (reg?.displayName) {
            item.UpdaterName = reg.displayName
          }
        }
        if (!item.UpdaterName && item.CreateUserID) {
          const reg = await prisma.lineRegistration.findFirst({
            where: { ev7UserId: Number(item.CreateUserID) }
          })
          if (reg?.displayName) {
            item.UpdaterName = reg.displayName
          }
        }
      }
      item.UpdaterName = item.UpdaterName || item.CreatorName || '-'

      const flexMsg = buildReadyPickupFlex(item)
      let sentCount = 0
      for (const group of activeGroups) {
        if (!env.MOCK_MODE) {
          await lineClient.pushMessage({ to: group.groupId, messages: [flexMsg] })
        }
        sentCount++
      }
      return NextResponse.json({ success: true, message: `Test ready pickup alert sent for ${item.RegisterNo || item.VinNo}`, item, sentCount })
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
    const sentReadyPickup = await prisma.activityNotification.findMany({
      where: { recordType: 'READY_PICKUP' },
      select: { recordId: true },
    })

    const sentMaintIds = new Set(sentMaint.map(s => s.recordId))
    const sentDeliveryIds = new Set(sentDelivery.map(s => s.recordId))
    const sentReturnIds = new Set(sentReturn.map(s => s.recordId))
    const sentReadyPickupIds = new Set(sentReadyPickup.map(s => s.recordId))

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
          m.CreateDate,
          m.IncidentDate,
          i.RegisterNo,
          i.Model,
          i.ProjectType,
          i.Status AS CarInventoryStatusCode,
          s.DescriptionStatus AS CarStatusName,
          sub.DescriptionStatus AS CarSubStatusName,
          i.StatusType AS CarSubStatusCode,
          ISNULL(NULLIF(u.FirstName, ''), u.UserName) AS CreatorName
        FROM dbo.EV_MaintenanceItem m
        LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
        LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
        LEFT JOIN dbo.EV_User u ON m.CreateUserID = u.UserID
        WHERE m.IsActive = 1
          AND m.CreateDate >= @since
        ORDER BY m.CreateDate DESC
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
          i.StatusType AS CarSubStatusCode,
          ISNULL(NULLIF(u.FirstName, ''), u.UserName) AS CreatorName
        FROM dbo.EV_RentItem r
        LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
        LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
        LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
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
          r.CreateDate,
          i.RegisterNo,
          i.ProjectType,
          i.Status AS CarInventoryStatusCode,
          s.DescriptionStatus AS CarStatusName,
          sub.DescriptionStatus AS CarSubStatusName,
          i.StatusType AS CarSubStatusCode,
          ISNULL(NULLIF(u.FirstName, ''), u.UserName) AS CreatorName
        FROM dbo.EV_ReturnItem r
        LEFT JOIN dbo.EV_RentItem rent ON r.RentItemID = rent.RentItemID
        LEFT JOIN dbo.EV_InventoryItem i ON i.VinNo = r.VinNo
        LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
        LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
        LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
        WHERE r.IsActive = 1
          AND r.CreateDate >= @since
        ORDER BY r.CreateDate DESC
      `)

    const readyPickupQueryPromise = pool.request()
      .input('since', sql.DateTime, since)
      .query(`
        SELECT 
          m.MaintenanceItemID,
          m.VinNo,
          m.IssueTitle,
          m.CarStatusCode,
          m.ServiceLocationCode,
          m.ReportDate,
          m.CreateDate,
          m.IncidentDate,
          m.UpdateDate,
          m.MaintenanceFinishDate,
          i.RegisterNo,
          i.Model,
          i.ProjectType,
          i.Status AS CarInventoryStatusCode,
          s.DescriptionStatus AS CarStatusName,
          sub.DescriptionStatus AS CarSubStatusName,
          i.StatusType AS CarSubStatusCode,
          ISNULL(NULLIF(cu.FirstName, ''), cu.UserName) AS CreatorName,
          ISNULL(NULLIF(uu.FirstName, ''), uu.UserName) AS UpdaterName,
          m.CreateUserID AS CreateUserID,
          m.UpdateUserID AS UpdateUserID
        FROM dbo.EV_MaintenanceItem m
        LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
        LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
        LEFT JOIN dbo.EV_User cu ON m.CreateUserID = cu.UserID
        LEFT JOIN dbo.EV_User uu ON m.UpdateUserID = uu.UserID
        WHERE m.IsActive = 1
          AND m.CarStatusCode IN ('READY_PICKUP_MAINTENANCE', 'COMPLETE')
          AND m.UpdateDate >= @since
        ORDER BY m.UpdateDate DESC
      `)

    const [maintResult, deliveryResult, returnResult, readyPickupResult] = await Promise.all([
      maintQueryPromise,
      deliveryQueryPromise,
      returnQueryPromise,
      readyPickupQueryPromise
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
    const newReadyPickup = readyPickupResult.recordset.filter(
      (rp: any) => !sentReadyPickupIds.has(Number(rp.MaintenanceItemID))
    )

    // Fetch line registrations to resolve names for mock user IDs
    const registrations = await prisma.lineRegistration.findMany({
      select: { ev7UserId: true, displayName: true }
    })
    const regMap = new Map<number, string>()
    for (const reg of registrations) {
      if (reg.ev7UserId && reg.displayName) {
        regMap.set(Number(reg.ev7UserId), reg.displayName)
      }
    }

    // Map correct updater name for each ready pickup item
    for (const item of newReadyPickup) {
      if (!item.UpdaterName || item.UpdaterName.trim() === '') {
        if (item.UpdateUserID && regMap.has(Number(item.UpdateUserID))) {
          item.UpdaterName = regMap.get(Number(item.UpdateUserID))
        } else if (item.CreateUserID && regMap.has(Number(item.CreateUserID))) {
          item.UpdaterName = regMap.get(Number(item.CreateUserID))
        }
      }
      item.UpdaterName = item.UpdaterName || item.CreatorName || '-'
    }

    console.log(`[Activity] Found ${newMaint.length} new maintenance, ${newDelivery.length} new deliveries, ${newReturn.length} new returns, ${newReadyPickup.length} new ready pickups`)

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

    // Send ready pickup alerts (max 5 per poll)
    for (const item of newReadyPickup.slice(0, 5)) {
      const flexMsg = buildReadyPickupFlex(item)
      for (const group of activeGroups) {
        try {
          if (!env.MOCK_MODE) {
            await lineClient.pushMessage({ to: group.groupId, messages: [flexMsg] })
          }
          console.log(`[Activity] ✅ Ready pickup alert ${item.MaintenanceItemID} → ${group.groupName}`)
        } catch (err: any) {
          console.error(`[Activity] ❌ Ready pickup push failed:`, err.message)
        }
      }
      // Mark as sent (cast to number to match Prisma schema)
      await prisma.activityNotification.create({
        data: { recordType: 'READY_PICKUP', recordId: Number(item.MaintenanceItemID) },
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
      newReadyPickup: newReadyPickup.length,
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
