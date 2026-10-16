-- =========================================================================
-- เพิ่มเลขงานของระบบประกัน (InsuranceJobNo) ใน EV_MaintenanceItem
-- ใช้ตรวจข้อมูลซ้ำตอน Import Excel ที่ /maintenance (รันโดย DBA ก่อน deploy โค้ดใหม่)
-- app user ต้องมีสิทธิ์ UPDATE ที่ตารางนี้ (มีอยู่แล้วจากการเขียน ContractNo)
-- =========================================================================
USE EV7Tracking_Prod;
GO

IF COL_LENGTH('dbo.EV_MaintenanceItem', 'InsuranceJobNo') IS NULL
    ALTER TABLE dbo.EV_MaintenanceItem ADD InsuranceJobNo nvarchar(100) NULL;
GO

-- Non-unique: ข้อมูลเดิมเป็น NULL ทั้งหมด และกันกรณีมีค่าซ้ำจากการแก้ไขภายหลัง
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EV_MaintenanceItem_InsuranceJobNo' AND object_id = OBJECT_ID('dbo.EV_MaintenanceItem'))
    CREATE INDEX IX_EV_MaintenanceItem_InsuranceJobNo ON dbo.EV_MaintenanceItem (InsuranceJobNo) WHERE InsuranceJobNo IS NOT NULL;
GO

-- (ทางเลือก) เติมเลขงานให้ใบซ่อมที่เคยนำเข้าไปแล้ว จาก log
UPDATE m SET m.InsuranceJobNo = l.InsuranceJobNo
FROM dbo.EV_MaintenanceItem m
JOIN dbo.EV_MaintenanceImportLog l ON l.MaintenanceItemID = m.MaintenanceItemID AND l.Result = 'IMPORTED'
WHERE m.InsuranceJobNo IS NULL AND l.InsuranceJobNo IS NOT NULL;
GO
