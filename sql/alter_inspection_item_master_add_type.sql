-- ==============================================================================
-- Migration Script: Add InspectionType to dbo.EV_InspectionItemMaster & Seed QC Items
-- Description: เพิ่มฟิลด์ InspectionType, Refill ข้อมูลเดิมทั้งหมดเป็น 'RETURN', และเพิ่มข้อตรวจ QC 9 ข้อ
-- SAFE & IDEMPOTENT: ไม่ลบข้อมูลเดิม และไม่ทำให้ข้อมูลเดิมสูญหายเด็ดขาด (Zero Data Loss)
-- ==============================================================================

-- 1. ตรวจสอบและเพิ่มคอลัมน์ InspectionType หากยังไม่มี (Default: 'RETURN')
IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'EV_InspectionItemMaster' AND COLUMN_NAME = 'InspectionType'
)
BEGIN
    ALTER TABLE dbo.EV_InspectionItemMaster
    ADD InspectionType VARCHAR(20) NULL;

    PRINT 'Added column InspectionType to dbo.EV_InspectionItemMaster successfully.';
END
ELSE
BEGIN
    PRINT 'Column InspectionType already exists in dbo.EV_InspectionItemMaster.';
END
GO

-- 2. REFILL / BACKFILL: เติมค่า 'RETURN' ให้กับข้อมูล Master เดิมทั้งหมดที่ InspectionType เป็น NULL
-- รับประกัน 100% ว่าข้อมูล Master เดิมทุกรายการไม่สูญหาย และคงสถานะเป็นรายการตรวจคืนรถเดิม
UPDATE dbo.EV_InspectionItemMaster
SET InspectionType = 'RETURN'
WHERE InspectionType IS NULL;

PRINT 'Refilled existing master items with InspectionType = RETURN.';
GO

-- 3. ตั้งค่า DEFAULT CONSTRAINT เป็น 'RETURN' สำหรับข้อมูลใหม่ในอนาคต (หากยังไม่มี)
IF NOT EXISTS (
    SELECT 1 
    FROM sys.default_constraints 
    WHERE name = 'DF_EV_InspectionItemMaster_InspectionType'
)
BEGIN
    ALTER TABLE dbo.EV_InspectionItemMaster
    ADD CONSTRAINT DF_EV_InspectionItemMaster_InspectionType DEFAULT 'RETURN' FOR InspectionType;

    PRINT 'Added DEFAULT constraint RETURN for InspectionType.';
END
GO

-- 4. SEED / MERGE รายการข้อตรวจ QC 9 ข้อ (InspectionType = 'QC')
-- ใช้ MERGE ตาม Category + ItemCode + InspectionType (ปลอดภัย รันซ้ำได้ ไม่เกิดข้อมูลซ้ำซ้อน)
MERGE dbo.EV_InspectionItemMaster AS target
USING (
    SELECT 'QC_CLEAN' AS Category, 'STATUS' AS ItemCode, N'1. ความสะอาด ภายนอก - ภายใน' AS Label, 'select' AS InputType, 10 AS SortOrder, 1 AS IsActive, 'QC' AS InspectionType
    UNION ALL
    SELECT 'QC_KEY' AS Category, 'STATUS' AS ItemCode, N'2. กุญแจพร้อม' AS Label, 'select' AS InputType, 20 AS SortOrder, 1 AS IsActive, 'QC' AS InspectionType
    UNION ALL
    SELECT 'QC_TAX_VEHICLE' AS Category, 'STATUS' AS ItemCode, N'3. ทะเบียนเหลือมากกว่า 3 เดือน' AS Label, 'boolean' AS InputType, 30 AS SortOrder, 1 AS IsActive, 'QC' AS InspectionType
    UNION ALL
    SELECT 'QC_TAX_METER' AS Category, 'STATUS' AS ItemCode, N'4. ภาษีมิเตอร์เหลือมากกว่า 1 เดือน' AS Label, 'boolean' AS InputType, 40 AS SortOrder, 1 AS IsActive, 'QC' AS InspectionType
    UNION ALL
    SELECT 'QC_PARK_POSITION' AS Category, 'STATUS' AS ItemCode, N'5. รถอยู่ในตำแหน่งพร้อมส่ง (ระบุจุดจอด)' AS Label, 'select' AS InputType, 50 AS SortOrder, 1 AS IsActive, 'QC' AS InspectionType
    UNION ALL
    SELECT 'QC_BATTERY_HV' AS Category, 'STATUS' AS ItemCode, N'6. ไฟแบตลูกใหญ่มากกว่า 40%' AS Label, 'number' AS InputType, 60 AS SortOrder, 1 AS IsActive, 'QC' AS InspectionType
    UNION ALL
    SELECT 'QC_QR_CODE' AS Category, 'STATUS' AS ItemCode, N'7. QR code มี-ไม่มี' AS Label, 'boolean' AS InputType, 70 AS SortOrder, 1 AS IsActive, 'QC' AS InspectionType
    UNION ALL
    SELECT 'QC_WIPER' AS Category, 'STATUS' AS ItemCode, N'8. ยางปัดน้ำฝน' AS Label, 'boolean' AS InputType, 80 AS SortOrder, 1 AS IsActive, 'QC' AS InspectionType
    UNION ALL
    SELECT 'QC_TIRE' AS Category, 'STATUS' AS ItemCode, N'9. ยางรถ' AS Label, 'boolean' AS InputType, 90 AS SortOrder, 1 AS IsActive, 'QC' AS InspectionType
) AS source
ON (target.Category = source.Category AND target.ItemCode = source.ItemCode AND target.InspectionType = source.InspectionType)
WHEN MATCHED THEN
    UPDATE SET 
        Label = source.Label, 
        InputType = source.InputType, 
        SortOrder = source.SortOrder, 
        IsActive = source.IsActive
WHEN NOT MATCHED THEN
    INSERT (Category, ItemCode, Label, InputType, SortOrder, IsActive, InspectionType)
    VALUES (source.Category, source.ItemCode, source.Label, source.InputType, source.SortOrder, source.IsActive, source.InspectionType);

PRINT 'Merged 9 QC master items successfully.';
GO
