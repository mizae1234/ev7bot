-- =====================================================
-- ALTER VIEW: View_AccumarateReleaseCar
-- Date: 2026-11-24
-- Change: ตัดสิน RentType (NEW/USE) จากลำดับเวลาจริง แทน RentItemID
--
-- ปัญหาเดิม:
--   สัญญาเก่าที่ import ทีหลังจะได้ RentItemID ใหม่กว่าสัญญาปัจจุบัน
--   เช่น VIN LNADHAB35R1E08969: STR (ID 18127, ปล่อย 2026-11-18)
--   vs สัญญาเก่า (ID 18224, ปล่อย 2025-04-10, insert 2026-11-24)
--   → ไม่มี ID ที่น้อยกว่า 18127 → ONRENT_NEW (ผิด)
--
-- แก้ไข:
--   prev ถือเป็น "สัญญาก่อนหน้า" เมื่อ RentStatusID = 2 และ
--   COALESCE(prev.ReleaseDate, prev.CreateDate) < r.ReleaseDate
--   (ถ้าไม่มี ReleaseDate ใช้ CreateDate) วันเท่ากันใช้ RentItemID เป็น tie-break
--   ส่วนของ EV_RentItemLinemanHistory คงเดิม
--
-- Backup / Rollback: sql/View_AccumarateReleaseCar_BACKUP_20261124.sql
-- ตรวจผลก่อน/หลังด้วย: sql/View_AccumarateReleaseCar_COMPARE_20261124.sql
-- =====================================================

ALTER VIEW dbo.View_AccumarateReleaseCar AS
SELECT
    RentItemID, InventoryItemID, RentStatusID, VinNo, ContractNo,
    CopyContractCancellationID, ExpectedReleaseDate, ReleaseDate,
    ContractCancellationDate,
    CASE 
      WHEN RentStatusID = 2 THEN CAST(1 AS BIT)
      ELSE IsActive 
    END AS IsActive,
    CreateDate, CreateUserID,
    UpdateDate, UpdateUserID, ContractSignDate, RemarkWaitingForRelease,
    RemarkReleased, FirstName, LastName, PhoneNo, Location,
    RegisterNo, ContractType,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM dbo.EV_RentItem prev 
        WHERE prev.VinNo = r.VinNo 
        AND prev.RentItemID <> r.RentItemID
        AND prev.RentStatusID = 2
        AND (
              COALESCE(prev.ReleaseDate, prev.CreateDate) < r.ReleaseDate
           OR (COALESCE(prev.ReleaseDate, prev.CreateDate) = r.ReleaseDate
               AND prev.RentItemID < r.RentItemID)
        )
      ) OR EXISTS (
        SELECT 1 FROM dbo.EV_RentItemLinemanHistory prev 
        WHERE prev.VinNo = r.VinNo 
        AND prev.RentStatusID = 2
        AND (prev.RentItemID < r.RentItemID OR prev.ContractNo <> r.ContractNo)
      ) THEN 'ONRENT_USE'
      ELSE 'ONRENT_NEW'
    END AS RentType
FROM (
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
