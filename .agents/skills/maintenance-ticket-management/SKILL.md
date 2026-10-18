---
name: maintenance-ticket-management
description: Comprehensive architecture, database schema, counting logic, master data mappings (EV_MsSubStatus), and workflow for the Maintenance Management & Ticket Tree system.
---

# Maintenance Ticket Management & Master Logic Skill

## 1. ภาพรวมระบบ (System Overview)
ระบบบริหารจัดการงานซ่อมบำรุงรถยนต์ (Maintenance Management) รองรับการติดตามสถานะงานซ่อมของรถยนต์ในพอร์ต จัดกลุ่มประเภทปัญหา จัดสรรพื้นที่ซ่อม (อู่/ศูนย์บริการ) แจกแจงเคสความเสียหาย (ซ่อมหนัก/ซ่อมเบา) และจำแนกโครงสร้างใบงานซ่อมผ่านหน้าแดชบอร์ด `/maintenance` และการสืบค้นผ่าน Bot Butter

---

## 2. โครงสร้างฐานข้อมูล & มาสเตอร์ (Database & Master Schema)

### 2.1 ตารางหลัก: `dbo.EV_MaintenanceItem`
- `MaintenanceItemID` (PK): รหัสใบงานซ่อม
- `InventoryItemID` (FK -> `dbo.EV_InventoryItem`): รถยนต์ที่เข้าซ่อม
- `ReportDate` / `IncidentDate`: วันที่แจ้งซ่อม / วันเกิดเหตุ
- `MaintenanceStartDate` / `MaintenanceFinishDate` / `MaintenanceReturnDate`: วันเริ่มซ่อม / วันซ่อมเสร็จ / วันรับรถคืน
- `CarStatusCode`: สถานะใบงานซ่อม (`IN_MAINTENANCE`, `WAITING_FOR_MAINTENANCE`, `READY_PICKUP_MAINTENANCE`, `GARAGE_COMPLETE`, `STILL_WORK`, `COMPLETE`)
- `IssueTitle`: หัวข้อ/อาการปัญหา
- `ProblemTypeCode`: รหัสประเภทปัญหา (เช่น `ACCIDENT`, `PRODUCT`, `SUPPLIER_REPAIR`, `RECONDITION`, `OTHER_2`)
- `CarCaseCode`: รหัสเคสความเสียหาย (`DAMAGE_HEAVY`, `DAMAGE_LIGHT`, `DAMAGE_TOTAL`)
- `ServiceLocationCode`: รหัสอู่/สถานที่ซ่อม
- `FaultPartyCode`: รหัสฝ่ายที่ผิด (`FAULT_DRIVER`, `FAULT_COUNTERPARTY`, `OTHER`)
- `InsuranceCode`: รหัสบริษัทประกัน (`VIRIYA_INSURANCE`, `MUANGTHAI_INSURANCE`, `ICARE_INSURANCE`)
- `IsActive`: แฟล็กสถานะใช้งาน (bit)

### 2.2 ตารางมาสเตอร์ความหมาย: `dbo.EV_MsSubStatus`
ความหมายและข้อความแสดงผลทั้งหมดในระบบ ให้อ้างอิงตามคอลัมน์ `Type`:

| หมวดหมู่ (Type) | รหัส (StatusCode) | ชื่อแสดงผล (StatusName) | คำอธิบายความหมาย (DescriptionStatus) |
|---|---|---|---|
| **`DAMAGE`** (CarCaseCode) | `DAMAGE_HEAVY` | **เคสซ่อมหนัก** | ความเสียหายรุนแรง / ซ่อมหนัก |
| | `DAMAGE_LIGHT` | **เคสซ่อมเบา** | ความเสียหายเล็กน้อย / ซ่อมเบา |
| | `DAMAGE_TOTAL` | **ความเสียหายรุนแรง ไม่คุ้มค่าต่อการซ่อม** | ความเสียหายรุนแรง ไม่คุ้มค่าต่อการซ่อม |
| **`MAINTENANCE_PROBLEM_TYPE`** | `ACCIDENT` | **อุบัติเหตุ** | อุบัติเหตุ |
| | `PRODUCT` | **ผลิตภัณฑ์** | ผลิตภัณฑ์ |
| | `SUPPLIER_REPAIR` | **งานซ่อมจาก Supplier** | งานซ่อมจาก Supplier |
| | `RECONDITION` | **ปรับสภาพรถ** | ปรับสภาพรถ |
| | `OTHER_2` | **อื่นๆ** | อื่นๆ |
| **`MAINTENANCE_CAR_STATUS`** | `WAITING_FOR_MAINTENANCE` | **เข้าซ่อม** (รอเข้าซ่อม) | เข้าซ่อม |
| | `IN_MAINTENANCE` | **รถอยู่ระหว่างซ่อม** (กำลังซ่อม) | รถอยู่ระหว่างซ่อม |
| | `GARAGE_COMPLETE` | **ซ่อมเสร็จ** | ซ่อมเสร็จ |
| | `STILL_WORK` | **รถยังขับใช้งานได้อยู่** | รถยังขับใช้งานได้อยู่ |
| | `COMPLETE` | **ปิดเคส** | ปิดเคส |
| **`STATUS_TYPE_MAINTENANCE`** | `NEW_MAINTENANCE` | **รถใหม่เข้าซ่อม** | รถใหม่เข้าซ่อม |
| | `ON_RENT_MAINTENANCE` | **รถเช่าเข้าซ่อม** | รถเช่าเข้าซ่อม |
| | `USE_MAINTENANCE` | **รถใช้เเล้วเข้าซ่อม** | รถใช้เเล้วเข้าซ่อม |
| | `READY_PICKUP_MAINTENANCE`| **รถซ่อมเสร็จ รอลูกค้ามารับ** | รถซ่อมเสร็จ รอลูกค้ามารับ |
| | `REPLACEMENT_MAINTENANCE` | **รถสำรองเข้าซ่อม** | รถสำรองเข้าซ่อม |

---

## 3. กฎและนิยามการนับตัวเลขงานซ่อม (Counting Logic & Ticket Tree)

### 3.1 การจัดกลุ่มสถานะงานซ่อม
1. **เฉพาะค้างซ่อม (Active Repairs - ค่าเริ่มต้น Default View ของ Ticket Tree)**:
   - เงื่อนไข: `CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE')`
   - ปัจจุบันมี 727 ใบงาน (ครอบคลุมรถยนต์ในอู่ 584 คัน)
   - หน้า Ticket Tree จะแสดงเฉพาะยอดนี้เป็นค่าเริ่มต้น
2. **ซ่อมเสร็จ รอลูกค้ามารับ (Ready to Pickup)**:
   - เงื่อนไข: `CarStatusCode IN ('READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE')`
   - มีจำนวน 27 ใบงาน
   - สามารถเปิดสวิตช์ toggle "รวมรถเสร็จรอมารับ (27 คัน)" เพื่อดูยอดรวมได้
3. **ยอดรวมใบงานของรถสถานะซ่อม (`Status = 'MAINTENANCE'`)**:
   - 727 (ค้างซ่อม) + 27 (รอมารับ) = **754 ใบงาน** (584 คัน)
4. **รถยังขับใช้งานได้อยู่ (Still Work)**:
   - เงื่อนไข: `CarStatusCode = 'STILL_WORK'` (มีประวัติเคลม/แจ้งซ่อม แต่รถยังไม่เข้าอู่ ตัวรถยังเป็น ON_RENT หรือ AVAILABLE)
5. **ปิดเคสแล้ว (Complete)**:
   - เงื่อนไข: `CarStatusCode = 'COMPLETE'` (ในฐานข้อมูลทั้งหมดมี 3,600+ ใบงาน)

### 3.2 กฎการจำแนกสังกัดบริษัท (Company Classification)
- **Demo** = `GI`
- **Waiting for GR** (`Status = 'WAITING_FOR_GR'`) = `GI`
- **Production Pending ทั้งหมด** (`Status = 'PRODUCTION'` และยังรอดำเนินการ) = `GI`
- **นอกนั้นทั้งหมด** = `EV7`

---

## 4. โครงสร้าง Component หน้าเว็บ (`/maintenance`)
1. **API**: `app/api/maintenance/route.ts`
   - เชื่อมต่อ `dbo.EV_MsSubStatus` แปลงรหัส Dynamic สำหรับ `ProblemType`, `CarCase`, และ `CarStatus`
2. **Ticket Tree Component**: `components/maintenance/MaintenanceTicketTree.tsx`
   - State `includeReadyPickup`: ค่าเริ่มต้น `false` (แสดงเฉพาะ 727 ค้างซ่อม)
   - แยกสถิติ `HEAVY` (ซ่อมหนัก), `LIGHT` (ซ่อมเบา), `UNSPECIFIED` (ไม่ระบุ)
   - Badge เคสซ่อมหนัก/เบาคลิกเพื่อ Filter ตารางด้านล่างได้
3. **Main Page**: `app/maintenance/page.tsx`
   - จัดการ State `statusFilter`, `problemTypeFilter`, `carCaseFilter`, `locationFilter`
   - แสดงแถบ Active Filter Pill พร้อมปุ่มล้างตัวกรอง
