# EV7 Vehicle Return Process & Business Logic (Quick Report LIFF)

เอกสารนี้รวบรวมตารางฐานข้อมูลและลำดับการทำงาน (Business Logic Flows) ของระบบบันทึกตรวจสภาพคืนรถ (Vehicle Return Inspection) บนแอปพลิเคชัน LINE LIFF

---

## 1. การเปลี่ยนแปลงของฐานข้อมูล (Database Schema)

### ตารางหลัก: `dbo.EV_Inspection`
ใช้เก็บหัวกระดาษและข้อมูลทั่วไปของการตรวจเช็คสภาพคืนรถ
* **ฟิลด์ที่เกี่ยวข้อง:**
  * `CustomerName` (NVARCHAR(250)) - ชื่อลูกค้าผู้นำรถมาคืน (รองรับค่าเริ่มต้นจากสัญญาเช่า และสามารถแก้ไขได้)
  * `CustomerContact` (VARCHAR(100)) - เบอร์โทรศัพท์ติดต่อของลูกค้าผู้นำรถมาคืน (กรองเฉพาะตัวเลข `0-9` เท่านั้น)
  * `ContractCancellationDate` (DATE) - วันที่ยกเลิกสัญญาเช่ารถ

### ตารางเก็บประวัติสัญญาเช่า: `dbo.EV_RentItem`
* **ฟิลด์ที่เกี่ยวข้อง:**
  * `ContractCancellationDate` (DATE) - วันที่ยกเลิกสัญญา (จะถูกบันทึกเมื่อตรวจเช็คเสร็จสิ้น)
  * `IsActive` (BIT) - เปลี่ยนค่าจาก `1` เป็น `0` (ปิดสัญญา) เมื่อกระบวนการตรวจสภาพเสร็จสิ้น
  * `UpdateDate` (DATETIME) - วันที่บันทึกอัปเดตล่าสุด
  * `UpdateUserID` (INT) - ID ของผู้ใช้งานระบบที่ทำรายการ

---

## 2. ลำดับขั้นตอนการทำงาน (Flow Logic) เมื่อกด Complete ตรวจเช็คคืนรถ

เมื่อเจ้าหน้าที่กด **Complete** (สถานะเปลี่ยนเป็น `COMPLETED`) ระบบหลังบ้านจะเข้าสู่ทรานแซกชันการเขียนฐานข้อมูลแบบอะตอมิก (Atomic Transaction) ดังนี้:

### ขั้นตอนที่ 1: ค้นหาข้อมูลเดิมจากใบตรวจสภาพ (`EV_Inspection`)
* ทำการ Query หาข้อมูล `VinNo`, `ReturnItemID`, `RentItemID`, `ContractCancellationDate` จากใบตรวจสภาพนั้น

### ขั้นตอนที่ 2: ตรวจเช็คสถานะรถปัจจุบัน (ก่อนคืน)
นำค่าสถานะมาเปรียบเทียบในรูปแบบตัวพิมพ์ใหญ่ (Case-Insensitive):

#### [เคส A] สถานะรถเดิมเป็น `ON_RENT` หรือ `MAINTENANCE (ON_RENT_MAINTENANCE)`
1. **จัดการตาราง `dbo.EV_ReturnItem` (ใบงานรับคืน):**
   * **กรณีไม่มี ReturnItemID มาก่อน:** ค้นหาประวัติการเช่าล่าสุดจาก `EV_RentItem` แล้วทำรายการ `INSERT` ใหม่ด้วยสถานะ `Status = 'SUBMIT'` (แทนที่จะเป็น DRAFT)
   * **กรณีมี ReturnItemID อยู่แล้ว:** ทำการอัปเดตระยะกิโลเมตร, สถานที่คืน, วันที่คืน และปรับปรุงสถานะเป็น `Status = 'SUBMIT'`
2. **ยกเลิกสัญญาในตาราง `dbo.EV_RentItem`:**
   * ทำการอัปเดตประวัติการเช่าที่มี ID ตรงกัน ปรับสถานะเป็น **`IsActive = 0`** (ยกเลิกสัญญาแล้ว)
   * บันทึกฟิลด์ `ContractCancellationDate` โดยยึดตามค่าที่กรอกมาจากการตรวจสภาพ
   * บันทึกผู้ทำรายการและเวลาปัจจุบันลงใน `UpdateUserID` และ `UpdateDate`
3. **ปรับสถานะของตัวรถในตาราง `dbo.EV_InventoryItem`:**
   * อัปเดต `Status = 'AVAILABLE'` (พร้อมส่งมอบ)
   * อัปเดต `StatusType = 'AVAILABLE_USE'` (พร้อมใช้)
   * อัปเดตสถานที่จอดปัจจุบัน `CurrentLocation = @location` (ตามที่เลือกจอดคืน)
4. **บันทึก Log ในตาราง `dbo.EV_VehicleNote`:**
   * เขียนประวัติประโยค: *"ระบบตรวจคืนรถ: เปลี่ยนสถานะรถจาก [สถานะเดิม] เป็น AVAILABLE (AVAILABLE_USE) (บันทึกอัตโนมัติจากการทำใบตรวจคืนรถ Inspection ID: ...)"*

#### [เคส B] สถานะรถเดิมเป็น `REPLACEMENT` (สถานะย่อย `REPLACEMENT_CAR`)
1. **จัดการตาราง `dbo.EV_ReplacementItem` (คืนรถทดแทน):**
   * ค้นหาประวัติของรถทดแทนคันดังกล่าวที่เป็น Active ปรับปรุงวันที่คืนจริง `ReplacementReturnDate = @returnDate` และตั้งค่า `IsActive = 0`
2. **ปรับสถานะของตัวรถในตาราง `dbo.EV_InventoryItem`:**
   * อัปเดต `Status = 'REPLACEMENT'`
   * อัปเดต `StatusType = 'REPLACEMENT_AVAILABLE'`
   * อัปเดตสถานที่จอดปัจจุบัน `CurrentLocation = @location`
3. **บันทึก Log ในตาราง `dbo.EV_VehicleNote`:**
   * เขียนประวัติประโยค: *"ระบบตรวจคืนรถ: เปลี่ยนสถานะรถจาก [สถานะเดิม] เป็น REPLACEMENT (REPLACEMENT_AVAILABLE) (บันทึกอัตโนมัติจากการทำใบตรวจคืนรถ Inspection ID: ...)"*

---

## 3. รายละเอียดในหน้าส่วนติดต่อผู้ใช้งาน (UI Checklist)

หน้าจอรับคืนรถและข้อมูลส่งคืนรถ ประกอบด้วยฟิลด์ข้อมูลบังคับ 6 ฟิลด์ดังนี้:

| ฟิลด์ข้อมูล | ประเภทอินพุต | ค่าเริ่มต้น / เงื่อนไขการทำงาน |
|---|---|---|
| **วันที่คืนรถ** | Date Picker | วันปัจจุบันของประเทศไทย (Thailand Local Time) |
| **วันที่ยกเลิกสัญญา** | Date Picker | วันปัจจุบันของประเทศไทย (คู่กับวันที่คืนรถ) |
| **สถานที่คืนรถ/ลานจอด** | Dropdown | ดึงรายชื่อลานจอดรถทั้งหมดจากระบบ |
| **ชื่อลูกค้าที่นำรถมาคืน** | Text Input | ดึงชื่อเต็มของลูกค้าจากประวัติการเช่ามาเป็นค่าเริ่มต้น (แก้ไขได้) |
| **เบอร์ติดต่อลูกค้า** | Text Input | เริ่มต้นเป็นค่าว่าง, **กรอกได้เฉพาะตัวเลข `0-9` เท่านั้น** |
| **ชื่อเจ้าหน้าที่ผู้ตรวจเช็ค** | Text Input | ดึงชื่อเต็มของเจ้าหน้าที่ LINE User ที่ล็อกอินระบบ ณ ขณะนั้นมาเป็นค่าเริ่มต้น |

### จำนวนข้อตรวจสภาพและการบันทึกเพื่ออกรายงาน (25 ข้อ)
ในฝั่งหน้าจอ (UI) มีเช็คลิสต์ตรวจสภาพทั้งหมด **25 ข้อ** ซึ่งระบบบันทึกลงในตาราง `dbo.EV_InspectionItem` ครบถ้วนทั้งหมด 25 รายการ เพื่อให้ออกรายงานได้ง่ายและเป็นระบบ (ไม่ต้องเขียนเคสพิเศษ)
* **กรณีการถ่ายรูปรอบคัน 4 ด้าน (`CAR_PHOTOS` / `AROUND`):**
  * ในฐานข้อมูล (ตาราง `EV_InspectionItem`) จะเก็บค่าเป็น **`YES`** หากถ่ายรูปรถครบถ้วนทั้ง 4 ด้านหลัก (หน้า, หลัง, ซ้าย, ขวา)
  * หากยังถ่ายไม่ครบ จะเก็บค่าเป็น **`NO`** (ในฉบับร่าง)

### การประเมินผลสภาพรถอัตโนมัติ (Auto Assessment)
ระบบจะทำการประมวลผลสภาพรถอัตโนมัติโดยแสดงการ์ดประเมินผลสภาพดังนี้:
1. **`รอผลการตรวจ` (สีเทา ⏳):** แสดงเมื่อเช็คลิสต์ตรวจสภาพรถยังกรอกข้อมูลไม่ครบถ้วน (`filledCount < totalCount`)
2. **`ปกติ` (สีเขียว ✅):** แสดงเมื่อกรอกครบทุกข้อและไม่มีหัวข้อใดระบุความเสียหาย (ไม่มีการเลือกเสื่อมสภาพ/บุบ/เสียหาย)
3. **`ต้องส่งเข้าซ่อม` (สีแดง ⚠️):** แสดงเมื่อกรอกครบทุกข้อและพบหัวข้อที่เสียหายอย่างน้อย 1 รายการ

---

## 4. โครงสร้างไฟล์โค้ดและ API

* **Data Types**: [types.ts](file:///Users/kanittamac/web/ev7dashboard/lib/inspection/types.ts)
* **API Route (ตรวจคืนรถทั่วไป)**: [route.ts](file:///Users/kanittamac/web/ev7dashboard/app/api/inspection/route.ts)
* **API Route (ตรวจคืนรายเครื่อง)**: [route.ts](file:///Users/kanittamac/web/ev7dashboard/app/api/inspection/%5Bid%5D/route.ts)
* **Backend Services**: [inspection-service.ts](file:///Users/kanittamac/web/ev7dashboard/lib/inspection/inspection-service.ts)
* **UI Tab Component**: [InspectionTab.tsx](file:///Users/kanittamac/web/ev7dashboard/app/liff/quick-report/inspection/InspectionTab.tsx)
* **UI Checklist Form**: [InspectionChecklist.tsx](file:///Users/kanittamac/web/ev7dashboard/app/liff/quick-report/inspection/InspectionChecklist.tsx)
