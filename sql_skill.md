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
* **คอลัมน์สำคัญ**: `RentItemID` (PK), `InventoryItemID` (FK -> `EV_InventoryItem`), `ContractNo` (เลขที่สัญญา), `ContractType`, `FirstName` (ชื่อผู้เช่า), `LastName` (นามสกุลผู้เช่า), `PhoneNo`, `ExpectedReleaseDate` (วันนัดส่งมอบ), `ReleaseDate` (วันส่งมอบจริง), `ContractCancellationDate` (วันยกเลิกสัญญา), `IsActive` (bit)

### 11.3 ตาราง: `dbo.EV_MaintenanceItem` (ใบแจ้งซ่อมและสถานะซ่อม)
เก็บประวัติการเคลมและแจ้งซ่อม
* **คอลัมน์สำคัญ**: `MaintenanceItemID` (PK), `InventoryItemID` (FK -> `EV_InventoryItem`), `ReportDate` (วันแจ้งซ่อม), `IncidentDate` (วันเกิดเหตุ), `MaintenanceStartDate` (วันเข้าซ่อมจริง), `MaintenanceFinishDate` (วันซ่อมเสร็จ), `MaintenanceReturnDate` (วันรับรถคืน), `CarStatusCode` (COMPLETE, IN_MAINTENANCE, WAITING_FOR_MAINTENANCE, STILL_WORK), `IssueTitle` (อาการที่แจ้ง), `ProblemTypeCode` (ประเภทปัญหา เช่น PRODUCT, ACCIDENT), `FaultPartyCode` (ฝ่ายผิด เช่น DRIVER, COUNTERPART), `CarCaseCode` (เคสซ่อมเบา/หนัก), `ServiceLocationCode` (อู่ที่เข้าซ่อม), `InsuranceCode`, `FollowUpDetail`, `IsActive` (bit)

### 11.4 ตาราง: `dbo.EV_ReplacementItem` (ประวัติการใช้รถทดแทน)
เก็บประวัติการปล่อยรถทดแทนระหว่างซ่อม
* **คอลัมน์สำคัญ**: `ReplacementItemID` (PK), `MaintenanceItemID` (FK -> `EV_MaintenanceItem`), `VinNo` (เลขตัวถังของรถคันที่นำไปทดแทน), `ReplacementStartDate` (วันที่เริ่มทดแทน), `ReplacementReturnDate` (วันที่คืนรถทดแทน), `Location` (สถานที่รับ/คืน), `Remark`, `IsActive` (bit)

### 11.5 ตาราง: `dbo.EV_ReturnItem` (การคืนรถเช่า)
เก็บประวัติการรับรถกลับเข้าระบบ
* **คอลัมน์สำคัญ**: `ReturnItemID` (PK), `VinNo`, `CustomerName`, `Model`, `ContractNo`, `ReceiveDate`, `ReturnDate`, `Mileage` (เลขไมล์ตอนรับคืน), `ParkLocation` (สถานที่จอดเก็บรถ)

### 11.6 ตาราง: `dbo.EV_DeliveryPlan` (แผนการส่งมอบรถยนต์)
เก็บข้อมูลแผนการส่งมอบรถประจำวัน แยกตามประเภทโครงการและรุ่นรถยนต์
* **คอลัมน์สำคัญ**: `PlanID` (PK, bigint), `PlanDate` (date, วันที่ในแผนการส่งมอบ), `ProjectType` (varchar(20), ประเภทโครงการ เช่น EV7, Grab, Line Man), `ES_Count` (int, จำนวนแผนส่งมอบของรุ่น MG ES), `Y490_Count` (int, จำนวนแผนส่งมอบของรุ่น GAC AION Y Plus 490), `Y410_Count` (int, จำนวนแผนส่งมอบของรุ่น GAC AION Y Plus 410)

---

## 12. ความสัมพันธ์และเงื่อนไขการ Query
* **การเชื่อมตาราง**:
  * `EV_RentItem.InventoryItemID` ➔ `EV_InventoryItem.InventoryItemID`
  * `EV_MaintenanceItem.InventoryItemID` ➔ `EV_InventoryItem.InventoryItemID`
  * `EV_ReplacementItem.MaintenanceItemID` ➔ `EV_MaintenanceItem.MaintenanceItemID`
* **เงื่อนไขคิวรี (สำคัญ)**:
  * ในการ Query ทุกตาราง **ต้องใส่เงื่อนไข `IsActive = 1` เสมอ** เพื่อดึงเฉพาะรายการที่ยังไม่ถูกยกเลิกหรือลบ
  * หากรถยังไม่มีเลขทะเบียน (`RegisterNo` เป็น NULL หรือค่าว่าง) ให้ใช้ `VinNo` ในการระบุและแสดงผลแทนทะเบียนรถเสมอ
  * การนับจำนวนการปล่อยเช่าสำเร็จ (**Completed Delivery**): จะนับเมื่อมีข้อมูล `r.ReleaseDate IS NOT NULL` เท่านั้น หากยังไม่มีข้อมูลวันส่งมอบจริงจะถูกนับเป็นรอดำเนินการ (**Pending**) ทั้งนี้แม้รถจะกลับมาเข้าซ่อมและมีสถานะเป็น `MAINTENANCE` ในภายหลัง ก็ยังถือว่าการส่งมอบสำเร็จแล้ว

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


