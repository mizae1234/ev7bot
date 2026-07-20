import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '@/lib/env'

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { base64Image } = await request.json()
    if (!base64Image) {
      return NextResponse.json({ error: 'Missing base64Image' }, { status: 400 })
    }

    // Clean base64 prefix if exists
    const base64Data = base64Image.includes(';base64,')
      ? base64Image.split(';base64,')[1]
      : base64Image

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
      คุณเป็นระบบ OCR สำหรับตรวจจับเลขตัวถังรถ (VIN หรือ Chassis Number) และทะเบียนรถยนต์ไฟฟ้า
      1. ค้นหาเลข VIN ในภาพ (ขึ้นต้นด้วยตัวภาษาอังกฤษยาวประมาณ 17 หลัก เช่น LNADHAB31S6000894) หรือป้ายทะเบียนรถที่สแกนเจอ
      2. หากเจอให้ส่งคำตอบกลับเป็น "เลข VIN หรือป้ายทะเบียนตัวพิมพ์ใหญ่นั้นเพียงอย่างเดียวเท่านั้น" โดยห้ามมีอธิบาย ห้ามเว้นวรรค ห้ามมีเครื่องหมาย * หรือคำอื่นผสม เช่น "LNADHAB31S6000894" หรือ "ทอ-8539"
      3. หากไม่สามารถอ่านข้อมูลที่ระบุรถยนต์ได้เลย ให้ส่งคำตอบกลับว่า "NOT_FOUND" เท่านั้น
    `

    const response = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg'
        }
      }
    ])

    let resultText = response.response.text().trim()
    
    // Clean markdown code blocks, backticks, quotes, and all whitespaces
    resultText = resultText
      .replace(/```[a-zA-Z]*\n?/g, '') // Remove markdown code blocks
      .replace(/`/g, '')               // Remove backticks
      .replace(/["']/g, '')            // Remove quotes
      .replace(/\s+/g, '')             // Remove all spaces/newlines
      .trim()

    return NextResponse.json({ result: resultText })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('OCR API Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
