# SQL Skill — EV7 Tracking System (ICI_EVSERVICES)

เอกสารนี้รวบรวม Stored Procedures ทั้งหมดที่ขึ้นต้นด้วย `Get` ในฐานข้อมูล `ICI_EVSERVICES` (SQL Server)
สำหรับใช้เป็นแหล่งอ้างอิงในการเรียกข้อมูลผ่าน Bot Butter หรือระบบ Dashboard

> **หมายเหตุ:** ทุก SP เป็น read-only, เข้าถึงผ่าน user `user_readonly`
> Definition ของ SP ถูก encrypt ไว้ — ข้อมูลด้านล่างได้จากการวิเคราะห์ Parameters และ Output Columns ของผลลัพธ์จริง

---

## สารบัญ

| หมวด | จำนวน SP |
|---|---|
| [1. Dashboard & Summary](#1-dashboard--summary) | 5 |
| [2. Delivery & Calendar](#2-delivery--calendar) | 2 |
| [3. Inventory & Vehicle List](#3-inventory--vehicle-list) | 7 |
| [4. Rent & Release (สัญญาเช่า/ส่งมอบ)](#4-rent--release) | 5 |
| [5. Maintenance (งานซ่อม)](#5-maintenance) | 8 |
| [6. Replacement (รถทดแทน)](#6-replacement) | 2 |
| [7. Return (รับคืนรถ)](#7-return) | 3 |
| [8. Production (สายการผลิต)](#8-production) | 4 |
| [9. Reports](#9-reports) | 8 |
| [10. Master Data](#10-master-data) | 5 |

---

## 1. Dashboard & Summary

### `GetEV_HeadlineDashboard`
สรุปภาพรวมรถทั้งระบบ — จำนวนรถทั้งหมด, ปล่อยเช่า, พร้อมใช้, ซ่อม, ผลิต ฯลฯ

**Parameters:**
| ชื่อ | Type | คำอธิบาย |
|---|---|---|
| `@DateBegin` | date | วันเริ่มต้น |
| `@DateEnd` | date | วันสิ้นสุด |

**Output Columns:**
`TotalVehicle`, `OnRentVehicle`, `OnRoadVehicle`, `OnRentMaintenanceVehicle`, `AvailableVehicle`, `AvailableLineManVehicle`, `AvailableGrabVehicle`, `AvailableEV7Vehicle`, `OnProductionVehicle`, `OnProductionPendingVehicle`, `OnProductionInProcessVehicle`, `OnProductionWaitingForGRVehicle`, `ReplacementVehicle`, `ReplacementAvailableVehicle`, `ReplacementCarVehicle`, `MaintenanceVehicle`, `NewMaintenanceVehicle`, `UseMaintenanceVehicle`, `CompanyEV7`, `CompanyGI`, `ActiveVehicle`, `ReserveVehicle`, `ReleasedVehicle`

**ตัวอย่างการเรียก:**
```sql
EXEC GetEV_HeadlineDashboard @DateBegin='2026-06-01', @DateEnd='2026-06-30'
```

**ตัวอย่างผลลัพธ์ (สำคัญ):**
- `TotalVehicle`: 323 (รถทั้งหมดที่ active)
- `OnRentVehicle`: 155 (ปล่อยเช่าแล้ว)
- `AvailableVehicle`: 94 (พร้อมส่งมอบ)
- `MaintenanceVehicle`: 4 (อยู่ระหว่างซ่อม)
- `OnProductionVehicle`: 70 (อยู่ในสายการผลิต)
- `CompanyEV7`: 3,481 / `CompanyGI`: 779

---

### `GetEV_DashboardSummary`
สรุป Dashboard หลัก ตามช่วงวัน

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@DateBegin` | date |
| `@DateEnd` | date |

---

### `GetEV_DashboardSummaryStatus`
สรุปสถานะ Dashboard ตามช่วงวัน

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@DateBegin` | date |
| `@DateEnd` | date |

---

### `GetEV_DashboardSummaryStatus_Production`
สรุปสถานะ Dashboard เฉพาะส่วน Production

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@DateBegin` | date |
| `@DateEnd` | date |

---

### `GetEV_LocationSummary`
สรุปจำนวนรถแยกตาม Location, Model, Status

**Parameters:** ไม่มี

**Output Columns:**
`Model`, `LocationCode`, `LocationName`, `Status`, `StatusType`, `Total`

**ตัวอย่างผลลัพธ์:**
- Model: ES, Location: ไม่สามารถระบุ location ได้, Status: AVAILABLE, Total: 4
- Model: ES, Location: ไม่สามารถระบุ location ได้, Status: MAINTENANCE, Total: 3

---

## 2. Delivery & Calendar

### `GetEV_DeliveryCalendar` ⭐
ดึงข้อมูลปฏิทินการส่งมอบรถ แยกตาม วัน → Project → Model

**Parameters:**
| ชื่อ | Type | คำอธิบาย |
|---|---|---|
| `@BeginDate` | date | วันเริ่มต้น |
| `@EndDate` | date | วันสิ้นสุด |

**Output Columns:**
`Date`, `Project`, `Model`, `CarCount`

**ตัวอย่างผลลัพธ์:**
```
Date: 2026-06-02, Project: EV7, Model: ES, CarCount: 1
Date: 2026-06-02, Project: EV7, Model: Y Plus 490, CarCount: 3
```

**ตัวอย่างการเรียก:**
```sql
EXEC GetEV_DeliveryCalendar @BeginDate='2026-06-01', @EndDate='2026-06-30'
```

---

### `GetTaxiDeliverySchedule`
ตารางส่งมอบรถ Taxi รายเดือน

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@Month` | int |
| `@Year` | int |

---

## 3. Inventory & Vehicle List

### `GetEV_InventoryItemList`
รายการรถทั้งหมดในระบบ (pagination)

**Parameters:**
| ชื่อ | Type | คำอธิบาย |
|---|---|---|
| `@RegisterNo` | varchar(max) | ทะเบียนรถ (filter) |
| `@Model` | varchar(250) | รุ่นรถ (filter) |
| `@ProcedureStatusID` | int | สถานะ procedure |
| `@BeginDate` | varchar(20) | วันเริ่ม |
| `@EndDate` | varchar(20) | วันสิ้นสุด |
| `@Status` | varchar(250) | สถานะ |
| `@Page` | int | หน้า |
| `@PerPage` | int | จำนวนต่อหน้า |

---

### `GetEV_CommonInventoryItemList`
ค้นหารถทั่วไป

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@RegisterNo` | varchar(50) |
| `@Model` | varchar(250) |
| `@BeginDate` | varchar(20) |
| `@EndDate` | varchar(20) |
| `@Keyword` | varchar(20) |

---

### `GetEV_GroupInventoryItemList`
รายการรถแยกตาม Group

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@GroupID` | int |
| `@SubGroupID` | int |
| `@TextSearch` | varchar(250) |

---

### `GetEV_InventoryItemForAssignList`
รายการรถที่พร้อมสำหรับ Assign งาน

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@GroupID` | int |
| `@SubGroupID` | int |
| `@TextSearch` | varchar(250) |

---

### `GetEV_InventoryMonitor`
ดูข้อมูลสถานะรถ (monitor)

**Parameters:** เหมือน `GetEV_InventoryItemList`

---

### `GetEV_CarInfo`
ข้อมูลรถ 1 คัน ตามทะเบียน

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@RegisterNo` | varchar(50) |

---

### `GetEVItemTrackList`
ติดตามสถานะรถตาม VIN

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@VinNo` | varchar(50) |

---

## 4. Rent & Release

### `GetEV_CarRentList`
รายการรถที่มีสัญญาเช่า (pagination)

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@RegisterNo` | varchar(50) |
| `@Model` | varchar(250) |
| `@StatusType` | varchar(50) |
| `@BeginDate` | varchar(20) |
| `@EndDate` | varchar(20) |
| `@Page` | int |
| `@PerPage` | int |

---

### `GetEV_ApprovedCarRentList`
รายการรถที่อนุมัติสัญญาเช่าแล้ว

**Parameters:** เหมือน `GetEV_CarRentList`

---

### `GetEV_ReleasedCarRentListTable`
รายการรถที่ปล่อยสัญญาเช่าแล้ว (ตาราง, pagination)

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@RegisterNo` | varchar(50) |
| `@Model` | varchar(250) |
| `@BeginDate` | varchar(20) |
| `@EndDate` | varchar(20) |
| `@Page` | int |
| `@PerPage` | int |

---

### `GetEV_ReleasedCarRentListModal`
รายละเอียดรถที่ปล่อยเช่าแล้ว (modal view)

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@InventoryItemID` | bigint |

---

### `GetEV_HistoryReleasedCarRentList`
ประวัติการปล่อยรถเช่า

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@RegisterNo` | varchar(50) |
| `@Model` | varchar(250) |
| `@BeginDate` | varchar(20) |
| `@EndDate` | varchar(20) |
| `@Page` | int |
| `@PerPage` | int |

---

## 5. Maintenance

### `GetEV_CarInMaintenance`
รถที่อยู่ระหว่างซ่อม (pagination)

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@TextSearch` | varchar(50) |
| `@Model` | varchar(250) |
| `@Status` | varchar(100) |
| `@ProcessStatus` | varchar(100) |
| `@Page` | int |
| `@PerPage` | int |

---

### `GetEV_CarInMaintenance_InYard` ⭐
รถซ่อมที่จอดอยู่ใน Yard (237 คัน)

**Parameters:** ไม่มี

**Output Columns:**
`ProjectType`, `RegisterNo`, `VinNo`, `MotorNo`, `Model`, `Exterior_Color`, `Interior_Color`, `StatusName`, `StatusTypeName`, `IncidentDate`, `ReportDate`, `DriverName`, `ProblemTypeDescription`, `FaultParty`, `IssueTitle`, `CarCase`, `RootCauseFound`, `FixAction`, `ServiceLocation`, `MaintenanceStartDate`, `MaintenanceReturnDate`, `MaintenanceFinishDate`, `Insurance`, `LastFollowUpDate`, `FollowUpDetail`, `CarStatusDescription`, `WaitingForRepairDays`, `UsableWaitingDays`, `VinNoReplacement`, `ReplacementStartDate`, `ReplacementReturnDate`

---

### `GetEV_CarInMaintenance_NotInYard`
รถซ่อมที่ยังวิ่งอยู่บนถนน (304 คัน) — ยังขับใช้งานได้แต่มีเรื่องซ่อมค้าง

**Parameters:** ไม่มี  
**Output:** เหมือน `_InYard`

---

### `GetEV_CarInMaintenance_StillWork`
รถซ่อมที่ยังทำงานอยู่ (still work)

**Parameters:** ไม่มี

---

### `GetEV_CarInMaintenance_NotStillWork`
รถซ่อมที่ไม่ได้ทำงานแล้ว

**Parameters:** ไม่มี

---

### `GetEV_HistoryMaintenance`
ประวัติการซ่อมบำรุง (pagination)

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@TextSearch` | varchar(50) |
| `@Model` | varchar(250) |
| `@Status` | varchar(100) |
| `@Page` | int |
| `@PerPage` | int |

---

### `GetEV_AvailableCarForMaintenance`
รถที่พร้อมส่งซ่อม

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@TextSearch` | varchar(50) |
| `@Model` | varchar(250) |
| `@Status` | varchar(100) |
| `@Page` | int |
| `@PerPage` | int |

---

### `GetEV_CarForReplacement`
รถที่พร้อมใช้เป็นรถทดแทน

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@TextSearch` | varchar(50) |
| `@Model` | varchar(250) |
| `@Status` | varchar(100) |
| `@Page` | int |
| `@PerPage` | int |

---

## 6. Replacement

### `GetEv_ReplacementCarDropDown`
รายการ dropdown รถทดแทน (245 คัน)

**Parameters:** ไม่มี

**Output Columns:**
`InventoryItemID`, `VinNo`, `DisplayText`

---

### `GetEV_Report_ReplacementHistory` ⭐
ประวัติการให้รถทดแทน (215 รายการ)

**Parameters:** ไม่มี

**Output Columns:**
`RegisterNo`, `VinNo`, `Model`, `VinNoReplacement`, `ReplacementStartDate`, `ReplacementReturnDate`, `Location`, `Remark`, `IsActive`, `ReplacementStatus`

---

## 7. Return

### `GetEV_ReturnCarDetail`
รายละเอียดการรับคืนรถ 1 คัน

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@RentItemID` | bigint |

---

### `GetEV_ReturnCarHistoryList`
ประวัติการรับคืนรถ (pagination)

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@RegisterNo` | nvarchar(100) |
| `@Model` | nvarchar(100) |
| `@BeginDate` | nvarchar(20) |
| `@EndDate` | nvarchar(20) |
| `@Page` | int |
| `@PerPage` | int |

---

### `GetEV_TerminateContract`
รายการสัญญาที่ถูกยกเลิก (444 รายการ)

**Parameters:** ไม่มี

**Output Columns:**
`ReturnItemID`, `VinNo`, `ContractNo`, `TerminateDate`

---

## 8. Production

### `GetEV_Report_ProductionCar` ⭐
รายงานรถในสายการผลิตทั้งหมด (31,085 รายการ)

**Parameters:** ไม่มี

**Output Columns:**
`InventoryItemID`, `ProjectType`, `RegisterNo`, `VinNo`, `MotorNo`, `Model`, `Exterior_Color`, `Interior_Color`, `ProductionCompleteDate`, `ProductionStatusLabel`, `Remark`, `CurrentLocation`, `PlanID`, `ProcedureStatusID`, `ProcedureName`, `VendorCode`, `VendorName`, `StartDate`, `FinishDate`, `FinishRemark`, `IsActive`

---

### `GetEV_CarFinishedProduction`
รถที่ผลิตเสร็จตามช่วงวัน

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@BeginDate` | datetime |
| `@EndDate` | datetime |

---

### `GetEV_Report_WaitingForGr`
รถรอ GR (Goods Receipt) — 11 คัน

**Parameters:** ไม่มี

**Output Columns:**
`ProjectType`, `RegisterNo`, `VinNo`, `MotorNo`, `Model`, `Exterior_Color`, `Interior_Color`, `StatusName`, `StatusTypeName`, `ProductionCompleteDate`

---

### `GetEV_WaitingForGr`
รายการรถรอ GR (pagination)

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@RegisterNo` | varchar(max) |
| `@Model` | varchar(250) |
| `@StatusType` | varchar(50) |
| `@BeginDate` | varchar(20) |
| `@EndDate` | varchar(20) |
| `@Page` | int |
| `@PerPage` | int |

---

### Production Cycle Time (เวลาเฉลี่ยในการผลิตรถ)

**วิธีคำนวณ**: ดูจาก `StartDate` (วันเริ่มกระบวนการผลิตชิ้นแรก) ถึง `ProductionCompleteDate` (วันผลิตเสร็จสมบูรณ์)

**วิธีที่ 1 — จาก EV_ProductionPlan + EV_InventoryItem:**
```sql
SELECT 
  AVG(DATEDIFF(DAY, StartDate, ProductionCompleteDate)) as AvgProductionDays,
  COUNT(DISTINCT VinNo) as TotalCars
FROM (
  SELECT p.VinNo, MIN(p.StartDate) as StartDate, i.ProductionCompleteDate
  FROM EV_ProductionPlan p
  JOIN EV_InventoryItem i ON p.InventoryItemID = i.InventoryItemID
  WHERE i.ProductionCompleteDate IS NOT NULL 
    AND p.StartDate IS NOT NULL 
    AND p.IsActive = 1
  GROUP BY p.VinNo, i.ProductionCompleteDate
) sub
```

**วิธีที่ 2 — จาก EV_InventoryItem โดยตรง (fallback):**
```sql
SELECT 
  AVG(DATEDIFF(DAY, CreatedDate, ProductionCompleteDate)) as AvgDays
FROM EV_InventoryItem 
WHERE ProductionCompleteDate IS NOT NULL 
  AND CreatedDate IS NOT NULL 
  AND IsActive = 1
```

**วิธีที่ 3 — รัน SP แล้วดูข้อมูลดิบ:**
```sql
EXEC GetEV_Report_ProductionCar
```
ผลลัพธ์จะมี `StartDate`, `FinishDate`, `ProductionCompleteDate` ของแต่ละขั้นตอน (ProcedureName) สามารถนำมาคำนวณ DATEDIFF ได้

**หมายเหตุ:**
- `ProductionCompleteDate` = วันที่รถผลิตเสร็จสมบูรณ์ทุกขั้นตอน
- `StartDate` / `FinishDate` = วันเริ่ม/สิ้นสุดของแต่ละ Procedure (ขั้นตอน)
- `ProcedureName` = ชื่อขั้นตอนการผลิต เช่น ตรวจรถ, ติดฟิล์ม, ติดตั้ง GPS
- `VendorName` = ผู้รับเหมาแต่ละขั้นตอน

---
## 9. Reports

### `GetEV_Report_OnRentCar` ⭐
รายงานรถที่ปล่อยเช่าอยู่ทั้งหมด (2,743 คัน)

**Parameters:** ไม่มี

**Output Columns:**
`ProjectType`, `RegisterNo`, `VinNo`, `Model`, `Exterior_Color`, `Interior_Color`, `StatusName`, `StatusTypeName`, `ContractNo`, `ContractType`, `ContractSignDate`, `FirstName`, `LastName`, `PhoneNo`, `ExpectedReleaseDate`, `ReleaseDate`, `ContractCancellationDate`, `Location`

---

### `GetEV_Report_AvailableCar` ⭐
รายงานรถพร้อมส่งมอบ (431 คัน)

**Parameters:** ไม่มี

**Output Columns:**
`ProjectType`, `RegisterNo`, `VinNo`, `MotorNo`, `Model`, `Exterior_Color`, `Interior_Color`, `StatusName`, `StatusTypeName`, `AvailableDate`

---

### `GetEV_Report_PendingCar`
รายงานรถ Pending (634 คัน)

**Parameters:** ไม่มี

**Output Columns:**
`Project`, `RegisterNo`, `VinNo`, `MotorNo`, `Model`, `Exterior_Color`, `Interior_Color`, `StatusName`, `StatusTypeName`, `Location`, `PurchaseOrder`, `PoReceiveDate`, `ImportToEV7`

---

### `GetEV_Report_AllCarMaintenance` ⭐
รายงานงานซ่อมทั้งหมด (1,031 รายการ)

**Parameters:** ไม่มี

**Output Columns:**
`ProjectType`, `RegisterNo`, `VinNo`, `MotorNo`, `Model`, `Exterior_Color`, `Interior_Color`, `StatusName`, `StatusTypeName`, `IncidentDate`, `ReportDate`, `DriverName`, `ProblemTypeDescription`, `FaultParty`, `IssueTitle`, `CarCase`, `RootCauseFound`, `FixAction`, `ServiceLocation`, `MaintenanceStartDate`, `MaintenanceReturnDate`, `MaintenanceFinishDate`, `Insurance`, `LastFollowUpDate`, `FollowUpDetail`, `CarStatusDescription`, `WaitingForRepairDays`, `UsableWaitingDays`, `VinNoReplacement`, `ReplacementStartDate`, `ReplacementReturnDate`

---

### `GetEV_Report_CompleteCarMaintenance`
รายงานงานซ่อมที่เสร็จแล้ว (490 รายการ)

**Parameters:** ไม่มี  
**Output:** เหมือน `GetEV_Report_AllCarMaintenance`

---

### `GetEVDashboardList`
รายการ Dashboard ตามช่วงวัน

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@BeginDate` | datetime |
| `@EndDate` | datetime |

**Output Columns:**
`ProcedureStatusID`, `StatusName`, `Seq`, `Project`, `VinNo`, `RegisterNo`, `Status`, `Model`, `Exterior_Color`

---

### `GetEV_CheckInsertCarProcedure`
ตรวจสอบการ insert procedure รถ

**Parameters:** ไม่มี

---

### `GetEV_UserProcedureList`
รายการ Procedure ของ User

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@TextSearch` | varchar(250) |

---

## 10. Master Data

### `GetEv_MsModel`
รายการรุ่นรถทั้งหมด (9 รุ่น)

**Parameters:** ไม่มี

**Output Columns:**
`ModelCode`, `ModelName`, `ModelDescription`

**ตัวอย่าง:** ES, Y Plus 490 Premium, Y Plus 410 Premium, ...

---

### `GetEv_MsColor`
รายการสีรถทั้งหมด (33 สี)

**Parameters:** ไม่มี

**Output Columns:**
`ColorCode`, `ColorName`, `ColorDescription`

**ตัวอย่าง:** WTE (White), PWT (Pure White), LGD, ...

---

### `GetEV_MsStatus`
สถานะหลักของรถ (7 สถานะ)

**Parameters:** ไม่มี

**Output Columns:**
`StatusCode`, `StatusName`, `DescriptionStatus`

**รายการสถานะ:**
| Code | Name | Description |
|---|---|---|
| PRODUCTION | In Process Production | อยู่ระหว่างการผลิต |
| AVAILABLE | Available | รถใหม่พร้อมส่ง |
| (อื่นๆ) | ... | ... |

---

### `GetEVMsSubStatus`
Sub-status ของรถ

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@Type` | varchar(max) |

---

### `GetGI_MsSubStatus`
Sub-status สำหรับ GI (Good Inspect)

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@Type` | varchar(max) |

---

## GI (Good Inspect) Procedures

### `GetGI_InventoryItemList`
รายการรถ GI

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@RegisterNo` | varchar(50) |
| `@Model` | varchar(250) |
| `@BeginDate` | varchar(20) |
| `@EndDate` | varchar(20) |
| `@Page` | int |
| `@PerPage` | int |

---

### `GetGI_CompleteInventoryItemList`
รายการรถ GI ที่เสร็จแล้ว

**Parameters:** เหมือน `GetGI_InventoryItemList`

---

### `GetGI_CarProcedurePlanList`
แผนงาน Procedure ของรถ GI

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@GroupID` | int |
| `@SubGroupID` | int |
| `@TextSearch` | varchar(250) |
| `@PlanBeginDate` | date |
| `@PlanEndDate` | date |
| `@Page` | int |
| `@PerPage` | int |
| `@RegisterNo` | varchar(50) |
| `@Model` | varchar(250) |
| `@ProcedureStatusID` | int |

---

### `GetGI_CarProcedurePlanListByUser` / `...ByUserDone`
แผนงานตาม User / ที่เสร็จแล้ว

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@TextSearch` | varchar(250) |
| `@UserId` | int |

---

### `GetGI_CarProcedurePlanListPendingApprove`
แผนงานรอ Approve

**Parameters:**
| ชื่อ | Type |
|---|---|
| `@TextSearch` | varchar(250) |
| `@Page` | int |
| `@PerPage` | int |

---

## ข้อมูลสถิติจริง (ณ วันที่ 12 มิ.ย. 2569)

| ข้อมูล | จำนวน |
|---|---|
| รถทั้งหมด (Active) | 3,118 คัน |
| ปล่อยเช่าอยู่ (On Rent) | 2,743 คัน |
| พร้อมส่งมอบ (Available) | 431 คัน |
| รอดำเนินการ (Pending) | 634 คัน |
| อยู่ระหว่างซ่อม (ใน Yard) | 237 คัน |
| อยู่ระหว่างซ่อม (นอก Yard) | 304 คัน |
| ซ่อมเสร็จแล้ว | 490 คัน |
| ประวัติซ่อมทั้งหมด | 1,031 รายการ |
| รถทดแทน | 215 รายการ |
| สัญญาที่ยกเลิก | 444 รายการ |
| รถในสายการผลิต | 31,085 รายการ |
| รอ GR | 11 คัน |
| บริษัท EV7 | 3,481 คัน |
| บริษัท GI | 779 คัน |

---

## 11. ตารางข้อมูลหลัก (Base Tables)

นอกจาก Stored Procedures แล้ว ระบบยังมีการเรียกข้อมูลตรงจากตารางหลักในฐานข้อมูล `ICI_EVSERVICES` ดังนี้:

### 11.1 ตาราง: `dbo.EV_InventoryItem` (สต็อกรถยนต์)
เก็บข้อมูลรายละเอียดรถและสถานะหลัก
* **คอลัมน์สำคัญ**: `InventoryItemID` (PK), `VinNo` (เลขตัวถัง), `RegisterNo` (เลขทะเบียน), `MotorNo`, `Model`, `Project` (โครงการ เช่น LineMan, Grab), `ProjectType` (เช่น Taxi, Rental), `Company` (EV7 หรือ GI), `Status` (AVAILABLE, ON_RENT, MAINTENANCE, WAITING_FOR_GR, PRODUCTION, REPLACEMENT), `StatusType`, `Exterior_Color`, `Interior_Color`, `IsActive` (bit)

### 11.2 ตาราง: `dbo.EV_RentItem` (สัญญาเช่าและการปล่อยรถ)
เก็บข้อมูลการจองและปล่อยรถ
* **คอลัมน์สำคัญ**: `RentItemID` (PK), `InventoryItemID` (FK -> `EV_InventoryItem`), `ContractNo` (เลขที่สัญญา), `ContractType`, `FirstName` (ชื่อผู้เช่า), `LastName` (นามสกุลผู้เช่า), `PhoneNo`, `ExpectedReleaseDate` (วันนัดส่งมอบ), `ReleaseDate` (วันส่งมอบจริง), `ContractCancellationDate` (วันยกเลิกสัญญา), `IsActive` (bit), `CreateUserID` (ID ผู้บันทึกข้อมูล)

### 11.3 ตาราง: `dbo.EV_MaintenanceItem` (ใบแจ้งซ่อมและสถานะซ่อม)
เก็บประวัติการเคลมและแจ้งซ่อม
* **คอลัมน์สำคัญ**: `MaintenanceItemID` (PK), `InventoryItemID` (FK -> `EV_InventoryItem`), `ReportDate` (วันแจ้งซ่อม), `IncidentDate` (วันเกิดเหตุ), `MaintenanceStartDate` (วันเข้าซ่อมจริง), `MaintenanceFinishDate` (วันซ่อมเสร็จ), `MaintenanceReturnDate` (วันรับรถคืน), `CarStatusCode` (COMPLETE, IN_MAINTENANCE, WAITING_FOR_MAINTENANCE, STILL_WORK), `IssueTitle` (อาการที่แจ้ง), `ProblemTypeCode` (ประเภทปัญหา เช่น PRODUCT, ACCIDENT), `FaultPartyCode` (ฝ่ายผิด เช่น DRIVER, COUNTERPART), `CarCaseCode` (เคสซ่อมเบา/หนัก), `ServiceLocationCode` (อู่ที่เข้าซ่อม), `InsuranceCode`, `FollowUpDetail`, `IsActive` (bit), `CreateUserID` (ID ผู้แจ้งซ่อม/ผู้บันทึก)

### 11.4 ตาราง: `dbo.EV_ReplacementItem` (ประวัติการใช้รถทดแทน)
เก็บประวัติการปล่อยรถทดแทนระหว่างซ่อม
* **คอลัมน์สำคัญ**: `ReplacementItemID` (PK), `MaintenanceItemID` (FK -> `EV_MaintenanceItem`), `VinNo` (เลขตัวถังของรถคันที่นำไปทดแทน), `ReplacementStartDate` (วันที่เริ่มทดแทน), `ReplacementReturnDate` (วันที่คืนรถทดแทน), `Location` (สถานที่รับ/คืน), `Remark`, `IsActive` (bit)

### 11.5 ตาราง: `dbo.EV_ReturnItem` (การคืนรถเช่า)
เก็บประวัติการรับรถกลับเข้าระบบ
* **คอลัมน์สำคัญ**: `ReturnItemID` (PK), `VinNo`, `CustomerName`, `Model`, `ContractNo`, `ReceiveDate`, `ReturnDate`, `Mileage` (เลขไมล์ตอนรับคืน), `ParkLocation` (สถานที่จอดเก็บรถ), `CreateUserID` (ID ผู้บันทึกข้อมูล)

### 11.6 ตาราง: `dbo.EV_DeliveryPlan` (เป้าการส่งมอบรถยนต์ประจำเดือน)
เก็บข้อมูลเป้าการส่งมอบรถ (เป้าประจำเดือน) แยกตามประเภทโครงการและรุ่นรถยนต์
* **คอลัมน์สำคัญ**: `PlanID` (PK, bigint), `PlanDate` (date, วันที่ในแผนการส่งมอบ), `ProjectType` (varchar(20), ประเภทโครงการ เช่น EV7, Grab, Line Man), `ES_Count` (int, จำนวนแผนส่งมอบของรุ่น MG ES), `Y490_Count` (int, จำนวนแผนส่งมอบของรุ่น GAC AION Y Plus 490), `Y410_Count` (int, จำนวนแผนส่งมอบของรุ่น GAC AION Y Plus 410)
* **สำคัญ: การดึงข้อมูลต้องเป็นรายเดือนเสมอ** โดยใช้ `WHERE YEAR(PlanDate) = @targetYear AND MONTH(PlanDate) = @targetMonth` แล้ว SUM ยอดรวม (ห้ามดึงรายวัน `WHERE PlanDate = @date`)
* **คำที่ใช้เรียก**: ยอดจาก EV_DeliveryPlan เรียกว่า **"เป้าประจำเดือน"** (ห้ามเรียกว่า "แผนทั้งหมด" หรือ "แผนรายวัน")
* **Query ตัวอย่าง** (ดึงเป้ารายเดือนรวมทุกโครงการ):
```sql
SELECT ProjectType,
  SUM(ISNULL(ES_Count, 0)) AS ES_Count,
  SUM(ISNULL(Y490_Count, 0)) AS Y490_Count,
  SUM(ISNULL(Y410_Count, 0)) AS Y410_Count
FROM dbo.EV_DeliveryPlan
WHERE YEAR(PlanDate) = @targetYear AND MONTH(PlanDate) = @targetMonth
GROUP BY ProjectType
```

### 11.7 ตาราง: `dbo.EV_MsStatus` (มาสเตอร์สถานะรถยนต์)
เก็บข้อมูลคำแปลและรายละเอียดของสถานะหลักรถยนต์
* **คอลัมน์สำคัญ**: `StatusCode` (PK, รหัสสถานะหลัก เช่น PRODUCTION, AVAILABLE, ON_RENT, MAINTENANCE, REPLACEMENT, WAITING_FOR_GR), `StatusName` (ชื่อภาษาอังกฤษ เช่น In Process Production, Available, On Rent), `DescriptionStatus` (ชื่อคำอธิบายภาษาไทย เช่น อยู่ระหว่างการผลิต, รถใหม่พร้อมส่ง, อยู่ระหว่างเช่า, อยู่ระหว่างซ่อม)

### 11.8 ตาราง: `dbo.EV_MsSubStatus` (มาสเตอร์สถานะย่อยรถยนต์)
เก็บข้อมูลคำแปลและรายละเอียดของสถานะย่อยของรถยนต์ เพื่อใช้ตรวจสอบความแตกต่าง เช่น รถใหม่ (AVAILABLE) หรือ รถใช้แล้ว/รถเก่า (AVAILABLE_USE)
* **คอลัมน์สำคัญ**: `SubStatusID` (PK, varchar), `StatusCode` (รหัสสถานะย่อย เช่น AVAILABLE, AVAILABLE_USE, RESERVE, NEW_MAINTENANCE, USE_MAINTENANCE), `StatusName` (ชื่ออังกฤษ เช่น Available New, Available Use, Reserve), `DescriptionStatus` (ชื่อคำอธิบายภาษาไทย เช่น รถใหม่ยังไม่ทำสัญญา, รถใช้เเล้วยังไม่ทำสัญญา, รถที่ถูกจอง), `Type` (ประเภท เช่น STATUS_TYPE_AVAILABLE, STATUS_TYPE_MAINTENANCE), `IsActive` (bit)

### 11.9 ตารางข้อมูลระบบ LINE Bot & Admin Portal (PostgreSQL via Prisma)
ใช้จัดเก็บสถานะบอต การบันทึกปัญหา การลงทะเบียน และ Log การสนทนา
* **ตาราง: `line_registrations` (การลงทะเบียนบัญชี LINE)**
  * คอลัมน์สำคัญ: `id` (PK, Serial), `line_user_id` (Unique, varchar(50)), `display_name` (varchar(255)), `picture_url` (text), `status_message` (varchar(255)), `system` (varchar(50), default 'EV7'), `is_active` (boolean, default true), `role` (varchar(20), default 'USER' - สิทธิ์การเข้าใช้งาน: 'USER' | 'ADMIN' | 'SUPER_ADMIN'), `registered_at` (timestamptz), `updated_at` (timestamptz)
* **ตาราง: `system_issues` (ประวัติการแจ้งบัคและปัญหา)**
  * คอลัมน์สำคัญ: `id` (PK, Serial), `line_user_id` (varchar(50)), `display_name` (varchar(255)), `description` (text), `status` (varchar(20), default 'OPEN' - 'OPEN' | 'RESOLVED' | 'CANCELLED'), `source_type` (varchar(20)), `source_id` (varchar(50)), `created_at` (timestamptz), `resolved_at` (timestamptz)
* **ตาราง: `chat_logs` (บันทึกการคุยของบอต)**
  * คอลัมน์สำคัญ: `id` (PK, Serial), `source_type` (varchar(20)), `source_id` (varchar(50)), `user_name` (varchar(255)), `user_message` (text), `bot_reply` (text), `created_at` (timestamptz)
* **ตาราง: `line_groups` (ข้อมูลกลุ่มที่ลงทะเบียนบอต)**
  * คอลัมน์สำคัญ: `id` (PK, Serial), `group_id` (Unique, varchar(50)), `group_name` (varchar(255)), `group_type` (varchar(20), default 'group'), `is_active` (boolean, default true), `enable_report` (boolean, default false), `created_at` (timestamptz), `updated_at` (timestamptz)
* **ตาราง: `activity_notifications` (ข้อมูลการแจ้งเตือนงานซ่อม/ส่งมอบ)**
  * คอลัมน์สำคัญ: `id` (PK, Serial), `record_type` (varchar(30) - 'MAINTENANCE' | 'DELIVERY' | 'RETURN'), `record_id` (int), `sent_at` (timestamptz)

### 11.10 ตาราง: `dbo.EV_MaintenanceFollowUp` (ประวัติการติดตามงานซ่อม/การแจ้งซ่อม)
เก็บข้อมูลประวัติการติดตามผล รายละเอียด และความคืบหน้าของงานซ่อม
* **คอลัมน์สำคัญ**: `MaintenanceFollowUpID` (PK, bigint), `MaintenanceItemID` (FK -> `EV_MaintenanceItem`), `FollowUpDate` (date, วันที่ติดตามผล), `FollowUpDetail` (varchar(max), รายละเอียดการติดตาม), `IsActive` (bit, แฟล็กสถานะ), `CreateDate` (datetime, วันที่สร้าง), `CreateUserID` (int, ID ผู้สร้าง), `UpdateDate` (datetime), `UpdateUserID` (int)

### 11.11 Views สำหรับการตรวจสอบการปล่อยรถและแยกรถใหม่/รถมือสอง
* **View: `dbo.View_AccumarateReleaseCar` (การปล่อยสะสม)**
  * ใช้ดึงข้อมูลการปล่อยรถสะสมย้อนหลังทั้งหมดประจำวันหรือประจำเดือน โดยไม่สนใจว่าภายหลังจะมีการคืนหรือแจ้งซ่อม
  * คอลัมน์สำคัญ: `RentItemID`, `InventoryItemID`, `RentStatusID`, `VinNo`, `ContractNo`, `ReleaseDate`, `ExpectedReleaseDate`, `RentType` (ค่าระบุประเภทรถเช่า ได้แก่ `ONRENT_NEW` สำหรับรถใหม่, `ONRENT_USE` สำหรับรถมือสอง)
* **View: `dbo.View_GetOnrentNewOrUse` (การแยกรถเช่า Realtime)**
  * ใช้ตรวจสอบสถานะเช่าแล้วแบบ Real-time (เฉพาะที่เป็นสถานะ ON_RENT) ว่าเป็นรถใหม่หรือรถเก่า
  * คอลัมน์สำคัญ: `ProjectType`, `VinNo`, `Model`, `ContractNo`, `FirstName`, `LastName`, `ReleaseDate`, `RentType` (ค่าระบุประเภท ได้แก่ `ONRENT_NEW` หรือ `ONRENT_USE`)

---

## 12. ความสัมพันธ์และเงื่อนไขการ Query
* **การเชื่อมตาราง**:
  * `EV_RentItem.InventoryItemID` ➔ `EV_InventoryItem.InventoryItemID`
  * `EV_MaintenanceItem.InventoryItemID` ➔ `EV_InventoryItem.InventoryItemID`
  * `EV_ReplacementItem.MaintenanceItemID` ➔ `EV_MaintenanceItem.MaintenanceItemID`
  * `EV_MaintenanceFollowUp.MaintenanceItemID` ➔ `EV_MaintenanceItem.MaintenanceItemID`
  * `EV_InventoryItem.Status` ➔ `EV_MsStatus.StatusCode` (เพื่อดึงคำแปลภาษาไทยของสถานะรถคันนั้นจากคอลัมน์ `DescriptionStatus`)
  * `EV_InventoryItem.StatusType` ➔ `EV_MsSubStatus.StatusCode` (ดึงชื่อคำอธิบายภาษาไทยของสถานะย่อย เช่น เพื่อระบุว่ารถเป็นรถใหม่หรือรถเก่าจากคอลัมน์ `DescriptionStatus` โดยควรกรองด้วยเงื่อนไข `sub.Type LIKE 'STATUS_TYPE_%'`)
  * `EV_ReturnItem.CreateUserID` ➔ `EV_User.UserID` (เพื่อดึงชื่อผู้บันทึกข้อมูลย้อนกลับ โดยใช้ `FirstName` หรือ fallback ไปยัง `UserName`)
  * `EV_RentItem.CreateUserID` ➔ `EV_User.UserID` (เพื่อดึงชื่อผู้ปล่อยรถ/ทำสัญญาส่งมอบ โดยใช้ `FirstName` หรือ fallback ไปยัง `UserName`)
  * `EV_MaintenanceItem.CreateUserID` ➔ `EV_User.UserID` (เพื่อดึงชื่อผู้แจ้งซ่อม/ผู้บันทึกรายการแจ้งซ่อม โดยใช้ `FirstName` หรือ fallback ไปยัง `UserName`)
  * `EV_MaintenanceFollowUp.CreateUserID` ➔ `EV_User.UserID` (เพื่อดึงชื่อผู้บันทึกความคืบหน้าการติดตามผล โดยใช้ `FirstName` หรือ fallback ไปยัง `UserName`)

* **เงื่อนไขคิวรี (สำคัญ)**:
  * ในการ Query ทุกตาราง **ต้องใส่เงื่อนไข `IsActive = 1` เสมอ** เพื่อดึงเฉพาะรายการที่ยังไม่ถูกยกเลิกหรือลบ **(ยกเว้นตาราง `dbo.EV_MaintenanceItem` สำหรับรายการที่ซ่อมเสร็จแล้วหรือปิดเคสซ่อมแล้ว ซึ่งในฐานข้อมูลจะบันทึกเป็น `IsActive = 0` ส่วนงานที่ยังซ่อมค้างอยู่จะมี `IsActive = 1` ดังนั้นเวลา Query ข้อมูลรถที่ซ่อมเสร็จสิ้นหรือประวัติการซ่อมที่ปิดเรียบร้อยแล้ว ให้กรองด้วยเงื่อนไข `IsActive = 0` แทน)**
  * หากรถยังไม่มีเลขทะเบียน (`RegisterNo` เป็น NULL หรือค่าว่าง) ให้ใช้ `VinNo` ในการระบุและแสดงผลแทนทะเบียนรถเสมอ
  * การนับจำนวนการปล่อยเช่าสำเร็จ (**Completed Delivery**): จะนับเมื่อมีข้อมูล `r.ReleaseDate IS NOT NULL` เท่านั้น หากยังไม่มีข้อมูลวันส่งมอบจริงจะถูกนับเป็นรอดำเนินการ (**Pending**) ทั้งนี้แม้รถจะกลับมาเข้าซ่อมและมีสถานะเป็น `MAINTENANCE` ในภายหลัง ก็ยังถือว่าการส่งมอบสำเร็จแล้ว
  * **การตรวจสอบประเภทรถใหม่/รถเก่า (รถมือสอง)**: เพื่อความถูกต้องและประสิทธิภาพ ให้ใช้ View แทนการอ้างอิงจากตารางหลักตรงๆ หรือเขียนคิวรีย้อนหลังเอง:
    * **กรณีเช็คสถานะปัจจุบันแบบ Real-time (เมื่อรถอยู่ในสถานะ `ON_RENT`)**: ให้ดึงค่า `RentType` (แบ่งเป็น `ONRENT_NEW` สำหรับรถใหม่, `ONRENT_USE` สำหรับรถมือสอง) จาก View `dbo.View_GetOnrentNewOrUse` โดยตรงตามเงื่อนไข `VinNo` หรือ `ContractNo` เช่น:
      ```sql
      SELECT r.ContractNo, r.FirstName, r.LastName, r.ReleaseDate,
             ISNULL(o.RentType, 'ONRENT_NEW') AS RentType
      FROM dbo.EV_RentItem r
      LEFT JOIN dbo.View_GetOnrentNewOrUse o ON r.ContractNo = o.ContractNo
      WHERE r.InventoryItemID = <id> AND r.IsActive = 1
      ```
    * **กรณีดึงข้อมูลการปล่อยรถสะสมย้อนหลังทั้งหมดประจำวันหรือประจำเดือน (การนับจำนวนการปล่อยรถสะสม)**: ให้ดึงข้อมูลและ `RentType` จาก View `dbo.View_AccumarateReleaseCar` โดยตรง เช่น:
      ```sql
      SELECT RentType, COUNT(*) as cnt
      FROM dbo.View_AccumarateReleaseCar
      WHERE IsActive = 1
        AND ReleaseDate >= '2026-06-01' AND ReleaseDate <= '2026-06-30'
      GROUP BY RentType
      ```
  * **หลีกเลี่ยงชื่อคอลัมน์ทับซ้อน (Column Naming Conflicts/Shadowing)**:
    เนื่องจากตารางใบแจ้งซ่อม `EV_MaintenanceItem` มีคอลัมน์ชื่อ `CarStatusCode` (เช่น STILL_WORK, IN_MAINTENANCE) หากมีการเชื่อมกับตาราง `EV_InventoryItem` เพื่อดึงสถานะตัวรถ (เช่น MAINTENANCE, ON_RENT) ให้ตั้งชื่อนามแฝง (Alias) ของสถานะตัวรถเป็นอย่างอื่น เช่น `i.Status AS CarInventoryStatusCode` แทนการใช้ `CarStatusCode` เพื่อไม่ให้เขียนทับค่าสถานะการซ่อมใน Object ผลลัพธ์

---

## 13. แนวทางการออกแบบ Query สำหรับประสิทธิภาพที่ดี (Performance Optimization Guidelines)

ในการเขียนโค้ดเชื่อมต่อฐานข้อมูล SQL Server ในอนาคต ให้ยึดหลักเกณฑ์ความเร็วประสิทธิภาพดังนี้:

### 13.1 หลีกเลี่ยงการรอคิวคำสั่งแบบ Sequential Await
หากมีคำสั่ง SQL หลายคำสั่งที่เป็นอิสระต่อกัน (ไม่ได้ขึ้นต่อผลลัพธ์ของกันและกัน) **ห้ามเขียน `await` ทีละคิวรี** เพราะจะทำให้เกิด Latency สะสม (เช่น 4 คิวรี คิวรีละ 100ms จะกลายเป็น 400ms)
* **❌ แบบไม่ดี (ช้า):**
  ```typescript
  const result1 = await pool.request().query('SELECT ...')
  const result2 = await pool.request().query('SELECT ...')
  ```
* **✅ แบบที่ดี (เร็วมาก):**
  ```typescript
  const req1 = pool.request()
  const req2 = pool.request()
  const [res1, res2] = await Promise.all([
    req1.query('SELECT ...'),
    req2.query('SELECT ...')
  ])
  ```

### 13.2 การนำ Connection Pool กลับมาใช้ซ้ำ (Connection Pool Caching)
ในไฟล์ `lib/mssql.ts` ได้จัดเก็บ Instance ของ Connection Pool ไว้ในระดับ Global (`let pool: sql.ConnectionPool | null = null`) และตรวจสอบทุกครั้งก่อนสร้างการเชื่อมต่อใหม่:
```typescript
if (pool && pool.connected) return pool
pool = await sql.connect(config)
```
การทำเช่นนี้จะลด overhead ในการสร้าง TCP Handshake ใหม่กับ SQL Server ในทุก ๆ HTTP Request ได้อย่างมหาศาล

### 13.3 จำกัดจำนวนแถวการแสดงผล (TOP N Limitation)
สำหรับตารางการแสดงผลข้อมูลประวัติหรือลิสต์รายการ (เช่น รายการแจ้งซ่อม หรือรายการปล่อยรถ) ให้ใช้ `TOP 200` หรือ `TOP 500` เสมอ เพื่อป้องกันไม่ให้คำสั่งคิวรีดึงข้อมูลปริมาณมหาศาลกลับมาทั้งหมดในครั้งเดียว ซึ่งเป็นสาเหตุหลักที่ทำให้ API หน่วงและส่งผลกระทบต่อหน่วยความจำของแอปพลิเคชัน

---

## 14. กฎทางธุรกิจและสถานะการซ่อมบำรุงรถ (Maintenance Status Workflow)

ในการปรับปรุงข้อมูลการแจ้งซ่อมและสถานะรถ ให้ใช้กฎทางธุรกิจ (Business Rules) ดังนี้เพื่อรักษาความถูกต้องและเชื่อมโยงกันระหว่างตาราง `dbo.EV_MaintenanceItem` และ `dbo.EV_InventoryItem`

### 14.1 การล้างตัวอักษรพิเศษ / Emoji ก่อนบันทึก
* หลีกเลี่ยงการบันทึก Emoji (เช่น 🟡, 🔴, 🟢) ลงในฟิลด์บันทึกติดตามผล (`FollowUpDetail`) ในฐานข้อมูล เนื่องจากบาง SQL Server instance ไม่รองรับ Unicode Emoji และอาจทำให้บันทึกเป็นเครื่องหมายคำถามคู่ `??` ให้ใช้ข้อความปกติ เช่นขึ้นต้นด้วย **"ระบบอัพเดต :"** แทน

### 14.2 การแปลงรูปแบบวันที่สำหรับ MSSQL
* เมื่อรับค่า datetime-local จากหน้าเว็บ (รูปแบบ `YYYY-MM-DDTHH:MM`) ต้องแปลงให้อยู่ในรูปแบบที่ MSSQL รองรับก่อนบันทึกเสมอ (แทนที่ `T` ด้วยช่องว่าง และเติมวินาที `:00`)
```typescript
const toMssqlDate = (d: string | null | undefined): string | null => {
  if (!d) return null
  let result = d.replace('T', ' ')
  if (result.split(':').length === 2) result += ':00'
  return result
}
```

### 14.3 กฎการเปลี่ยนสถานะใบงานแจ้งซ่อม และสถานะตัวรถ (EV_InventoryItem)
เมื่อผู้ใช้งานดำเนินการบันทึกสถานะงานซ่อม ระบบจะทำงานดังนี้:

#### ก. เมื่อเริ่มซ่อม (IN_MAINTENANCE)
* ปรับปรุงตาราง `EV_MaintenanceItem` ของใบงานนั้น:
  * `CarStatusCode` = `'IN_MAINTENANCE'`
  * `MaintenanceStartDate` = วันที่เริ่มซ่อม
  * `ServiceLocationCode` และ `ServiceLocationName` = รหัสและชื่อสถานที่จัดเก็บรถ/อู่

#### ข. เมื่อซ่อมเสร็จสิ้น (COMPLETE)
1. **ตรวจสอบความปลอดภัยการอัปเดตตัวรถ (`EV_InventoryItem`)**:
   * จะทำการอัปเดตสถานะตัวรถได้ ก็ต่อเมื่อ **"ไม่มีใบงานซ่อมค้าง (Pending) หรืองานอื่นคงเหลืออยู่สำหรับรถคันนี้แล้ว"** (โดยเช็คว่า `COUNT(ใบงานค้างที่มี CarStatusCode NOT IN ('COMPLETE', 'READY_PICKUP_MAINTENANCE')) = 0`)
   * หากยังมีใบงานอื่นของรถคันเดียวกันค้างซ่อมอยู่แม้แต่ใบเดียว ให้ปรับเฉพาะสถานะใบงานใน `EV_MaintenanceItem` เท่านั้น และ **ห้ามอัปเดต** ข้อมูลในตาราง `EV_InventoryItem` เด็ดขาด

2. **กฎการปรับสถานะใบงานและสถานะตัวรถตาม `StatusType` ของรถ**:
   หากผ่านเงื่อนไขไม่มีใบงานค้างแล้ว ให้ปรับปรุงตามตารางจับคู่ (Mapping) ด้านล่างนี้:

| `StatusType` ปัจจุบันของรถ | การอัปเดตใบงาน (`EV_MaintenanceItem`) | การอัปเดตตัวรถ (`EV_InventoryItem`) |
|---|---|---|
| **`ON_RENT_MAINTENANCE`** | `CarStatusCode` = `'READY_PICKUP_MAINTENANCE'` | **ไม่ต้องแก้ไขตัวรถ** (คงสถานะ `ON_RENT` ไว้เหมือนเดิม) |
| **`USE_MAINTENANCE`** | `CarStatusCode` = `'COMPLETE'` | ปรับ `Status` = `'AVAILABLE'` และ `StatusType` = `'AVAILABLE_USE'` |
| **`NEW_MAINTENANCE`** | `CarStatusCode` = `'COMPLETE'` | ปรับ `Status` = `'AVAILABLE'` และ `StatusType` = `'AVAILABLE'` |
| **`REPLACEMENT_MAINTENANCE`** | `CarStatusCode` = `'COMPLETE'` | ปรับ `Status` = `'REPLACEMENT'` และ `StatusType` = `'REPLACEMENT_AVAILABLE'` |

*(หมายเหตุ: ทุกการอัปเดตต้องระบุ `UpdateUserID` และตั้งค่า `UpdateDate = GETDATE()` ด้วยเสมอ)*

#### ค. เมื่อมีการสร้างใบงานแจ้งซ่อมใหม่ (New Ticket)
หากรถมีใบงานเก่าค้างอยู่ในสถานะ **`READY_PICKUP_MAINTENANCE`** (ซ่อมเสร็จ/รอปล่อย) แล้วมีการสร้างใบงานใหม่สำหรับรถคันนี้:
* **หากใบใหม่มีสถานะเป็น `STILL_WORK`**: ระบบจะไม่ทำการอัปเดตใบเก่า (ปล่อยใบเก่าไว้รอรับรถตามปกติ)
* **หากใบใหม่มีสถานะเป็น `WAITING_FOR_MAINTENANCE` หรือ `IN_MAINTENANCE`**:
  * ระบบจะทำการ **อัปเดตใบเก่าให้เป็น `COMPLETE` โดยอัตโนมัติ** (เนื่องจากถือว่ากระบวนการซ่อมของรอบก่อนหน้านั้นเสร็จสิ้นอย่างเป็นทางการแล้ว และกำลังเริ่มจอดซ่อมรอบใหม่)
  * ระบบจะอัปเดตเฉพาะสถานะ `CarStatusCode` และวันเวลาอัปเดต โดยจะ **ไม่ทับค่า `MaintenanceFinishDate`** ที่เป็นวันเสร็จงานเดิม พร้อมทั้งบันทึก Log การติดตามผล (Follow-Up) ระบุเหตุผลปิดงานอัตโนมัติไว้

### 14.4 การปิดเคสแจ้งซ่อม (Close Case) และการคืนค่าสถานะรถบำรุง
เมื่อผู้ใช้ที่มีสิทธิ์ระดับ `ADMIN` หรือ `SUPER_ADMIN` กดปุ่ม **"ปิดเคส"** บนระบบ LIFF:
1. **การอัปเดตใบงานแจ้งซ่อม (`EV_MaintenanceItem`)**:
   - อัปเดต `CarStatusCode` = `'COMPLETE'`
   - อัปเดต `MaintenanceFinishDate` = วันซ่อมเสร็จ (ที่ระบุ)
   - อัปเดต `MaintenanceReturnDate` = วันรับรถกลับ (ที่ระบุ)
   - อัปเดต `RootCauseFound` = สรุปสาเหตุที่พบ (ถ้ามี)
   - อัปเดต `FixAction` = สรุปการแก้ไข (ถ้ามี)
2. **การอัปเดตไฟล์แนบ**:
   - รูปภาพ/ไฟล์แนบปิดเคสจะถูกลงทะเบียนใน `dbo.FileAttachment` และ `dbo.EV_FileAttachmentMaintenanceItem` โดยใช้ `ReferenceType = 'MAINTENANCE_COMPLETED'` และ `ProcessType = 'MAINTENANCE_COMPLETED'`
3. **การคืนค่าข้อมูลรถทดแทน (`EV_ReplacementItem`) และคืนสถานะรถทดแทน (`EV_InventoryItem`)**:
   - หากใบแจ้งซ่อมนั้นมีรถทดแทนที่ใช้งานอยู่ (`IsActive = 1` และ `ReplacementReturnDate IS NULL`) ระบบจะทำการบันทึกคืนรถทดแทน โดยอัปเดต:
     - `ReplacementReturnDate` = วันที่คืนรถทดแทน
     - `Location` = จุดคืนรถทดแทน
   - **เมื่อระบุวันคืนรถทดแทนแล้ว** ระบบจะอัปเดตสถานะของรถทดแทนคันนั้นใน `dbo.EV_InventoryItem` ให้กลับไปเป็น `Status = 'REPLACEMENT'` และ `StatusType = 'REPLACEMENT_AVAILABLE'` อัตโนมัติ เพื่อให้รถทดแทนพร้อมใช้งานสำหรับเคสอื่นต่อไป
4. **การอัปเดตสถานที่ปัจจุบันของรถ (`EV_InventoryItem`)**:
   - ทุกครั้งที่มีการบันทึกสถานที่หรือเปลี่ยนพิกัดรถ (ทั้งในขั้นตอน **เข้าซ่อม / Park**, **เริ่มซ่อม / Start** หรือ **ปิดเคส / Complete**) ระบบจะทำการอัปเดตฟิลด์ `CurrentLocation` ในตาราง `dbo.EV_InventoryItem` ให้เป็นสถานที่/พิกัดล่าสุดที่เลือกมาเสมอ
5. **การคืนค่าสถานะตัวรถ (`EV_InventoryItem`)**:
   - หากตรวจเช็คแล้วไม่มีใบงานอื่นค้างซ่อมบำรุงอยู่เลย (`CarStatusCode NOT IN ('COMPLETE', 'READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE')`) ระบบจะคืนค่าสถานะของตัวรถใน `dbo.EV_InventoryItem` (ฟิลด์ `Status` และ `StatusType`) ตามตาราง Mapping ด้านล่างนี้:

| `StatusType` ปัจจุบันของรถ | การคืนค่าสถานะตัวรถ (`EV_InventoryItem`) |
|---|---|
| **`NEW_MAINTENANCE`** | ปรับ `Status` = `'AVAILABLE'` และ `StatusType` = `'AVAILABLE'` |
| **`USE_MAINTENANCE`** | ปรับ `Status` = `'AVAILABLE'` และ `StatusType` = `'AVAILABLE_USE'` |
| **`ON_RENT_MAINTENANCE`** | ปรับ `Status` = `'ON_RENT'` และ `StatusType` = `NULL` |
| **`REPLACEMENT_MAINTENANCE`** | ปรับ `Status` = `'REPLACEMENT'` และ `StatusType` = `'REPLACEMENT_AVAILABLE'` |

### 14.5 เวลาในฐานข้อมูล — SQL Server vs PostgreSQL (Prisma)
* **SQL Server (MSSQL)**: ใช้ `GETDATE()` ซึ่งคืนค่า **เวลาไทย (UTC+7)** โดยตรง (เครื่อง Server ตั้ง timezone เป็น Bangkok)
* **PostgreSQL (Prisma)**: เก็บ timestamp เป็น **UTC** เสมอ — Prisma จะแปลง `new Date()` เป็น UTC ก่อนบันทึก
* **ห้ามใช้ logic เดียวกัน** ในการอ่านเวลาจากทั้งสองฐานข้อมูล:
  - ข้อมูลจาก SQL Server → ใช้ `getUTC*()` อ่านตรง ๆ (เพราะค่าในฐานข้อมูลเป็นเวลาไทยอยู่แล้ว)
  - ข้อมูลจาก PostgreSQL/Prisma → ใช้ `toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })` หรือ local getters ปกติ (เพราะค่าเป็น UTC ต้องแปลงเป็นเวลาไทย)
* **ห้ามแปลง timezone ซ้ำ** กับข้อมูลจาก SQL Server — ถ้าใช้ `toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })` จะทำให้เวลาเร็วไป 7 ชั่วโมง (บวก +7 ซ้ำ)
* **วิธีที่ถูกต้อง**: ใช้ `getUTC*()` methods ของ JavaScript `Date` object เพื่ออ่านค่าวันเวลาตรง ๆ ตามที่ SQL Server ส่งมา โดยไม่ต้องแปลง timezone เพิ่ม
```typescript
// ✅ ถูกต้อง — อ่านค่าตรง ๆ จาก SQL Server (เวลาไทยอยู่แล้ว)
const d = new Date(isoString)
const hour = d.getUTCHours()  // ไม่แปลง timezone ซ้ำ

// ❌ ผิด — แปลง timezone ซ้ำ ทำให้เร็วไป 7 ชม.
new Date(isoString).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
```
* **⚠️ ข้อควรระวัง: การสร้างเวลาปัจจุบันฝั่ง Client (Browser)**
  - `formatLiffTime()` ใช้ `getUTC*()` ซึ่งออกแบบมาสำหรับข้อมูลจาก SQL Server (เวลาไทยอยู่แล้ว) เท่านั้น
  - **ห้ามใช้** `new Date().toISOString()` กับ `formatLiffTime()` เพราะ `toISOString()` คืนค่า UTC → `getUTCHours()` จะได้เวลาช้าไป 7 ชม.
  - **วิธีที่ถูกต้อง**: ถ้าต้องการแสดง "เวลาตอนนี้" เป็นภาษาไทย ให้ใช้ local getters ตรง ๆ
```typescript
// ✅ ถูกต้อง — สร้างเวลาปัจจุบัน (เวลาไทยจาก browser)
const now = new Date()
const day = now.getDate()         // ใช้ getDate() ไม่ใช่ getUTCDate()
const hour = now.getHours()       // ใช้ getHours() ไม่ใช่ getUTCHours()

// ❌ ผิด — toISOString() เป็น UTC แล้วเอาไปใช้กับ getUTC* จะได้เวลา UTC ไม่ใช่เวลาไทย
const closeDateText = formatLiffTime(new Date().toISOString())
```

### 14.5 สิทธิ์การเชื่อมต่อฐานข้อมูล (Database Connection Users)
* **`user_readonly`**: ใช้สำหรับการอ่านข้อมูลเท่านั้น (Read-only) — ใช้ใน `getMSSQLPool()` พร้อมตั้งค่า `readOnlyIntent: true`
* **`app_butter`**: ใช้สำหรับการเขียนข้อมูล (Read/Write) — ใช้ใน `getMSSQLWritePool()` — มีสิทธิ์ **INSERT, UPDATE, DELETE** บนทุกตาราง รวมถึง `dbo.EV_User`
* **ข้อสำคัญ**: เมื่อต้องการเขียนข้อมูล (เช่น สร้างผู้ใช้ใหม่, อัปเดตงานซ่อม) ต้องใช้ `getMSSQLWritePool()` เสมอ ห้ามใช้ `getMSSQLPool()` เพราะจะโดน Permission Denied

### 14.6 ตาราง EV_MsSubStatus — ประเภท (Type) ที่ใช้งาน
ตาราง `dbo.EV_MsSubStatus` ใช้เก็บ dropdown options หลายประเภทตามค่าในคอลัมน์ `Type`:

| Type | คำอธิบาย | ตัวอย่าง StatusCode |
|---|---|---|
| `STATUS_TYPE_AVAILABLE` | สถานะย่อยของรถพร้อมส่ง | `AVAILABLE`, `AVAILABLE_USE`, `RESERVE` |
| `STATUS_TYPE_MAINTENANCE` | สถานะย่อยของรถซ่อม | `NEW_MAINTENANCE`, `USE_MAINTENANCE` |
| `MAINTENANCE_CAR_STATUS` | สถานะงานซ่อมบำรุง | `IN_MAINTENANCE`, `STILL_WORK`, `WAITING_FOR_MAINTENANCE` |
| `INSURANCE` | รายชื่อบริษัทประกันภัย | `ICARE_INSURANCE`, `MUANGTHAI_INSURANCE`, `NO_INSURANCE` |
| `MAINTENANCE_PROBLEM_TYPE` | ประเภทปัญหา (งานซ่อม) | `PRODUCT`, `ACCIDENT` |
| `FAULT_PARTY` | ฝ่ายที่ผิด | `DRIVER`, `COUNTERPART` |
| `CAR_CASE` | เคสงานซ่อม | (เบา/หนัก) |

* **การเพิ่ม dropdown option ใหม่**: เพียงแค่ INSERT ข้อมูลลงตาราง `EV_MsSubStatus` ด้วย `Type` ที่ต้องการ ระบบจะดึงมาแสดงใน dropdown อัตโนมัติโดยไม่ต้องแก้โค้ด
* **Query ตัวอย่าง**:
```sql
SELECT StatusCode, StatusName 
FROM dbo.EV_MsSubStatus
WHERE Type = 'INSURANCE' AND IsActive = 1
ORDER BY StatusCode
```

### 14.7 การจัดการสถานะงานซ่อมสำหรับ LINE Bot (น้อง Butter)
เมื่อ LINE Bot หรือส่วนงานอื่น ๆ ต้องการอ่านคำอธิบายและแสดงสัญลักษณ์ของสถานะใบงานแจ้งซ่อมบำรุง ให้ยึดหลักเกณฑ์ความถูกต้องดังนี้:

1. **ดึงคำอธิบายสถานะตรงจาก Master Table (ไม่ Hardcode)**:
   เชื่อมโยงตารางใบแจ้งซ่อม `EV_MaintenanceItem` เข้ากับตาราง `EV_MsSubStatus` (เงื่อนไข `Type = 'MAINTENANCE_CAR_STATUS'`) เสมอ เพื่อให้ได้คำอธิบายที่ตรงตามที่แอดมินตั้งค่าไว้ในระบบ
   ```sql
   LEFT JOIN dbo.EV_MsSubStatus sub 
     ON m.CarStatusCode = sub.StatusCode 
     AND sub.Type = 'MAINTENANCE_CAR_STATUS'
   ```

2. **การจับคู่สัญลักษณ์สีตามกลุ่มสถานะหลัก**:
   เพื่อการนำเสนอแบบ Visual Indicator (เช่น ใน Flex Message ของ LINE) ให้จัดกลุ่มแสดงผลตามรหัสสถานะ `CarStatusCode` ดังนี้:
   * **กลุ่มไฟเขียว 🟢 (พร้อมใช้งาน / ปกติ)**:
     * `STILL_WORK` (รถยังขับใช้งานได้อยู่)
     * `READY_PICKUP_MAINTENANCE` (ซ่อมเสร็จแล้ว/พร้อมรับรถ)
     * `COMPLETE` (ปิดเคสแล้ว)
   * **กลุ่มไฟแดง 🔴 (งดใช้งาน / เข้าซ่อม)**:
     * `IN_MAINTENANCE` (รถอยู่ระหว่างซ่อม)
   * **กลุ่มไฟเหลือง 🟡 (เตรียมการ / รอดำเนินการ)**:
     * `WAITING_FOR_MAINTENANCE` (เข้าซ่อม/รอเข้าซ่อม)
   * **อื่น ๆ / ไม่มีข้อมูล**: แสดงสัญลักษณ์ ⚪

การอ้างอิงวิธีนี้จะช่วยให้น้อง Butter และแดชบอร์ดแสดงผลเป็นมาตรฐานเดียวกัน และมีความยืดหยุ่นสูงเมื่อชื่อสถานะในฐานข้อมูลถูกเปลี่ยนแก้ไข




