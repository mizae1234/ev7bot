-- =====================================================
-- ALTER VIEW: View_AccumarateReleaseCar
-- Date: 2026-07-12
-- Change: ถ้า RentStatusID = 2 (ปล่อยจริง) → IsActive = 1 เสมอ
--         ไม่ว่าสัญญาจะถูกยกเลิก/คืนรถแล้วหรือไม่
-- 
-- ผลกระทบ:
--   ✅ ทอ-8193 (คืนรถ): IsActive 0 → 1 (นับว่าปล่อยแล้ว)
--   ✅ ทอ-7112 (ยกเลิกสัญญา): IsActive 0 → 1 (นับว่าปล่อยแล้ว)
--   ⚠️ VIN ที่มี 2 สัญญา (NEW→USE): ทั้ง 2 records จะเป็น IsActive=1
--      → Dashboard query ต้อง deduplicate ด้วย ROW_NUMBER
--
-- Backup: sql/View_AccumarateReleaseCar_BACKUP_20260712.sql
-- =====================================================

ALTER VIEW dbo.View_AccumarateReleaseCar AS
SELECT
    RentItemID, InventoryItemID, RentStatusID, VinNo, ContractNo,
    CopyContractCancellationID, ExpectedReleaseDate, ReleaseDate,
    ContractCancellationDate,
    -- ✅ เปลี่ยนจาก IsActive ตรงๆ → ถ้าปล่อยจริง (status=2) = active เสมอ
    CASE 
      WHEN RentStatusID = 2 THEN CAST(1 AS BIT)
      ELSE IsActive 
    END AS IsActive,
    CreateDate, CreateUserID,
    UpdateDate, UpdateUserID, ContractSignDate, RemarkWaitingForRelease,
    RemarkReleased, FirstName, LastName, PhoneNo, Location,
    RegisterNo, ContractType,
    CASE WHEN ReleaseSeqInSegment = 1 THEN 'ONRENT_NEW' ELSE 'ONRENT_USE' END AS RentType
FROM (
    SELECT
        r.RentItemID, r.InventoryItemID, r.RentStatusID, r.VinNo, r.ContractNo,
        r.CopyContractCancellationID, r.ExpectedReleaseDate, r.ReleaseDate,
        r.ContractCancellationDate, r.IsActive, r.CreateDate, r.CreateUserID,
        r.UpdateDate, r.UpdateUserID, r.ContractSignDate, r.RemarkWaitingForRelease,
        r.RemarkReleased, r.FirstName, r.LastName, r.PhoneNo, r.Location,
        r.RegisterNo, r.ContractType,
        ROW_NUMBER() OVER (
            PARTITION BY r.VinNo
            ORDER BY r.ReleaseDate, r.RentItemID
        ) AS ReleaseSeqInSegment
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
    ) AS r
) AS x;
