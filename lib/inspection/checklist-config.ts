// =====================================================
// Vehicle Inspection Checklist — Template Configuration
// =====================================================
// Data-driven checklist template — ถ้าต้องการเพิ่ม/แก้ไขหัวข้อ
// แก้ที่ไฟล์นี้ไฟล์เดียว ไม่ต้องไปแก้ UI/API
// =====================================================

import type { ChecklistSectionDef } from './types'

// ---- Shared option sets ----

const BOOLEAN_OPTIONS = [
  { value: 'YES', label: 'มี' },
  { value: 'NO', label: 'ไม่มี' },
]

const BODY_CONDITION_OPTIONS = [
  { value: 'NORMAL', label: 'ปกติ' },
  { value: 'SCRATCH', label: 'มีรอยเฉี่ยว/ขีดข่วน' },
  { value: 'DENT', label: 'บุบ-แตก' },
]

const TIRE_CONDITION_OPTIONS = [
  { value: 'NORMAL', label: 'ปกติ' },
  { value: 'SCRATCH', label: 'ชำรุด' },
  { value: 'DENT', label: 'ต้องเปลี่ยน' },
]

const UNDERBODY_CONDITION_OPTIONS = [
  { value: 'NORMAL', label: 'ปกติ' },
  { value: 'SCRATCH', label: 'มีรอยครูด' },
  { value: 'DENT', label: 'มีความเสียหาย' },
]

const LICENSE_PLATE_OPTIONS = [
  { value: 'FRONT_BACK', label: 'ป้ายทะเบียนหน้า-หลัง' },
  { value: 'FRONT_ONLY', label: 'ป้ายทะเบียนหน้า' },
  { value: 'BACK_ONLY', label: 'ป้ายทะเบียนหลัง' },
  { value: 'NONE', label: 'ไม่มีป้ายทะเบียนรถมา' },
]

const AIR_CON_OPTIONS = [
  { value: 'YES', label: 'ปกติ' },
  { value: 'NO', label: 'ไม่ปกติ' },
]

const CLAIM_COMPLETE_OPTIONS = [
  { value: 'YES', label: 'ครบ' },
  { value: 'NO', label: 'ไม่ครบ' },
]

// ---- Checklist Sections ----

export const CHECKLIST_SECTIONS: ChecklistSectionDef[] = [
  {
    category: 'LICENSE_PLATE',
    label: 'ป้ายทะเบียนรถ',
    icon: '🪪',
    items: [
      {
        category: 'LICENSE_PLATE',
        itemCode: 'STATUS',
        label: 'สถานะป้ายทะเบียน',
        inputType: 'select',
        options: LICENSE_PLATE_OPTIONS,
        hasPhoto: true,
      },
    ],
  },
  {
    category: 'ROAD_TAX',
    label: 'ป้ายทะเบียนเล็ก',
    icon: '📋',
    items: [
      {
        category: 'ROAD_TAX',
        itemCode: 'STATUS',
        label: 'มีป้ายทะเบียนเล็ก',
        inputType: 'boolean',
        options: BOOLEAN_OPTIONS,
        hasPhoto: true,
      },
    ],
  },
  {
    category: 'TAX_VEHICLE',
    label: 'ภาษีรถ',
    icon: '📄',
    items: [
      {
        category: 'TAX_VEHICLE',
        itemCode: 'STATUS',
        label: 'มีภาษี',
        inputType: 'boolean_expiry',
        options: BOOLEAN_OPTIONS,
        hasExpiry: true,
        hasPhoto: true,
      },
    ],
  },
  {
    category: 'TAX_METER',
    label: 'ภาษีมิเตอร์',
    icon: '📄',
    items: [
      {
        category: 'TAX_METER',
        itemCode: 'STATUS',
        label: 'มีภาษีมิเตอร์',
        inputType: 'boolean_expiry',
        options: BOOLEAN_OPTIONS,
        hasExpiry: true,
        hasPhoto: true,
      },
    ],
  },
  {
    category: 'KEY_REMOTE',
    label: 'จำนวนกุญแจรีโมทที่คืน',
    icon: '🔑',
    items: [
      {
        category: 'KEY_REMOTE',
        itemCode: 'COUNT',
        label: 'จำนวนกุญแจ (ดอก)',
        inputType: 'number',
        hasPhoto: true,
      },
    ],
  },
  {
    category: 'CONDITION',
    label: 'ตรวจสภาพรถ',
    icon: '🔍',
    items: [
      {
        category: 'CONDITION',
        itemCode: 'METER',
        label: 'มิเตอร์',
        inputType: 'boolean',
        options: BOOLEAN_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'CONDITION',
        itemCode: 'FOG_LIGHT',
        label: 'ไฟวาง',
        inputType: 'boolean',
        options: BOOLEAN_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'CONDITION',
        itemCode: 'SPARE_TIRE',
        label: 'ยางอะไหล่',
        inputType: 'boolean',
        options: BOOLEAN_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'CONDITION',
        itemCode: 'HEAD_LIGHT',
        label: 'โป๊ะไฟ',
        inputType: 'boolean',
        options: BOOLEAN_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'CONDITION',
        itemCode: 'STICKER',
        label: 'สติ๊กเกอร์รอบคัน',
        inputType: 'boolean',
        options: BOOLEAN_OPTIONS,
        hasPhoto: true,
      },
    ],
  },
  {
    category: 'BODY',
    label: 'สภาพตัวถัง',
    icon: '🚗',
    items: [
      {
        category: 'BODY',
        itemCode: 'DOOR',
        label: 'ประตู',
        inputType: 'three_way',
        options: BODY_CONDITION_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'BODY',
        itemCode: 'HOOD_FRONT',
        label: 'กระโปรงหน้า',
        inputType: 'three_way',
        options: BODY_CONDITION_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'BODY',
        itemCode: 'BUMPER_FRONT',
        label: 'กันชนหน้า',
        inputType: 'three_way',
        options: BODY_CONDITION_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'BODY',
        itemCode: 'HOOD_REAR',
        label: 'กระโปรงหลัง',
        inputType: 'three_way',
        options: BODY_CONDITION_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'BODY',
        itemCode: 'BUMPER_REAR',
        label: 'กันชนหลัง',
        inputType: 'three_way',
        options: BODY_CONDITION_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'BODY',
        itemCode: 'INTERIOR',
        label: 'ภายในห้องโดยสาร',
        inputType: 'three_way',
        options: BODY_CONDITION_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'BODY',
        itemCode: 'TIRE',
        label: 'สภาพยางรถ',
        inputType: 'three_way',
        options: TIRE_CONDITION_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'BODY',
        itemCode: 'UNDERBODY',
        label: 'สภาพใต้ท้องรถ',
        inputType: 'three_way',
        options: UNDERBODY_CONDITION_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'BODY',
        itemCode: 'WHEEL_RIM',
        label: 'สภาพล้อแม็ก',
        inputType: 'three_way',
        options: BODY_CONDITION_OPTIONS,
        hasPhoto: true,
      },
      {
        category: 'BODY',
        itemCode: 'WINDOW_FILM',
        label: 'ฟิล์มกรองแสง',
        inputType: 'boolean',
        options: AIR_CON_OPTIONS,
        hasPhoto: true,
      },
    ],
  },
  {
    category: 'AIR_CON',
    label: 'แอร์',
    icon: '❄️',
    items: [
      {
        category: 'AIR_CON',
        itemCode: 'STATUS',
        label: 'แอร์ทำงานปกติ',
        inputType: 'boolean',
        options: AIR_CON_OPTIONS,
        hasPhoto: false,
      },
    ],
  },
  {
    category: 'BATTERY_HV',
    label: 'แบต 12 volt',
    icon: '🔋',
    items: [
      {
        category: 'BATTERY_HV',
        itemCode: 'LEVEL',
        label: 'แบต 12 volt (%)',
        inputType: 'number',
        hasPhoto: true,
      },
    ],
  },
  {
    category: 'CAR_PHOTOS',
    label: 'รูปรถรอบคัน',
    icon: '📸',
    items: [
      {
        category: 'CAR_PHOTOS',
        itemCode: 'AROUND',
        label: 'ถ่ายรูป 4 ด้าน',
        inputType: 'photos_only',
        hasPhoto: true,
        photoPositions: ['FRONT', 'BACK', 'LEFT', 'RIGHT'],
      },
    ],
  },
  {
    category: 'ACCIDENT',
    label: 'รอยอุบัติเหตุ',
    icon: '⚠️',
    items: [
      {
        category: 'ACCIDENT',
        itemCode: 'PHOTOS',
        label: 'มีรอยอุบัติเหตุหรือไม่?',
        inputType: 'boolean',
        options: BOOLEAN_OPTIONS,
        hasPhoto: true,
      },
    ],
  },
  {
    category: 'CLAIM_DOCS',
    label: 'ใบเคลม',
    icon: '📑',
    items: [
      {
        category: 'CLAIM_DOCS',
        itemCode: 'COUNT',
        label: 'จำนวนใบเคลม (ใบ)',
        inputType: 'number',
        hasPhoto: true,
      },
      {
        category: 'CLAIM_DOCS',
        itemCode: 'COMPLETE',
        label: 'ใบเคลมครบ',
        inputType: 'boolean',
        options: CLAIM_COMPLETE_OPTIONS,
        hasPhoto: false,
      },
    ],
  },
  {
    category: 'MILEAGE',
    label: 'เลขไมล์',
    icon: '🔢',
    items: [
      {
        category: 'MILEAGE',
        itemCode: 'VALUE',
        label: 'เลขไมล์ปัจจุบัน',
        inputType: 'number',
        hasPhoto: true,
      },
    ],
  },
]

// ---- Helper: สร้าง default empty items จาก template ----

export function createEmptyItemsFromTemplate(): import('./types').InspectionItemData[] {
  return CHECKLIST_SECTIONS.flatMap(section =>
    section.items.map(item => ({
      category: item.category,
      itemCode: item.itemCode,
      value: null,
      detail: null,
      numericValue: null,
      expiryDate: null,
    }))
  )
}

// ---- Helper: label lookup ----

const PHOTO_POSITION_LABELS: Record<string, string> = {
  FRONT: 'ด้านหน้า',
  BACK: 'ด้านหลัง',
  LEFT: 'ด้านซ้าย',
  RIGHT: 'ด้านขวา',
}

export function getPhotoPositionLabel(position: string): string {
  return PHOTO_POSITION_LABELS[position] || position
}

/** ค้นหา label ของ value จาก options */
export function getValueLabel(category: string, itemCode: string, value: string | null): string {
  if (!value) return '—'
  for (const section of CHECKLIST_SECTIONS) {
    if (section.category !== category) continue
    for (const item of section.items) {
      if (item.itemCode !== itemCode) continue
      const opt = item.options?.find(o => o.value === value)
      return opt?.label || value
    }
  }
  return value
}

export interface MasterItemDef {
  Category: string
  ItemCode: string
  Label: string
  InputType: string
  SortOrder: number
}

export function buildDynamicSections(masterItems: MasterItemDef[]): ChecklistSectionDef[] {
  if (!masterItems || masterItems.length === 0) return []

  const sectionsMap = new Map<string, ChecklistSectionDef>()

  for (const master of masterItems) {
    const staticSection = CHECKLIST_SECTIONS.find(s => s.category === master.Category)
    const staticItem = staticSection?.items.find(i => i.itemCode === master.ItemCode)

    if (!sectionsMap.has(master.Category)) {
      sectionsMap.set(master.Category, {
        category: master.Category,
        label: staticSection?.label || master.Category,
        icon: staticSection?.icon || '🔍',
        items: []
      })
    }

    const section = sectionsMap.get(master.Category)!
    section.items.push({
      category: master.Category,
      itemCode: master.ItemCode,
      label: master.Label || staticItem?.label || master.ItemCode,
      inputType: (master.InputType as any) || staticItem?.inputType || 'boolean',
      options: staticItem?.options || (master.InputType === 'select' ? LICENSE_PLATE_OPTIONS : BOOLEAN_OPTIONS),
      hasPhoto: staticItem?.hasPhoto ?? true,
      hasExpiry: staticItem?.hasExpiry,
      photoPositions: staticItem?.photoPositions,
    })
  }

  return Array.from(sectionsMap.values())
}

export function createEmptyItemsFromMaster(masterItems: MasterItemDef[]): import('./types').InspectionItemData[] {
  return masterItems.map(item => ({
    category: item.Category,
    itemCode: item.ItemCode,
    value: null,
    detail: null,
    numericValue: null,
    expiryDate: null,
  }))
}

export type ItemResolveStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'NO_ACTION_NEEDED'

export const RESOLVE_STATUS_CONFIG: Record<ItemResolveStatus, {
  label: string
  icon: string
  badgeClass: string
  dotClass: string
  description: string
}> = {
  PENDING: {
    label: 'รอจัดการ',
    icon: '🔴',
    badgeClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dotClass: 'bg-rose-500',
    description: 'ตรวจพบความเสียหาย รอเปิดงานซ่อมหรือแก้ไข',
  },
  IN_PROGRESS: {
    label: 'เปิดงานซ่อมแล้ว',
    icon: '🟡',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dotClass: 'bg-amber-500',
    description: 'เปิดงานซ่อม/ส่งเรื่องไปยังศูนย์บริการหรือช่างแล้ว',
  },
  RESOLVED: {
    label: 'แก้ไขแล้ว',
    icon: '🟢',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
    description: 'ซ่อมแซม/เปลี่ยนอะไหล่/ติดป้ายภาษีเรียบร้อยแล้ว',
  },
  NO_ACTION_NEEDED: {
    label: 'ไม่ต้องทำ / ยอมรับสภาพ',
    icon: '⚪',
    badgeClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    dotClass: 'bg-zinc-400',
    description: 'พิจารณาแล้วว่ารอยเล็กน้อย/สภาพรับได้ ปล่อยวิ่งต่อได้',
  }
}

export interface FormattedDamagedItem {
  inspectionItemId?: number | null
  category: string
  categoryLabel: string
  categoryIcon: string
  itemCode: string
  label: string
  value: string
  valueLabel: string
  detail?: string | null
  resolveStatus?: ItemResolveStatus | null
  resolveRemark?: string | null
  resolveDate?: string | null
  resolveUserName?: string | null
}

export function parseDamagedItems(rawItemsJsonOrArray: string | any[] | null | undefined): FormattedDamagedItem[] {
  if (!rawItemsJsonOrArray) return []
  let items: any[] = []
  if (typeof rawItemsJsonOrArray === 'string') {
    try {
      items = JSON.parse(rawItemsJsonOrArray)
    } catch {
      return []
    }
  } else if (Array.isArray(rawItemsJsonOrArray)) {
    items = rawItemsJsonOrArray
  }
  if (!Array.isArray(items)) return []

  const result: FormattedDamagedItem[] = []

  for (const it of items) {
    const category = it.category || it.Category
    const itemCode = it.itemCode || it.ItemCode
    const value = it.value || it.Value
    const detail = it.detail || it.Detail || null
    const inspectionItemId = it.inspectionItemId || it.InspectionItemID || null
    const resolveStatus = (it.resolveStatus || it.ResolveStatus || 'PENDING') as ItemResolveStatus
    const resolveRemark = it.resolveRemark || it.ResolveRemark || null
    const resolveDate = it.resolveDate || it.ResolveDate || null
    const resolveUserName = it.resolveUserName || it.ResolveUserName || null

    if (!category || !itemCode || !value) continue

    const section = CHECKLIST_SECTIONS.find(s => s.category === category)
    const itemDef = section?.items.find(i => i.itemCode === itemCode)

    let isDamaged = false
    let valueLabel = value

    if (category === 'ACCIDENT') {
      if (value === 'YES') {
        isDamaged = true
        valueLabel = 'พบร่องรอย/ประวัติอุบัติเหตุ'
      }
    } else if (category === 'CAR_PHOTOS') {
      // Photos only
    } else if (itemDef?.inputType === 'three_way') {
      if (value === 'DENT') {
        isDamaged = true
        valueLabel = 'บุบ-แตก / เสียหาย'
      } else if (value === 'SCRATCH') {
        isDamaged = true
        valueLabel = 'มีรอยขีดข่วน / ชำรุด'
      }
    } else if (itemDef?.inputType === 'select') {
      if (value === 'NONE') {
        isDamaged = true
        valueLabel = 'ไม่มีป้ายทะเบียนรถ'
      } else if (value === 'FRONT_ONLY') {
        isDamaged = true
        valueLabel = 'มีเฉพาะป้ายหน้า (ป้ายหลังหาย)'
      } else if (value === 'BACK_ONLY') {
        isDamaged = true
        valueLabel = 'มีเฉพาะป้ายหลัง (ป้ายหน้าหาย)'
      }
    } else if (itemDef?.inputType === 'boolean' || itemDef?.inputType === 'boolean_expiry') {
      if (value === 'NO') {
        isDamaged = true
        valueLabel = 'ไม่มี / ชำรุดไม่ปกติ'
      }
    }

    if (isDamaged) {
      result.push({
        inspectionItemId,
        category,
        categoryLabel: section?.label || category,
        categoryIcon: section?.icon || '🔍',
        itemCode,
        label: itemDef?.label || itemCode,
        value,
        valueLabel,
        detail,
        resolveStatus,
        resolveRemark,
        resolveDate,
        resolveUserName,
      })
    }
  }

  return result
}
