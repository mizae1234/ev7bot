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
- รายงานสถานะการส่งมอบรถ (deliveries), งานซ่อม (repairs), การทดแทน (replacements), การรับคืน (returns)
- ค้นหาข้อมูลรถตามเลข VIN, รุ่น, ชื่อลูกค้า

## ฐานข้อมูลที่เข้าถึงได้ (SQL Server, read-only)
ตารางหลัก:
- dbo.EV_InventoryItem — ข้อมูลรถ (VinNo, Model, Project, ProjectType, Company)
- dbo.EV_RentItem — สัญญาเช่า/ส่งมอบ (ExpectedReleaseDate, ReleaseDate, IsActive, FirstName, LastName, PhoneNo, ContractNo)
- dbo.EV_MaintenanceItem — งานซ่อม (ReportDate, MaintenanceStartDate, MaintenanceFinishDate, CarStatusCode: COMPLETE/IN_MAINTENANCE/WAITING_FOR_MAINTENANCE/STILL_WORK, IssueTitle, IsActive)
- dbo.EV_ReplacementItem — รถทดแทน (ReplacementStartDate, ReplacementReturnDate, VinNo, Location)
- dbo.EV_ReturnItem — รับคืนรถ (ReceiveDate, ReturnDate, CustomerName, Model, VinNo, Mileage, ParkLocation)

## ความสัมพันธ์ระหว่างตาราง
- EV_RentItem.InventoryItemID → EV_InventoryItem.InventoryItemID
- EV_MaintenanceItem.InventoryItemID → EV_InventoryItem.InventoryItemID
- EV_ReplacementItem.MaintenanceItemID → EV_MaintenanceItem.MaintenanceItemID
- EV_ReturnItem เก็บข้อมูลแยก (ไม่มี FK เชื่อม)

## กฎสำคัญ
- ใช้ฟังก์ชันที่มีให้ก่อนเสมอ (getDeliveryToday, getRepairStatus, etc.)
- ถ้าคำถามซับซ้อนเกินฟังก์ชันที่มี ให้ใช้ runCustomQuery เพื่อเขียน SQL เอง
- SQL ที่เขียนต้องเป็น SELECT เท่านั้น ห้ามมี INSERT/UPDATE/DELETE
- ตอบเป็นภาษาไทยเสมอ ยกเว้นชื่อ model รถหรือ technical terms
- ถ้าถามเรื่องที่ไม่เกี่ยวกับรถหรือระบบ ให้ตอบสุภาพว่า Butter เชี่ยวชาญเรื่องข้อมูลรถ แล้วเชิญชวนให้ถามเรื่องรถแทน
- ตอบกระชับ ไม่เกิน 500 ตัวอักษร เพราะอ่านใน LINE
- วันที่ปัจจุบัน: ${new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })}`

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
    description: 'รัน SQL query แบบ custom สำหรับคำถามที่ฟังก์ชันอื่นตอบไม่ได้ — ใช้ได้เฉพาะ SELECT เท่านั้น ห้ามมี INSERT/UPDATE/DELETE/DROP ตารางที่ใช้ได้: dbo.EV_InventoryItem, dbo.EV_RentItem, dbo.EV_MaintenanceItem, dbo.EV_ReplacementItem, dbo.EV_ReturnItem',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        sqlQuery: {
          type: SchemaType.STRING,
          description: 'คำสั่ง SQL SELECT ที่ต้องการรัน ต้องขึ้นต้นด้วย SELECT เท่านั้น',
        },
      },
      required: ['sqlQuery'],
    },
  },
]

// ─── Main Chat Function ────────────────────────────────────────────

export async function askButter(userMessage: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations }],
    })

    const chat = model.startChat()
    let response = await chat.sendMessage(userMessage)

    // Handle function calling loop (max 5 iterations to prevent infinite loops)
    let iterations = 0
    const maxIterations = 5

    while (iterations < maxIterations) {
      const candidate = response.response.candidates?.[0]
      if (!candidate) break

      const parts = candidate.content?.parts
      if (!parts) break

      // Check if there are function calls
      const functionCalls = parts.filter(p => p.functionCall)
      if (functionCalls.length === 0) break

      // Execute each function call
      const functionResponses = []
      for (const part of functionCalls) {
        const fc = part.functionCall!
        const fn = botFunctions[fc.name]

        let result: unknown
        if (fn) {
          try {
            result = await fn((fc.args as Record<string, unknown>) || {})
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            result = { error: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${message}` }
          }
        } else {
          result = { error: `ไม่พบฟังก์ชัน ${fc.name}` }
        }

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

    // Extract text response
    const text = response.response.text()
    return text || 'Butter ไม่สามารถประมวลผลได้ในตอนนี้ค่ะ 🤔 ลองถามใหม่อีกทีนะคะ'
  } catch (error) {
    console.error('[askButter Error]', error)
    const message = error instanceof Error ? error.message : String(error)

    // Friendly error messages
    if (message.includes('API key')) {
      return 'Butter ยังไม่พร้อมใช้งาน AI ค่ะ — กรุณาตรวจสอบ Gemini API Key 🔑'
    }
    if (message.includes('quota') || message.includes('429')) {
      return 'Butter ถูกใช้งานเยอะมากค่ะ 😅 รอสักครู่แล้วลองใหม่นะคะ'
    }

    return `Butter เกิดข้อผิดพลาดค่ะ 😅 ลองใหม่อีกทีนะคะ`
  }
}
