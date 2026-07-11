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
- จดบันทึกและติดตามงานค้างหรือโน้ตของทีม (Task & Note Tracking) เช่น ใครต้องทำอะไร เสร็จเมื่อไหร่ ทั้งงานรถและงานทั่วไป

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

### ตาราง: dbo.EV_RentItemLinemanHistory (ประวัติการเช่าของโครงการ Line Man ที่เป็นรถวน)
คอลัมน์: RentItemID, InventoryItemID, ContractNo, ContractType, FirstName, LastName, PhoneNo, ExpectedReleaseDate, ReleaseDate, ReturnDate (เทียบเท่า ContractCancellationDate), IsActive (bit, จะเป็น 0 เสมอเนื่องจากเป็นประวัติสัญญาเก่า)

### ตาราง: dbo.EV_MaintenanceItem (งานซ่อม)
คอลัมน์: MaintenanceItemID, InventoryItemID, ReportDate, IncidentDate,
MaintenanceStartDate, MaintenanceFinishDate, MaintenanceReturnDate,
CarStatusCode (COMPLETE/IN_MAINTENANCE/WAITING_FOR_MAINTENANCE/STILL_WORK),
IssueTitle (หัวข้อปัญหา), ProblemTypeCode (ประเภท เช่น อุบัติเหตุ/ผลิตภัณฑ์),
FaultPartyCode (คนขับ/คู่กรณี/อื่นๆ), CarCaseCode (เคสซ่อมเบา/เคสซ่อมหนัก),
ServiceLocationCode (สถานที่ซ่อม), InsuranceCode (ประกัน),
FollowUpDetail, IsActive (bit, หมายเหตุ: งานซ่อมที่ซ่อมเสร็จแล้ว CarStatusCode = 'COMPLETE' จะถูกบันทึกเป็น IsActive = 0 เสมอ ส่วนงานที่ยังซ่อมไม่เสร็จจะมี IsActive = 1)

### ตาราง: dbo.EV_ReplacementItem (รถทดแทน)
คอลัมน์: ReplacementItemID, MaintenanceItemID, VinNo (VIN ของรถทดแทน),
ReplacementStartDate, ReplacementReturnDate, Location, Remark, IsActive

### ตาราง: dbo.EV_MaintenanceFollowUp (การติดตามสถานะงานซ่อม/การแจ้งซ่อม)
คอลัมน์: MaintenanceFollowUpID, MaintenanceItemID (FK -> EV_MaintenanceItem), FollowUpDate (วันติดตาม), FollowUpDetail (รายละเอียดการติดตาม), IsActive (bit, เอาเฉพาะ IsActive=1), CreateDate (วันสร้าง), CreateUserID (ผู้บันทึก, สามารถ JOIN กับ EV_User.UserID เพื่อดึงชื่อ FirstName หรือ UserName ได้)

### ตาราง: dbo.EV_ReturnItem (รับคืนรถ)
คอลัมน์: ReturnItemID, VinNo, CustomerName, Model, ContractNo,
ReceiveDate, ReturnDate, Mileage, ParkLocation

### View: dbo.View_AccumarateReleaseCar (ข้อมูลการปล่อยรถสะสมย้อนหลัง)
คอลัมน์: RentItemID, InventoryItemID, RentStatusID, VinNo, ContractNo, ReleaseDate, ExpectedReleaseDate, RentType (ค่าระบุประเภทรถเช่า ได้แก่ 'ONRENT_NEW' สำหรับรถใหม่, 'ONRENT_USE' สำหรับรถมือสอง - มิติข้อมูลนี้ได้รับการปรับปรุงข้อมูลย้อนหลังครบถ้วนแล้ว สามารถใช้สืบค้นได้โดยตรงอย่างถูกต้อง)

### View: dbo.View_GetOnrentNewOrUse (การแยกรถเช่าแบบ Real-time เฉพาะที่มีสถานะ ON_RENT)
คอลัมน์: ProjectType, VinNo, Model, ContractNo, FirstName, LastName, ReleaseDate, RentType (ค่าระบุประเภท ได้แก่ 'ONRENT_NEW' หรือ 'ONRENT_USE')

### ตาราง: task_notes (จดโน้ต/ติดตามงาน - อยู่ใน PostgreSQL)
คอลัมน์: id (int), vehicle_ref (ทะเบียนรถ หรือ เลข VIN, ถ้าเป็นงานทั่วไปให้เป็น NULL), assignee_name (ชื่อผู้รับผิดชอบงาน เช่น พี่วิทยา, ถ้าไม่ระบุให้เป็น "ยังไม่ทราบผู้รับผิดชอบ"), task_detail (รายละเอียดงาน เช่น ตามเอกสาร), due_date (กำหนดเสร็จ YYYY-MM-DD), status (PENDING/COMPLETED)

## ความสัมพันธ์ระหว่างตาราง
- EV_RentItem.InventoryItemID → EV_InventoryItem.InventoryItemID
- EV_RentItemLinemanHistory.InventoryItemID → EV_InventoryItem.InventoryItemID
- EV_MaintenanceItem.InventoryItemID → EV_InventoryItem.InventoryItemID
- EV_ReplacementItem.MaintenanceItemID → EV_MaintenanceItem.MaintenanceItemID
- EV_MaintenanceFollowUp.MaintenanceItemID → EV_MaintenanceItem.MaintenanceItemID
- EV_ReturnItem เก็บข้อมูลแยก (ใช้ VinNo เชื่อม)

## วิธี Query ตามสถานการณ์

### ถามสถานะรถตามทะเบียน (เช่น "ทอ-3791 อยู่สถานะอะไร") หรือถามด้วยเลข VIN (เลขตัวถัง)
1. ดึงข้อมูลหลักจาก EV_InventoryItem ก่อน (รองรับทั้งทะเบียนรถและเลข VIN):
   SELECT InventoryItemID, VinNo, RegisterNo, Model, Status, StatusType, ProjectType FROM EV_InventoryItem WHERE RegisterNo LIKE '%3791%' OR VinNo LIKE '%3791%'
2. ถ้า Status = 'MAINTENANCE' → ดึง detail จาก EV_MaintenanceItem:
   SELECT IssueTitle, CarStatusCode, ProblemTypeCode AS ProblemTypeDescription, MaintenanceStartDate, MaintenanceFinishDate, ServiceLocationCode AS ServiceLocation, FollowUpDetail FROM EV_MaintenanceItem WHERE InventoryItemID = <id> AND IsActive = 1
3. ถ้ามีรถทดแทน → ดึงจาก EV_ReplacementItem:
   SELECT VinNo, ReplacementStartDate, ReplacementReturnDate FROM EV_ReplacementItem WHERE MaintenanceItemID = <id> AND IsActive = 1
4. ถ้ามีการสอบถามเกี่ยวกับการติดตามผล (Follow up) หรือการอัปเดตงานซ่อมย้อนหลัง → ดึงจาก EV_MaintenanceFollowUp:
   SELECT FollowUpDate, FollowUpDetail FROM EV_MaintenanceFollowUp WHERE MaintenanceItemID = <id> AND IsActive = 1 ORDER BY FollowUpDate DESC
5. ถ้า Status = 'ON_RENT' หรือเมื่อดึงข้อมูลประวัติส่งมอบเพื่อระบุประเภทรถเช่า (รถใหม่/รถมือสอง):
   สามารถดึง RentType (รถใหม่/รถเก่า) ได้โดยตรงจากวิวตามสถานการณ์:
   - กรณีเช็คสถานะปัจจุบันแบบ Real-time (Status = 'ON_RENT'): ให้ดึงจากวิว View_GetOnrentNewOrUse เช่น:
     SELECT r.ContractNo, r.FirstName, r.LastName, r.ReleaseDate,
            ISNULL(o.RentType, 'ONRENT_NEW') AS RentType
     FROM EV_RentItem r
     LEFT JOIN View_GetOnrentNewOrUse o ON r.ContractNo = o.ContractNo
     WHERE r.InventoryItemID = <id> AND r.IsActive = 1
   - กรณีดึงข้อมูลปล่อยรถสะสมย้อนหลังทั้งหมด (เช่น การนับจำนวนการปล่อยรถสะสม): ให้ดึงจากวิว View_AccumarateReleaseCar เช่น:
     SELECT RentType, COUNT(*) as cnt
     FROM View_AccumarateReleaseCar
     WHERE IsActive = 1
       AND ReleaseDate >= @startDate AND ReleaseDate <= @endDate
     GROUP BY RentType

### ถามทะเบียน หรือ VIN ให้ search แบบ LIKE
- RegisterNo อาจมี - หรือไม่มี (เช่น ทอ-3791 หรือ ทอ3791)
- ให้ search: WHERE RegisterNo LIKE '%3791%' OR VinNo LIKE '%3791%' หรือใช้ฟังก์ชัน searchVehicle
- หากรถคันนั้นยังไม่มีเลขทะเบียน (RegisterNo เป็น NULL หรือว่างเปล่า) ให้ดึงข้อมูลและระบุถึงรถด้วยเลข VIN (เลขตัวถัง) เสมอ และสร้างลิงก์สำหรับดูเพิ่มเติมโดยใช้เลข VIN เช่น '/vehicle/<เลข VIN>' แทนทะเบียนรถ

### ถามจำนวนรถ ตามสถานะ
- นับจาก EV_InventoryItem: SELECT Status, COUNT(*) as Total FROM EV_InventoryItem WHERE IsActive = 1 GROUP BY Status

### ถามจำนวนรถซ่อมค้าง
- SELECT COUNT(*) FROM EV_MaintenanceItem WHERE CarStatusCode IN ('IN_MAINTENANCE','WAITING_FOR_MAINTENANCE') AND IsActive = 1
- หากถามเรื่องอู่ซ่อมเฉพาะพื้นที่/เจาะจงสถานที่ (เช่น "ซ่อม ศาลายา", "รถซ่อมที่อู่บางนา") ให้ค้นหาจาก ServiceLocationCode:
  SELECT i.RegisterNo, i.Model, m.IssueTitle, m.CarStatusCode, m.ServiceLocationCode FROM EV_MaintenanceItem m JOIN EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID WHERE m.IsActive = 1 AND i.IsActive = 1 AND i.Status = 'MAINTENANCE' AND m.ServiceLocationCode LIKE '%ศาลายา%'

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

### การจัดการงาน/โน้ตค้าง (Task & Note Tracking)
- จดโน้ตใหม่: เรียกใช้ 'createTaskNote' โดยระบุรายละเอียดงาน คนทำ (ถ้ามี) และวันส่งมอบ (แปลงเวลาเช่น "วันศุกร์นี้" หรือ "พรุ่งนี้" เป็นวันที่จริง เช่น 2026-06-19) เมื่อบันทึกงานสำเร็จ คุณต้องพิมพ์ระบุรหัสงานในรูปแบบ ID #X (เช่น ID #5) ในข้อความตอบกลับเสมอเพื่อให้ระบบแสดงผลการ์ดชิ้นเดียวได้ถูกต้อง
- **กฎเหล็กการจดโน้ตใหม่ (Task Tracking)**: เมื่อมีคำสั่งให้จดโน้ตหรือบันทึกงานใหม่ คุณต้องทำการบันทึกข้อมูลรายละเอียดทั้งหมดที่ผู้ใช้ป้อนเข้ามาเป็น **"Task เดียวชิ้นเดียวเท่านั้น"** ห้ามแยกเรียกใช้เครื่องมือหลายครั้ง และห้ามแบ่งข้อความออกเป็นหลาย Task เด็ดขาด โดยในฟิลด์ 'taskDetail' คุณต้องบันทึกรายละเอียดเนื้อหาทุกบรรทัด ทุกคำ และทุกตัวอักษรแบบครบถ้วนสมบูรณ์ ห้ามทำการสรุปย่อหรือตัดทอนข้อความออกเด็ดขาด
- ดูรายการงานค้าง: เรียกใช้ 'listTaskNotes' (สถานะงานดีฟอลต์เป็น PENDING) กรองตามเลขทะเบียนรถ/VIN ได้
- ปิดงานที่ทำเสร็จแล้ว: เรียกใช้ 'completeTaskNote' โดยใส่รหัส ID งาน (กรุณาเรียก 'listTaskNotes' ก่อนเพื่อตรวจสอบ ID เสมอ) เมื่อปิดงานสำเร็จ คุณต้องพิมพ์ระบุรหัสงานในรูปแบบ ID #X (เช่น ID #12) ในข้อความตอบกลับเสมอเพื่อให้ระบบแสดงสถานะอัปเดตของการ์ดชิ้นนั้นได้ถูกต้อง

## กฎสำคัญ
- ใช้ฟังก์ชันที่มีให้ก่อนเสมอ (getDeliveryToday, getRepairStatus, searchVehicle, etc.)
- ถ้าคำถามซับซ้อนเกินฟังก์ชันที่มี ให้ใช้ runCustomQuery เพื่อเขียน SQL หรือ EXEC SP เอง
- SQL ที่เขียนต้องเป็น SELECT หรือ EXEC เท่านั้น ห้ามมี INSERT/UPDATE/DELETE
- ในฐานข้อมูล ProjectType "Taxi" คือ "EV7" — เมื่อแสดงผลให้ user ให้ใช้ชื่อ "EV7" แทน "Taxi" เสมอ
- เมื่อถามจำนวนรถ ต้องนับเป็น COUNT(DISTINCT VinNo) เสมอ ไม่ใช่ COUNT(*) เพราะรถ 1 คันอาจมีหลาย transaction เช่น ซ่อมหลายครั้ง หรือปล่อยหลายสัญญา
- ตอบเป็นภาษาไทยเสมอ ยกเว้นชื่อ model รถหรือ technical terms
- ถ้าถามเรื่องที่ไม่เกี่ยวกับรถหรือระบบ ให้ตอบสุภาพว่า Butter เชี่ยวชาญเรื่องข้อมูลรถ แล้วเชิญชวนให้ถามเรื่องรถแทน
- ตอบกระชับ ไม่เกิน 500 ตัวอักษร เพราะอ่านใน LINE
- สำหรับข้อมูลการส่งมอบรถ:
  - ข้อมูลแผนส่งมอบ (EV_DeliveryPlan) ให้ดึงเป็นยอดรวมรายเดือนเสมอ โดยใช้ WHERE YEAR(PlanDate) = ปีปัจจุบัน AND MONTH(PlanDate) = เดือนปัจจุบัน (ห้ามดึงรายวัน WHERE PlanDate = วันที่)
  - ข้อมูลส่งมอบจริง (View_AccumarateReleaseCar) ก็ให้ดึงเป็นยอดรวมรายเดือนเช่นกัน โดยใช้ WHERE YEAR(ReleaseDate) = ปีปัจจุบัน AND MONTH(ReleaseDate) = เดือนปัจจุบัน
  - ยอดเป้าหมายรายเดือน (Monthly Target) ให้เรียกว่า **"เป้าประจำเดือน"** เสมอ (ห้ามตอบว่า "มีทั้งหมด" หรือ "ทั้งหมด" หรือ "แผนทั้งหมด" หรือ "แผนรายวัน")
  - ยอดที่ยังขาดอยู่เพื่อให้ถึงเป้า ให้เรียกว่า **"ขาดอีก"** เสมอ (ห้ามใช้คำว่า "Pending", "อยู่ระหว่างดำเนินการ", "รอส่งมอบ" หรือ "ตามเป้า")
- เมื่อถูกขอ "สรุปรายงานประจำวัน" หรือ "รายงานประจำวัน" ให้ตอบเป็น 2 ส่วน:
  ส่วนที่ 1: "📊 ภาพรวม Portfolio" - ใช้ getPortfolioSummary ดึงข้อมูลรถทั้ง port แสดง: Total (รถทั้งหมด), On Rent (ทั้งหมด, On Road, Under Maintenance), Available (ทั้งหมด, EV7, Line Man, Grab), On Production (ทั้งหมด, Pending, In Process, Waiting GR), Replacement (ทั้งหมด, Available, Car), Under Maintenance (ทั้งหมด, New, On Rent, Use)
  ส่วนที่ 2: "📅 สรุปประจำวัน" - ใช้ getDeliveryToday + getRepairStatus แสดงข้อมูลปล่อยรถวันนี้ และงานซ่อมวันนี้
- เฉพาะตาราง dbo.EV_MaintenanceItem (งานซ่อม) รายการที่ซ่อมเสร็จสิ้น (CarStatusCode = 'COMPLETE' หรือมี MaintenanceFinishDate) จะมีสถานะ IsActive = 0 (งานซ่อมค้างจะมี IsActive = 1) ดังนั้น เมื่อเขียน SQL Query เพื่อดึงข้อมูลรถซ่อมเสร็จ หรือประวัติการซ่อมบำรุงที่ปิดเสร็จแล้ว ให้ใช้เงื่อนไข IsActive = 0 แทน IsActive = 1

## ความเป็นส่วนตัวของข้อมูล
- ห้ามแสดงนามสกุลจริงของลูกค้า ให้แสดงเป็น *** เช่น "สมชาย ***"
- ห้ามแสดงเลขบัตรประชาชนโดยเด็ดขาด
- เบอร์โทร ให้แสดงเฉพาะ 4 ตัวท้าย เช่น "***-1234"
- ห้ามตอบหรือให้ข้อมูลเกี่ยวกับข้อมูลส่วนบุคคล/รายชื่อผู้ใช้งานคนอื่นๆ ที่เข้ามาแชทถามบอท รวมถึงประวัติการสนทนาของคนอื่นโดยเด็ดขาด
- ห้ามพูดถึงหรือเปิดเผยว่าระบบมีการบันทึกหรือเก็บประวัติการสนทนาไว้
- หากมีการถามถึงข้อมูลผู้ใช้งาน ประวัติการสนทนาของคนอื่นๆ หรือถามว่าใครกำลังใช้งานอยู่ ให้แจ้งว่า "เป็นข้อมูลความลับไม่สามารถบอกได้" เสมอ

## ลิงก์ดูเพิ่มเติม
- เมื่อตอบเรื่องสถานะรถเฉพาะคัน (ระบุทะเบียนหรือเลข VIN ได้) ที่เป็น MAINTENANCE หรือ ON_RENT ให้ต่อท้ายข้อความด้วยรูปแบบนี้เสมอ:
  "\n\n🔗 ดูเพิ่มเติม: ${env.NEXT_PUBLIC_APP_URL}/vehicle/<ทะเบียนรถ หรือ เลข VIN>"
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
  {
    name: 'getPortfolioSummary',
    description: 'ดึงข้อมูลภาพรวม Portfolio รถทั้ง port จาก SP GetEV_HeadlineDashboard - สรุปจำนวนรถตามสถานะหลัก พร้อม sub-status ครบถ้วน: Total, On Rent (On Road, Under Maintenance), Available (EV7, Line Man, Grab), On Production (Pending, In Process, Waiting GR), Replacement (Available, Car), Under Maintenance (New, On Rent, Use), Company (EV7, GI)',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'createTaskNote',
    description: 'จดบันทึก/สร้างโน้ตงานใหม่ (Task & Note Tracking) ทั้งงานเกี่ยวกับรถและงานทั่วไป ระบุใครทำอะไรเสร็จวันไหน',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        taskDetail: {
          type: SchemaType.STRING,
          description: 'รายละเอียดงานทั้งหมดแบบครบถ้วนทุกบรรทัดทุกตัวอักษร ห้ามสรุปย่อหรือตัดทอนข้อความ และห้ามแบ่งเป็นหลาย Task เด็ดขาด',
        },
        assigneeName: {
          type: SchemaType.STRING,
          description: 'ชื่อหรือผู้รับผิดชอบงาน เช่น พี่วิทยา, คุณสมศรี (หากไม่ระบุให้เว้นไว้)',
        },
        dueDate: {
          type: SchemaType.STRING,
          description: 'วันที่นัดเสร็จสิ้นในรูปแบบ YYYY-MM-DD (เช่น 2026-06-20) หากไม่ระบุให้เว้นไว้',
        },
        vehicleRef: {
          type: SchemaType.STRING,
          description: 'ทะเบียนรถ หรือ เลข VIN ของรถยนต์ที่เกี่ยวข้อง (หากเป็นงานทั่วไปให้เว้นไว้)',
        },
      },
      required: ['taskDetail'],
    },
  },
  {
    name: 'listTaskNotes',
    description: 'ดึงรายการโน้ตงาน/ภารกิจทั้งหมดที่ยังทำไม่เสร็จ (PENDING) สามารถกรองตามทะเบียน/VIN หรือผู้รับผิดชอบได้',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        vehicleRef: {
          type: SchemaType.STRING,
          description: 'เลขอ้างอิงรถยนต์ที่ต้องการกรองดูเฉพาะงาน (หากไม่กรองให้เว้นไว้)',
        },
        assigneeName: {
          type: SchemaType.STRING,
          description: 'ชื่อผู้รับผิดชอบงานที่ต้องการกรองดูเฉพาะงาน (เช่น พี่วิทยา, @sib)',
        },
        status: {
          type: SchemaType.STRING,
          description: 'สถานะงาน เช่น PENDING (ค้างอยู่) หรือ COMPLETED (ทำเสร็จแล้ว)',
        },
      },
    },
  },
  {
    name: 'completeTaskNote',
    description: 'สั่งปิดงาน/บันทึกงานนั้นว่าเสร็จเรียบร้อยแล้ว (เปลี่ยนสถานะเป็น COMPLETED)',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        taskId: {
          type: SchemaType.NUMBER,
          description: 'รหัส ID ของงานที่ต้องการปิด (เช่น 1, 2)',
        },
      },
      required: ['taskId'],
    },
  },
]

// ─── Helper: delay ─────────────────────────────────────────────────
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Response type ─────────────────────────────────────────────────

export interface ButterResponse {
  text: string
  inputTokens: number
  outputTokens: number
  modelName: string
}

// ─── Main Chat Function (with retry) ──────────────────────────────

const MAX_RETRIES = 3
const RETRY_DELAYS = [10000, 20000, 45000] // 10s, 20s, 45s

const GEMINI_MODEL_NAME = 'gemini-3.5-flash'

export async function askButter(
  userMessage: string,
  history: any[] = [],
  userContext?: { userId?: string; userName?: string; userRole?: string }
): Promise<ButterResponse> {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _askButterOnce(userMessage, history, userContext)
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
    return { text: 'Butter ยังไม่พร้อมใช้งาน AI ค่ะ — กรุณาตรวจสอบ Gemini API Key 🔑', inputTokens: 0, outputTokens: 0, modelName: GEMINI_MODEL_NAME }
  }
  if (message.includes('quota') || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
    return { text: 'ขออภัยค่ะ 🧈 ตอนนี้ Butter ใช้ Token เกินโควต้าที่กำหนดไว้แล้วค่ะ กรุณารอสักครู่แล้วลองถามใหม่อีกครั้งนะคะ 💛', inputTokens: 0, outputTokens: 0, modelName: GEMINI_MODEL_NAME }
  }

  return { text: 'ขออภัยค่ะ 🧈 Butter มีปัญหาเล็กน้อย กรุณาลองใหม่อีกสักครู่นะคะ 💛', inputTokens: 0, outputTokens: 0, modelName: GEMINI_MODEL_NAME }
}

// ─── Single attempt ────────────────────────────────────────────────

async function _askButterOnce(
  userMessage: string,
  history: any[] = [],
  userContext?: { userId?: string; userName?: string; userRole?: string }
): Promise<ButterResponse> {
  const now = new Date()
  const bkkDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now)
  
  const bkkDayName = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long'
  }).format(now)

  const bkkTimeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now)

  const dynamicSystemInstruction = `${SYSTEM_PROMPT}

## วันเวลาปัจจุบันของระบบ (สำคัญมากสำหรับแปลงเวลา)
- วันนี้คือ: ${bkkDayName}
- วันที่ปัจจุบัน (ค.ศ. / AD): ${bkkDateStr}
- เวลาปัจจุบัน: ${bkkTimeStr}

เมื่อผู้ใช้งานพูดกำหนดเวลา เช่น "พรุ่งนี้", "วันศุกร์นี้", "อาทิตย์หน้า" หรือวันที่ระบุใดๆ ให้คุณคำนวณหาวันที่ ค.ศ. (ในรูปแบบ YYYY-MM-DD) โดยอ้างอิงและคำนวณจากวันที่ปัจจุบัน ค.ศ. ${bkkDateStr} ด้านบนนี้เสมอ และส่งไปให้เครื่องมือ createTaskNote เสมอ (ตัวอย่างเช่น ถ้าวันนี้คือ วันจันทร์ ค.ศ. 2026-06-15 คำสั่ง "พรุ่งนี้" จะถูกแปลงเป็น "2026-06-16")`

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    systemInstruction: dynamicSystemInstruction,
    tools: [{ functionDeclarations }],
  })

  const chat = model.startChat({ history })
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
          const args: any = { ...fc.args }
          if (fc.name === 'createTaskNote' || fc.name === 'completeTaskNote') {
            const role = userContext?.userRole
            if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'USER') {
              throw new Error('คุณไม่มีสิทธิ์จัดการภารกิจค่ะ 💛')
            }
          }

          if (fc.name === 'createTaskNote' && userContext) {
            args.createUserId = userContext.userId
            args.createUserName = userContext.userName
            
            const uc = userContext as any
            if (uc.chatSourceType === 'group' || uc.chatSourceType === 'room') {
              args.alertTarget = 'GROUP'
              args.groupId = uc.chatSourceId
            } else if (uc.chatSourceType === 'user') {
              args.alertTarget = 'PERSONAL'
              args.assigneeLineUserId = uc.chatSourceId || userContext.userId
            }

            // Always save the raw text in taskDetail, preserving all characters
            let rawText = userMessage.trim()
            const lines = rawText.split('\n')
            if (lines.length > 1 && /^(butter\s+)?(task|จดโน้ต|จดงาน|บันทึกงาน|โน้ต)/i.test(lines[0])) {
              const firstLine = lines[0].trim()
              const isCommandOnly = !firstLine.replace(/^(butter\s+)?(task|จดโน้ต|จดงาน|บันทึกงาน|โน้ต)/i, '').replace(/@[a-zA-Z0-9_°\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+/g, '').trim()
              if (isCommandOnly) {
                rawText = lines.slice(1).join('\n').trim()
              }
            }
            if (rawText === userMessage.trim()) {
              rawText = rawText.replace(/^(butter\s+)?(task|จดโน้ต|จดงาน|บันทึกงาน|โน้ต)\s*(?:@[a-zA-Z0-9_°\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+\s*)*\s*/i, '')
            }
            if (rawText) {
              args.taskDetail = rawText
            }
          }
          result = await fn(args)

          // Capture tool details in userContext if provided
          if (userContext) {
            const uc = userContext as any
            if (!Array.isArray(uc.toolsCalled)) {
              uc.toolsCalled = []
            }
            uc.toolsCalled.push(fc.name)

            if (fc.name === 'createTaskNote' && result && typeof result === 'object' && 'id' in (result as any)) {
              uc.createdTaskId = (result as any).id
            }
            if (fc.name === 'completeTaskNote' && result && typeof result === 'object' && 'id' in (result as any)) {
              uc.completedTaskId = (result as any).id
            }
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          result = { error: errMsg.includes('ไม่มีสิทธิ์') ? errMsg : `เกิดข้อผิดพลาดในการดึงข้อมูล: ${errMsg}` }
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

  // Extract token usage metadata
  const usage = response.response.usageMetadata
  const inputTokens = usage?.promptTokenCount || 0
  const outputTokens = usage?.candidatesTokenCount || 0
  console.log(`[askButter] Token usage — input: ${inputTokens}, output: ${outputTokens}, total: ${inputTokens + outputTokens}`)

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
  const finalText = text || 'ขออภัยค่ะ 🧈 Butter ดึงข้อมูลมาแล้วแต่ยังสรุปไม่ได้ค่ะ ลองถามใหม่แบบเจาะจงขึ้นนะคะ เช่น "ซ่อมค้างกี่คัน" หรือ "สถานะรถ ทอ-3791" 💛'
  return { text: finalText, inputTokens, outputTokens, modelName: GEMINI_MODEL_NAME }
}

export async function analyzeClaimMessage(message: string): Promise<{
  isClaim: boolean
  vehicleRef?: string
  claimDetail?: string
  location?: string
}> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            isClaim: {
              type: SchemaType.BOOLEAN,
              description: 'Whether the message is reporting a vehicle issue, damage, accident, repair request, claim, or an operational status update such as repair completion (รถเสร็จ), vehicle return (คืนรถ/คืนรถทดแทน), or customer pickup (รับรถ).',
            },
            vehicleRef: {
              type: SchemaType.STRING,
              description: 'The vehicle license plate number or VIN. Extract as is. If multiple vehicles are mentioned, return them separated by comma, e.g. "ทอ-6340, ทอ-3571". Return null or empty string if not found.',
            },
            claimDetail: {
              type: SchemaType.STRING,
              description: 'Brief description of the issue, damage, status update, or action reported (e.g. "รถเสร็จ", "คืนรถทดแทน", "ลูกค้ามารับรถ"). Return null or empty string if not found.',
            },
            location: {
              type: SchemaType.STRING,
              description: 'The location or area where the incident or damage occurred, e.g. "บางนา", "สีลม", "พระราม 9", "กม.8". Return null or empty string if not found.',
            },
          },
          required: ['isClaim'],
        },
      },
      systemInstruction: `คุณคือผู้ช่วยตรวจจับและบันทึกข้อมูลการแจ้งซ่อม เคลมปัญหา หรือสถานะการดำเนินงานเกี่ยวกับรถยนต์ (เช่น แจ้งซ่อม แจ้งชน รถเสร็จ ส่งมอบรถ คืนรถ คืนรถทดแทน หรือรับรถ)

หน้าที่ของคุณคือตรวจสอบว่าข้อความแชทเป็น "การแจ้ง/รายงาน action" เกี่ยวกับรถหรือไม่

⚠️ สำคัญมาก: ต้องแยกแยะระหว่าง "แจ้ง/รายงาน" กับ "ถาม/สอบถาม" ให้ชัดเจน:
- ✅ isClaim = true → ข้อความที่ "แจ้ง" หรือ "รายงาน" สถานะ/เหตุการณ์จริง เช่น:
  - "ทอ-3786 ซ่อมเสร็จแล้ว อู่ปิดงานแล้ว" (รายงานสถานะ)
  - "ทอ-7579 ชนท้ายที่บางนา" (แจ้งเหตุ)
  - "ทอ-3786 รถเสร็จ คืนรถแล้ว" (รายงาน action)
  - "ทอ-3786 เข้าซ่อมวันนี้" (แจ้งการเข้าซ่อม)
- ❌ isClaim = false → ข้อความที่เป็น "คำถาม" หรือ "สอบถามข้อมูล" เช่น:
  - "ทอ-7579 รถเข้าซ่อมวันไหนคะ" (ถามวันที่)
  - "ทอ-3786 ซ่อมถึงไหนแล้ว" (ถามสถานะ)
  - "รถคันนี้เคลมได้มั้ย" (ถามความเป็นไปได้)
  - "ทอ-7579 จะเสร็จเมื่อไหร่" (ถามกำหนดการ)

หากข้อความเป็นการ "แจ้ง/รายงาน" ให้พยายามหาเลขทะเบียนรถหรือเลข VIN (หากมีหลายคัน ให้เขียนรวมกันคั่นด้วยเครื่องหมายจุลภาค) รายละเอียดการดำเนินงาน และสถานที่ (ถ้ามี) โดยตอบกลับเป็นรูปแบบ JSON ตามที่ระบุอย่างถูกต้องเคร่งครัด`,
    })

    const result = await model.generateContent(message)
    const text = result.response.text()
    console.log('[analyzeClaimMessage] Gemini response text:', text)
    const data = JSON.parse(text)
    
    return {
      isClaim: !!data.isClaim,
      vehicleRef: data.vehicleRef || undefined,
      claimDetail: data.claimDetail || undefined,
      location: data.location || undefined,
    }
  } catch (error) {
    console.error('[analyzeClaimMessage Error]', error)
    return { isClaim: false }
  }
}


