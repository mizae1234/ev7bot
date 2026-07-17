-- =====================================================
-- ALTER VIEW: View_AccumarateReleaseCar
-- Date: 2026-07-17
-- Change: แก้ไข RentType logic — ใช้ EXISTS ตรวจสอบว่า VIN เคยมีสัญญาที่ปล่อยจริง (RentStatusID=2) ก่อนหน้าหรือไม่
--         แทน ROW_NUMBER ที่นับเฉพาะ records ที่ ReleaseDate IS NOT NULL
--
-- ปัญหาเดิม:
--   ROW_NUMBER() PARTITION BY VinNo นับเฉพาะ records ที่ผ่าน filter
--   (ReleaseDate IS NOT NULL AND RentStatusID = 2) ทำให้ถ้าสัญญาแรกถูกยกเลิก
--   (ReleaseDate IS NULL) จะถูกกรองออก → สัญญาที่ 2 ได้ seq=1 → ONRENT_NEW (ผิด)
--
-- แก้ไข:
--   ใช้ EXISTS ตรวจสอบว่ามีสัญญาที่ RentItemID น้อยกว่า (เก่ากว่า) 
--   และ RentStatusID = 2 (เคยปล่อยจริง) สำหรับ VIN เดียวกัน
--   ในตาราง EV_RentItem หรือ EV_RentItemLinemanHistory หรือไม่
--   ถ้ามี → ONRENT_USE, ถ้าไม่มี → ONRENT_NEW
--   สัญญาที่ RentStatusID = 0 (ยังไม่ดำเนินการ/ยกเลิกตั้งแต่ต้น) จะไม่นับ
--
-- ตัวอย่าง:
--   VIN LNADHAB30R1E08698: สัญญาแรก RentStatusID=2 แต่ ReleaseDate=NULL (ยกเลิก) → นับเป็น prior → USE ✅
--   VIN LNADHAB30T1G01358: สัญญาแรก RentStatusID=0 (ไม่เคยปล่อย) → ไม่นับ → NEW ✅
--
-- Backup: sql/View_AccumarateReleaseCar_BACKUP_20260717.sql
-- =====================================================

ALTER VIEW dbo.View_AccumarateReleaseCar AS
SELECT
    RentItemID, InventoryItemID, RentStatusID, VinNo, ContractNo,
    CopyContractCancellationID, ExpectedReleaseDate, ReleaseDate,
    ContractCancellationDate,
    -- ✅ ถ้าปล่อยจริง (status=2) = active เสมอ
    CASE 
      WHEN RentStatusID = 2 THEN CAST(1 AS BIT)
      ELSE IsActive 
    END AS IsActive,
    CreateDate, CreateUserID,
    UpdateDate, UpdateUserID, ContractSignDate, RemarkWaitingForRelease,
    RemarkReleased, FirstName, LastName, PhoneNo, Location,
    RegisterNo, ContractType,
    -- ✅ แก้ไข: ใช้ EXISTS ตรวจสอบสัญญาก่อนหน้าที่เคยปล่อยจริง (RentStatusID=2)
    --    1. เช็คสัญญาที่ RentItemID น้อยกว่าในทั้ง 2 ตาราง
    --    2. เช็ครถ Line Man (รถวน) ที่ reuse RentItemID เดิม → เช็คข้ามตาราง (VinNo เดียวกัน)
    --    สัญญาที่ RentStatusID=0 (ยังไม่ดำเนินการ/ยกเลิกตั้งแต่ต้น) จะไม่นับ
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM dbo.EV_RentItem prev 
        WHERE prev.VinNo = r.VinNo 
        AND prev.RentItemID < r.RentItemID
        AND prev.RentStatusID = 2
      ) OR EXISTS (
        SELECT 1 FROM dbo.EV_RentItemLinemanHistory prev 
        WHERE prev.VinNo = r.VinNo 
        AND prev.RentStatusID = 2
        AND (prev.RentItemID < r.RentItemID OR prev.ContractNo <> r.ContractNo)
      ) THEN 'ONRENT_USE'
      ELSE 'ONRENT_NEW'
    END AS RentType
FROM (
    -- 1. สัญญาเช่าหลักในปัจจุบัน
    SELECT 
        RentItemID, InventoryItemID, RentStatusID, VinNo, ContractNo,
        CopyContractCancellationID, ExpectedReleaseDate, ReleaseDate,
        ContractCancellationDate, IsActive, CreateDate, CreateUserID,
        UpdateDate, UpdateUserID, ContractSignDate, RemarkWaitingForRelease,
        RemarkReleased, FirstName, LastName, PhoneNo, Location,
        RegisterNo, ContractType
    FROM dbo.EV_RentItem
    WHERE ReleaseDate IS NOT NULL AND RentStatusID = 2

    UNION ALL

    -- 2. ประวัติสัญญาของรถโครงการ Line Man (รถวน)
    SELECT 
        RentItemID, InventoryItemID, RentStatusID, VinNo, ContractNo,
        NULL AS CopyContractCancellationID, ExpectedReleaseDate, ReleaseDate,
        ReturnDate AS ContractCancellationDate, CAST(0 AS BIT) AS IsActive, CreateDate, CreateUserID,
        NULL AS UpdateDate, NULL AS UpdateUserID, ContractSignDate, RemarkWaitingForRelease,
        RemarkReleased, FirstName, LastName, PhoneNo, Location,
        RegisterNo, ContractType
    FROM dbo.EV_RentItemLinemanHistory
    WHERE ReleaseDate IS NOT NULL AND RentStatusID = 2
) AS r;
