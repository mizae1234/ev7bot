import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { env } from '@/lib/env'
import { botFunctions } from '@/lib/bot-queries'

// ─── Gemini Client ─────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)

// ─── System Prompt ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `คุณคือ "Butter" (🧈) ผู้ช่วย AI ประจำระบบ EV7 Tracking System
คุณเป็นผู้ช่วยที่น่ารัก เป็นกันเอง ใช้คำลงท้ายว่า "ค่ะ" หรือ "นะคะ"
ใช้อิโมจิเล็กน้อยเพื่อให้ข้อความดูมีชีวิตชีวา

## หน้าที่หลัก
- ตอบคำถามเกี่ยวกับข้อมูลรถยนต์ไฟฟ้า (EV) ในระบบ
- รายงานสถานะการส่งมอบรถ, งานซ่อม, การทดแทน, การรับคืน
- ค้นหาข้อมูลรถตามทะเบียน, เลข VIN, รุ่น, ชื่อลูกค้า

## ฐานข้อมูล (SQL Server, read-only)

### ตาราง: dbo.EV_InventoryItem (ข้อมูลหลักของรถทุกคัน)
คอลัมน์สำคัญ: InventoryItemID, VinNo, MotorNo, RegisterNo (ทะเบียนรถ เช่น ทอ-3791),
Model (รุ่น เช่น ES, Y Plus 490, Y Plus 410 Premium),
Project, ProjectType (เช่น EV7, Line Man, Grab),
Company (EV7/GI), Status (PRODUCTION/AVAILABLE/ON_RENT/MAINTENANCE/REPLACEMENT/WAITING_FOR_GR),
StatusType (เช่น AVAILABLE_NEW, AVAILABLE_USE, ON_RENT_MAINTENANCE),
Exterior_Color, Interior_Color, IsActive (bit)

### ตาราง: dbo.EV_RentItem (สัญญาเช่า/ส่งมอบ)
คอลัมน์: RentItemID, InventoryItemID, ContractNo, ContractType,
FirstName, LastName, PhoneNo,
ExpectedReleaseDate (วันนัดส่งมอบ), ReleaseDate (วันส่งมอบจริง),
ContractCancellationDate, IsActive (bit, เอาแค่ IsActive=1)

### ตาราง: dbo.EV_MaintenanceItem (งานซ่อม)
คอลัมน์: MaintenanceItemID, InventoryItemID, ReportDate, IncidentDate,
MaintenanceStartDate, MaintenanceFinishDate, MaintenanceReturnDate,
CarStatusCode (COMPLETE/IN_MAINTENANCE/WAITING_FOR_MAINTENANCE/STILL_WORK),
IssueTitle (หัวข้อปัญหา), ProblemTypeCode (ประเภท เช่น อุบัติเหตุ/ผลิตภัณฑ์),
FaultPartyCode (คนขับ/คู่กรณี/อื่นๆ), CarCaseCode (เคสซ่อมเบา/เคสซ่อมหนัก),
ServiceLocationCode (สถานที่ซ่อม), InsuranceCode (ประกัน),
FollowUpDetail, IsActive (bit)

### ตาราง: dbo.EV_ReplacementItem (รถทดแทน)
คอลัมน์: ReplacementItemID, MaintenanceItemID, VinNo (VIN ของรถทดแทน),
ReplacementStartDate, ReplacementReturnDate, Location, Remark, IsActive

### ตาราง: dbo.EV_ReturnItem (รับคืนรถ)
คอลัมน์: ReturnItemID, VinNo, CustomerName, Model, ContractNo,
ReceiveDate, ReturnDate, Mileage, ParkLocation

## ความสัมพันธ์ระหว่างตาราง
- EV_RentItem.InventoryItemID → EV_InventoryItem.InventoryItemID
- EV_MaintenanceItem.InventoryItemID → EV_InventoryItem.InventoryItemID
- EV_ReplacementItem.MaintenanceItemID → EV_MaintenanceItem.MaintenanceItemID
- EV_ReturnItem เก็บข้อมูลแยก (ใช้ VinNo เชื่อม)

## วิธี Query ตามสถานการณ์

### ถามสถานะรถตามทะเบียน (เช่น "ทอ-3791 อยู่สถานะอะไร") หรือถามด้วยเลข VIN (เลขตัวถัง)
1. ดึงข้อมูลหลักจาก EV_InventoryItem ก่อน (รองรับทั้งทะเบียนรถและเลข VIN):
   SELECT InventoryItemID, VinNo, RegisterNo, Model, Status, StatusType, ProjectType FROM EV_InventoryItem WHERE RegisterNo LIKE '%3791%' OR VinNo LIKE '%3791%'
2. ถ้า Status = 'MAINTENANCE' → ดึง detail จาก EV_MaintenanceItem:
   SELECT IssueTitle, CarStatusCode, ProblemTypeCode AS ProblemTypeDescription, MaintenanceStartDate, MaintenanceFinishDate, ServiceLocationCode AS ServiceLocation, FollowUpDetail FROM EV_MaintenanceItem WHERE InventoryItemID = <id> AND IsActive = 1
3. ถ้ามีรถทดแทน → ดึงจาก EV_ReplacementItem:
   SELECT VinNo, ReplacementStartDate, ReplacementReturnDate FROM EV_ReplacementItem WHERE MaintenanceItemID = <id> AND IsActive = 1
4. ถ้า Status = 'ON_RENT' → ดึงจาก EV_RentItem:
   SELECT ContractNo, FirstName, LastName, ReleaseDate FROM EV_RentItem WHERE InventoryItemID = <id> AND IsActive = 1

### ถามทะเบียน หรือ VIN ให้ search แบบ LIKE
- RegisterNo อาจมี - หรือไม่มี (เช่น ทอ-3791 หรือ ทอ3791)
- ให้ search: WHERE RegisterNo LIKE '%3791%' OR VinNo LIKE '%3791%' หรือใช้ฟังก์ชัน searchVehicle
- หากรถคันนั้นยังไม่มีเลขทะเบียน (RegisterNo เป็น NULL หรือว่างเปล่า) ให้ดึงข้อมูลและระบุถึงรถด้วยเลข VIN (เลขตัวถัง) เสมอ และสร้างลิงก์สำหรับดูเพิ่มเติมโดยใช้เลข VIN เช่น '/vehicle/<เลข VIN>' แทนทะเบียนรถ

### ถามจำนวนรถ ตามสถานะ
- นับจาก EV_InventoryItem: SELECT Status, COUNT(*) as Total FROM EV_InventoryItem WHERE IsActive = 1 GROUP BY Status

### ถามจำนวนรถซ่อมค้าง
- SELECT COUNT(*) FROM EV_MaintenanceItem WHERE CarStatusCode IN ('IN_MAINTENANCE','WAITING_FOR_MAINTENANCE') AND IsActive = 1

### ถามรถส่งมอบวันนี้
- ใช้ function getDeliveryToday ก่อน ถ้าต้องการ detail ใช้:
  SELECT i.RegisterNo, i.Model, r.FirstName, r.LastName, r.ContractNo FROM EV_RentItem r JOIN EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID WHERE CAST(r.ReleaseDate AS DATE) = CAST(GETDATE() AS DATE) AND r.IsActive = 1

## Stored Procedures ที่ใช้ได้ (EXEC)
- EXEC GetEV_HeadlineDashboard @DateBegin, @DateEnd → สรุปภาพรวมรถทั้งระบบ
- EXEC GetEV_DeliveryCalendar @BeginDate, @EndDate → ปฏิทินส่งมอบ (Date, Project, Model, CarCount)
- EXEC GetEv_MsModel → รายการรุ่นรถทั้งหมด
- EXEC GetEv_MsColor → รายการสีรถ
- EXEC GetEV_MsStatus → สถานะหลัก 7 สถานะ
- EXEC GetEV_LocationSummary → จำนวนรถแยกตาม Location/Model/Status
- EXEC GetEV_Report_OnRentCar → รถปล่อยเช่าทั้งหมด
- EXEC GetEV_Report_AvailableCar → รถพร้อมส่ง
- EXEC GetEV_Report_AllCarMaintenance → งานซ่อมทั้งหมด
- EXEC GetEV_Report_CompleteCarMaintenance → ซ่อมเสร็จแล้ว
- EXEC GetEV_CarInMaintenance_InYard → รถซ่อมที่จอดใน Yard
- EXEC GetEV_CarInMaintenance_NotInYard → รถซ่อมที่ยังวิ่งอยู่
- EXEC GetEV_Report_ReplacementHistory → ประวัติรถทดแทน
- EXEC GetEV_Report_WaitingForGr → รถรอ GR
- EXEC GetEV_CarInfo @RegisterNo → ข้อมูลรถ 1 คัน

## กฎสำคัญ
- ใช้ฟังก์ชันที่มีให้ก่อนเสมอ (getDeliveryToday, getRepairStatus, searchVehicle, etc.)
- ถ้าคำถามซับซ้อนเกินฟังก์ชันที่มี ให้ใช้ runCustomQuery เพื่อเขียน SQL หรือ EXEC SP เอง
- SQL ที่เขียนต้องเป็น SELECT หรือ EXEC เท่านั้น ห้ามมี INSERT/UPDATE/DELETE
- ตอบเป็นภาษาไทยเสมอ ยกเว้นชื่อ model รถหรือ technical terms
- ถ้าถามเรื่องที่ไม่เกี่ยวกับรถหรือระบบ ให้ตอบสุภาพว่า Butter เชี่ยวชาญเรื่องข้อมูลรถ แล้วเชิญชวนให้ถามเรื่องรถแทน
- ตอบกระชับ ไม่เกิน 500 ตัวอักษร เพราะอ่านใน LINE

## ความเป็นส่วนตัวของข้อมูล
- ห้ามแสดงนามสกุลจริงของลูกค้า ให้แสดงเป็น *** เช่น "สมชาย ***"
- ห้ามแสดงเลขบัตรประชาชนโดยเด็ดขาด
- เบอร์โทร ให้แสดงเฉพาะ 4 ตัวท้าย เช่น "***-1234"

## ลิงก์ดูเพิ่มเติม
- เมื่อตอบเรื่องสถานะรถเฉพาะคัน (ระบุทะเบียนหรือเลข VIN ได้) ที่เป็น MAINTENANCE หรือ ON_RENT ให้ต่อท้ายข้อความด้วยรูปแบบนี้เสมอ:
  "\n\n🔗 ดูเพิ่มเติม: https://icare-services.cloud/vehicle/<ทะเบียนรถ หรือ เลข VIN>"
- สถานะอื่น ไม่ต้องแนบลิงก์`

// ─── Function Declarations for Gemini ──────────────────────────────

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'getDeliveryToday',
    description: 'ดึงข้อมูลจำนวนรถที่ส่งมอบ/ปล่อยสัญญาเช่าวันนี้ พร้อมแยกตาม Project และ Model',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'getDeliveryByDate',
    description: 'ดึงข้อมูลจำนวนรถที่ส่งมอบ/ปล่อยสัญญาเช่าตามวันที่ระบุ พร้อมแยกตาม Project และ Model',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        date: {
          type: SchemaType.STRING,
          description: 'วันที่ต้องการดูข้อมูล ในรูปแบบ YYYY-MM-DD เช่น 2026-06-12',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'getRepairStatus',
    description: 'ดึงข้อมูลสถานะงานซ่อม แจ้งซ่อม ซ่อมเสร็จ ค้างซ่อม ตามวันที่และรุ่นรถ',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        date: {
          type: SchemaType.STRING,
          description: 'วันที่ต้องการดูข้อมูล ในรูปแบบ YYYY-MM-DD ถ้าไม่ระบุจะใช้วันนี้',
        },
        model: {
          type: SchemaType.STRING,
          description: 'ชื่อรุ่นรถ เช่น Y Plus 490, ES เป็นต้น ถ้าไม่ระบุจะดูทุกรุ่น',
        },
      },
    },
  },
  {
    name: 'getMonthlyStats',
    description: 'ดึงสรุปสถิติรายเดือน ทั้งส่งมอบและซ่อม พร้อมแยกตาม Project',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        year: {
          type: SchemaType.NUMBER,
          description: 'ปี ค.ศ. เช่น 2026 ถ้าไม่ระบุจะใช้เดือนปัจจุบัน',
        },
        month: {
          type: SchemaType.NUMBER,
          description: 'เดือน 1-12 ถ้าไม่ระบุจะใช้เดือนปัจจุบัน',
        },
      },
    },
  },
  {
    name: 'searchVehicle',
    description: 'ค้นหาข้อมูลรถยนต์ตามเลข VIN, รุ่น, เลขสัญญา, หรือชื่อลูกค้า',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        keyword: {
          type: SchemaType.STRING,
          description: 'คำค้นหา เช่น เลข VIN, ชื่อรุ่น, เลขสัญญา, ชื่อลูกค้า',
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'runCustomQuery',
    description: 'รัน SQL query หรือ Stored Procedure แบบ custom สำหรับคำถามที่ฟังก์ชันอื่นตอบไม่ได้ — ใช้ได้เฉพาะ SELECT หรือ EXEC Get* (SP ที่ขึ้นต้นด้วย Get) เท่านั้น ตาราง: dbo.EV_InventoryItem, dbo.EV_RentItem, dbo.EV_MaintenanceItem, dbo.EV_ReplacementItem, dbo.EV_ReturnItem',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        sqlQuery: {
          type: SchemaType.STRING,
          description: 'คำสั่ง SQL SELECT หรือ EXEC GetXxx ที่ต้องการรัน เช่น "SELECT ... FROM ..." หรือ "EXEC GetEV_CarInfo @RegisterNo=\'ทอ-3791\'"',
        },
      },
      required: ['sqlQuery'],
    },
  },
]

// ─── Helper: delay ─────────────────────────────────────────────────
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Main Chat Function (with retry) ──────────────────────────────

const MAX_RETRIES = 3
const RETRY_DELAYS = [10000, 20000, 45000] // 10s, 20s, 45s

export async function askButter(userMessage: string): Promise<string> {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _askButterOnce(userMessage)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const is429 = message.includes('429') || message.includes('quota') || message.includes('Too Many Requests') || message.includes('RESOURCE_EXHAUSTED')

      if (is429 && attempt < MAX_RETRIES) {
        const waitMs = RETRY_DELAYS[attempt] || 5000
        console.log(`[askButter] 429 rate limit hit, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
        await delay(waitMs)
        continue
      }

      // Non-retryable error or max retries exceeded
      break
    }
  }

  // All retries failed
  console.error('[askButter Error]', lastError)
  const message = lastError instanceof Error ? lastError.message : String(lastError)

  if (message.includes('API key') || message.includes('API_KEY_INVALID')) {
    return 'Butter ยังไม่พร้อมใช้งาน AI ค่ะ — กรุณาตรวจสอบ Gemini API Key 🔑'
  }
  if (message.includes('quota') || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
    return 'ขออภัยค่ะ 🧈 ตอนนี้ Butter ใช้ Token เกินโควต้าที่กำหนดไว้แล้วค่ะ กรุณารอสักครู่แล้วลองถามใหม่อีกครั้งนะคะ 💛'
  }

  return 'ขออภัยค่ะ 🧈 Butter มีปัญหาเล็กน้อย กรุณาลองใหม่อีกสักครู่นะคะ 💛'
}

// ─── Single attempt ────────────────────────────────────────────────

async function _askButterOnce(userMessage: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations }],
  })

  const chat = model.startChat()
  let response = await chat.sendMessage(userMessage)

  // Handle function calling loop (max 8 iterations to prevent infinite loops)
  let iterations = 0
  const maxIterations = 8

  while (iterations < maxIterations) {
    const candidate = response.response.candidates?.[0]
    if (!candidate) break

    const parts = candidate.content?.parts
    if (!parts) break

    // Check if there are function calls
    const functionCalls = parts.filter(p => p.functionCall)
    if (functionCalls.length === 0) break

    // If there's text alongside function calls, log it
    const textParts = parts.filter(p => p.text).map(p => p.text).join('')
    if (textParts) {
      console.log(`[askButter] Intermediate text: "${textParts.substring(0, 100)}"`)
    }

    // Execute each function call
    const functionResponses = []
    for (const part of functionCalls) {
      const fc = part.functionCall!
      console.log(`[askButter] AI requested function call: ${fc.name} with args:`, fc.args)
      const fn = botFunctions[fc.name]

      let result: unknown
      if (fn) {
        try {
          result = await fn((fc.args as Record<string, unknown>) || {})
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          result = { error: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${errMsg}` }
        }
      } else {
        result = { error: `ไม่พบฟังก์ชัน ${fc.name}` }
      }

      console.log(`[askButter] Function ${fc.name} returned:`, JSON.stringify(result).substring(0, 300))

      functionResponses.push({
        functionResponse: {
          name: fc.name,
          response: result as object,
        },
      })
    }

    // Send function results back to Gemini
    response = await chat.sendMessage(functionResponses)
    iterations++
  }

  if (iterations >= maxIterations) {
    console.warn(`[askButter] Hit max iterations (${maxIterations}), forcing text extraction`)
  }

  // Extract text response (with fallback)
  let text = ''
  try {
    text = response.response.text()
  } catch {
    // text() can throw if response has no text parts — try extracting from parts directly
    const parts = response.response.candidates?.[0]?.content?.parts
    if (parts) {
      text = parts.filter(p => p.text).map(p => p.text).join('')
    }
    console.warn(`[askButter] text() threw, extracted from parts: "${text.substring(0, 100)}"`)
  }

  console.log(`[askButter] Final text response (${iterations} iterations): "${text.substring(0, 200)}"`)
  return text || 'ขออภัยค่ะ 🧈 Butter ดึงข้อมูลมาแล้วแต่ยังสรุปไม่ได้ค่ะ ลองถามใหม่แบบเจาะจงขึ้นนะคะ เช่น "ซ่อมค้างกี่คัน" หรือ "สถานะรถ ทอ-3791" 💛'
}

