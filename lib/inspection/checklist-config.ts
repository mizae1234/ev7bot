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
  { value: 'YES', label: 'ใช่' },
  { value: 'NO', label: 'ไม่ใช่' },
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
    label: 'ปริมาณแบต High Volt',
    icon: '🔋',
    items: [
      {
        category: 'BATTERY_HV',
        itemCode: 'LEVEL',
        label: 'ปริมาณแบต (%)',
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
