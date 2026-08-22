---
name: gate-log-monitor
description: Complete architecture, database schema, and operational workflow for the Gate Log Monitor feature (security guard vehicle entry/exit tracking in LINE groups).
---

# Gate Log Monitor — Vehicle Entry & Exit Tracking Skill

## 1. ภาพรวมระบบ (System Overview)
ระบบ Gate Log Monitor ใช้สำหรับตรวจจับและบันทึกข้อมูลรถยนต์เข้า-ออกลานจอด/ศูนย์บริการ จากข้อความที่เจ้าหน้าที่รักษาความปลอดภัย (รปภ) พิมพ์รายงานในกลุ่ม LINE โดยทำงานแบบอัตโนมัติ (AI-powered parsing via Gemini 3.1 Flash Lite) และแสดงผลบนแดชบอร์ด `/gate-monitor`

---

## 2. โครงสร้างฐานข้อมูล (Database Schema)

### 2.1 ตาราง SQL Server: `dbo.EV_GateLog`
```sql
CREATE TABLE dbo.EV_GateLog (
  GateLogID INT IDENTITY(1,1) PRIMARY KEY,
  VehicleRef NVARCHAR(50) NULL,             -- ทะเบียนรถ (เช่น ทอ-4905 หรือ 'รถใหม่')
  VinNo NVARCHAR(50) NULL,                  -- เลขตัวถัง (VIN)
  CheckInTime DATETIME NULL,                -- เวลาที่รถเข้า
  CheckInCategory NVARCHAR(100) NULL,       -- หมวดหมู่งาน/เหตุผลตอนเข้า (เช่น เช็คระยะ, ส่งซ่อม, รถใหม่)
  CheckInMessage NVARCHAR(500) NULL,        -- ข้อความ LINE ต้นฉบับตอนเข้า
  CheckInByName NVARCHAR(100) NULL,         -- ชื่อ รปภ / ผู้บันทึกตอนเข้า
  CheckInByLineUserId NVARCHAR(100) NULL,   -- LINE User ID ผู้บันทึกเข้า
  CheckOutTime DATETIME NULL,               -- เวลาที่รถออก
  CheckOutCategory NVARCHAR(100) NULL,      -- หมวดหมู่งาน/เหตุผลตอนออก (เช่น ซ่อมเสร็จ, ส่งมอบ, ลูกค้ารับรถ)
  CheckOutMessage NVARCHAR(500) NULL,       -- ข้อความ LINE ต้นฉบับตอนออก
  CheckOutByName NVARCHAR(100) NULL,        -- ชื่อ รปภ / ผู้บันทึกตอนออก
  CheckOutByLineUserId NVARCHAR(100) NULL,  -- LINE User ID ผู้บันทึกออก
  QuantityIn INT NOT NULL DEFAULT 1,        -- จำนวนรถที่เข้า (สำหรับรถใหม่ไม่มีทะเบียน)
  QuantityOut INT NOT NULL DEFAULT 0,       -- จำนวนรถที่ออก (สำหรับรถใหม่ไม่มีทะเบียน)
  GroupId NVARCHAR(100) NULL,               -- รหัสกลุ่ม LINE
  Status NVARCHAR(20) NOT NULL DEFAULT 'IN',-- 'IN' (อยู่ในลาน), 'OUT' (ออกแล้ว), 'OUT_ONLY' (บันทึกออกโดยไม่พบเข้า), 'CANCELLED'
  Note NVARCHAR(500) NULL,
  CreateDate DATETIME NOT NULL DEFAULT GETDATE(),
  UpdateDate DATETIME NOT NULL DEFAULT GETDATE()
);
```

### 2.2 ตาราง PostgreSQL (Prisma): `LineGroup`
- ฟิลด์ `enableGateLog` (`Boolean`, default: `false`) ในตาราง `line_groups` ใช้สำหรับควบคุมการเปิด/ปิดระบบแยกรายกลุ่ม LINE

---

## 3. ลำดับขั้นตอนการทำงาน (Flow Logic)

### 3.1 การเปิด/ปิดการใช้งานในกลุ่ม LINE
- เปิด: พิมพ์ `butter เปิดบันทึกเข้าออก` (ตั้งค่า `enableGateLog = true`)
- ปิด: พิมพ์ `butter ปิดบันทึกเข้าออก` (ตั้งค่า `enableGateLog = false`)

### 3.2 กฎความเงียบในกลุ่ม Gate Log (Silence Rule)
- เมื่อกลุ่ม LINE เปิด `enableGateLog = true`: บอท Butter จะ**ไม่ตอบ**ข้อความถามตอบทั่วไป ไม่ตอบ Quick Menu หรือคำสั่งใดๆ เพื่อไม่ให้รบกวนการทำงานของ รปภ
- บอทจะทำการส่งข้อความตอบกลับเฉพาะกรณี:
  1. การบันทึกรถเข้า/ออก สำเร็จ (`✅ บันทึกเข้า: ...` / `✅ บันทึกออก: ...`)
  2. คำสั่งเปิด/ปิดระบบ

### 3.3 การจัดการทะเบียนรถ (Plate Normalization)
- เลขทะเบียนรถทุกรูปแบบ เช่น `ทอ 4905`, `ทอ4905`, `ทอ-4905` จะถูกจัดฟอร์แมตอัตโนมัติเป็น `ทอ-4905` (มีขีดกลาง ไม่มีช่องว่าง) เสมอก่อนบันทึกลง Database
- ในการ Query ค้นหาข้อมูล จะทำการตัดช่องว่างและขีดออกด้วย เพื่อความแม่นยำ 100%

### 3.4 การจัดการรถใหม่ที่ไม่มีทะเบียน (Batch & FIFO)
- เมื่อ รปภ รายงาน เช่น `รถใหม่เข้า 7 คัน`:
  - บันทึกเป็น 1 เรคคอร์ด `VehicleRef = 'รถใหม่'` โดยกำหนด `QuantityIn = 7`, `QuantityOut = 0`, `Status = 'IN'`
- เมื่อ รปภ รายงาน เช่น `รถใหม่ออก 3 คัน`:
  - ค้นหาเรคคอร์ดเข้าที่เก่าสุด (`ORDER BY CreateDate ASC`) ที่ยังมีรถอยู่ในลาน (`QuantityOut < QuantityIn`)
  - อัปเดต `QuantityOut = QuantityOut + 3`
  - หาก `QuantityOut >= QuantityIn` ปรับสถานะเป็น `Status = 'OUT'`
  - หากยังเหลือรถในลาน จะคงสถานะ `Status = 'IN'` และคำนวณจำนวนคงเหลือแสดงใน LINE
  - หากไม่มีเรคคอร์ดเข้ามาก่อน จะสร้างเรคคอร์ด `Status = 'OUT_ONLY'`

---

## 4. ไฟล์ที่เกี่ยวข้องในระบบ (File Structure)

- **AI Parsing**: [gemini.ts](file:///Users/kanittamac/web/ev7dashboard/lib/gemini.ts) (`analyzeGateMessage` ใช้โมเดล `gemini-3.1-flash-lite`)
- **LINE Webhook**: [route.ts](file:///Users/kanittamac/web/ev7dashboard/app/api/line/webhook/route.ts)
- **API Endpoint**: [route.ts](file:///Users/kanittamac/web/ev7dashboard/app/api/gate-logs/route.ts)
- **Dashboard UI**: [page.tsx](file:///Users/kanittamac/web/ev7dashboard/app/gate-monitor/page.tsx)
- **Prisma Schema**: [schema.prisma](file:///Users/kanittamac/web/ev7dashboard/prisma/schema.prisma)
