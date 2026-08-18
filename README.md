# EV7 Operations Dashboard & Fleet Tracking System

ระบบแดชบอร์ดบริหารจัดการข้อมูลยานยนต์ไฟฟ้า (EV Fleet Management), ติดตามงานซ่อม, ส่งมอบและรับคืนรถ, รถทดแทน, กรมธรรม์ประกันภัย-ภาษี, ประวัติการยึดรถ และประวัติการเคลื่อนย้ายรถยนต์

---

## 🌟 ฟีเจอร์หลักของระบบ (Core Features)

### 1. 📊 แดชบอร์ดภาพรวม (`/dashboard`)
- ติดตาม KPI สถิติรถในระบบ: รถพร้อมใช้, ปล่อยเช่า (On Rent), อยู่ระหว่างซ่อม, และอยู่ในสายการผลิต
- ตารางสรุปภาพรวมแยกตามรุ่น และ สถานที่จอดรถ (Yard / Showroom / Hub)
- กราฟแนวโน้มและการปล่อยรถประจำวัน/เดือน

### 2. 🚗🔄 ระบบบริหารรถทดแทน (`/replacements`)
- คลังรถทดแทนที่พร้อมใช้งาน (Available Replacement Cars)
- ติดตามรถทดแทนที่กำลังถูกใช้งาน และประวัติการคืนรถทดแทน
- โควตาจองรถทดแทน และการควบคุมสถานะ `REPLACEMENT_AVAILABLE` / `REPLACEMENT_CAR`

### 3. 🔧 ศูนย์บริหารงานซ่อม & ศูนย์ดูแลรถ (`/maintenance`, `/vehicle-custody`)
- บันทึกและติดตามสถานะงานซ่อม (Maintenance Work Orders & Follow-ups)
- ติดตามรถที่ฝากดูแล / รอซ่อม / ซ่อมภายนอก
- บันทึกงานซ่อมด่วนและตรวจเช็คผ่าน LINE LIFF Quick Report

### 4. 🛡️ ประกันภัย พ.ร.บ. และภาษีรถยนต์ (`/policies`)
- ติดตามวันหมดอายุประกันภัยภาคสมัครใจ (DV1, DV2, DV3, DV5), พ.ร.บ. (DAC), ภาษีรถประจำปี และภาษีมิเตอร์
- ตรวจสอบ Audit Log และไฟล์แนบกรมธรรม์ย้อนหลัง

### 5. 📍 ประวัติการเคลื่อนย้ายสถานที่ / เปลี่ยนพิกัดรถ (`/vehicle-movement`)
- รวบรวมประวัติการย้ายสถานที่จอดรถ (Location Relocation) ทั้งหมด
- แสดงผลเส้นทาง: **สถานที่ต้นทาง (From Location) ➔ สถานที่ปลายทาง (To Location)**
- บันทึกผู้ดำเนินการย้าย, วันที่-เวลา, และส่งออกรายงาน Excel
- มี SQL View (`dbo.View_VehicleLocationLog`) สำหรับ Bot Butter AI ค้นหาประวัติการย้ายรถได้ทันที

### 6. 🚨 ประวัติการยึดคืนรถยนต์ (`/vehicle-repossess`)
- ติดตามประวัติการลงพื้นที่ยึดคืนรถยนต์เข้าสู่ระบบ
- ค้นหาตามทะเบียน, VIN, เลขสัญญา, สถานที่ยึด, และผู้ทำรายการ

### 7. 📝 บันทึกหมายเหตุประจำรถ & ไทม์ไลน์ (`/vehicle-notes`, `/vehicle/[registerNo]`)
- หน้ารายละเอียดรถรายคัน (Vehicle Detail 360°)
- Vehicle Timeline: รวบรวมประวัติสัญญาเช่า, งานซ่อม, รถทดแทน, การตรวจสภาพ, และโน้ตประจำรถแบบ Compact
- Vehicle Chat Log: บันทึกและสนทนาโน้ตประจำคันรถได้แบบ Real-time
- นโยบาย Data Privacy: ปิดบังนามสกุล แสดงเฉพาะชื่อต้น

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend / Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, Vanilla CSS Custom Variables, Heroicons / Emoji Icons
- **Database**: Microsoft SQL Server (MSSQL), PostgreSQL (Prisma ORM for Tasks/Registrations)
- **AI Integration**: Google Gemini 2.5 Flash (Bot Butter AI Assistant)
- **Deployment**: Git Push to `origin/main`

---

## ⚙️ กฎและข้อควรระวังสำคัญ (Engineering Rules)

1. **TIMEZONE (Bangkok UTC)**:
   - ข้อมูลวันและเวลาที่บันทึกใน SQL Server ถูกบันทึกเป็นเวลาประเทศไทย (Bangkok Time) โดยตรง
   - เมื่อแสดงผลบนหน้าบ้าน ต้องจัดรูปแบบเวลาด้วย `timeZone: 'UTC'` หรือใช้ฟังก์ชันดึงค่า UTC (`getUTCDate()`, `getUTCHours()`) เท่านั้น เพื่อป้องกันปัญหา Double Offset (+7 ชั่วโมง)
2. **DATA PRIVACY**:
   - การแสดงผลชื่อบุคคล (พนักงาน, ผู้ตรวจ, คนขับ, ลูกค้า) ต้องผ่านการ Masking แสดงเฉพาะชื่อต้นเท่านั้น (ไม่แสดงนามสกุล)
3. **DATABASE SAFETY**:
   - ห้ามรันสคริปต์แก้ไข/ลบข้อมูลจริงผ่าน CLI ทุกการทดสอบต้องทำผ่าน UI โดยผู้ใช้จริงเท่านั้น
4. **DEPLOYMENT**:
   - การ Deploy ทำผ่านการรัน `git push origin main` เมื่อได้รับคำสั่งชัดเจนเท่านั้น

---

## 🚀 เริ่มต้นใช้งานในเครื่อง (Local Development)

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. รันโหมด Development Server
npm run dev

# 3. ตรวจสอบ Type Checking
npx tsc --noEmit
```

เปิดเว็บเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)
