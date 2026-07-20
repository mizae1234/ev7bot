-- =====================================================
-- SQL Script: Create tables for Stock Audit feature
-- Date: 2026-07-20
-- Description: 
--   1. dbo.EV_AuditSession - เก็บข้อมูลรอบการทำ Audit แต่ละครั้ง
--   2. dbo.EV_AuditItem - รายการรถแต่ละคันที่แสกนเช็กเจอในรอบนั้นๆ
-- =====================================================

-- 1. Create dbo.EV_AuditSession
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EV_AuditSession]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[EV_AuditSession] (
        [AuditSessionID] INT IDENTITY(1,1) PRIMARY KEY,
        [AuditDate] DATE NOT NULL,
        [Location] NVARCHAR(200) NOT NULL,
        [Status] NVARCHAR(50) NOT NULL CONSTRAINT DF_EV_AuditSession_Status DEFAULT 'DRAFT', -- 'DRAFT' (กำลังเช็ก), 'COMPLETED' (ตรวจเช็กเสร็จสิ้น)
        [CreatedBy] NVARCHAR(200) NULL, -- ชื่อหรือ ID ผู้สร้างรอบการตรวจสอบ
        [CreateDate] DATETIME NOT NULL CONSTRAINT DF_EV_AuditSession_CreateDate DEFAULT GETDATE(),
        [UpdateDate] DATETIME NULL,
        [Notes] NVARCHAR(MAX) NULL
    );
END
GO

-- 2. Create dbo.EV_AuditItem
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EV_AuditItem]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[EV_AuditItem] (
        [AuditItemID] INT IDENTITY(1,1) PRIMARY KEY,
        [AuditSessionID] INT NOT NULL,
        [VinNo] NVARCHAR(50) NOT NULL, -- สแกนได้จากบาร์โค้ดหรือข้อความ VIN
        [ScanTime] DATETIME NOT NULL CONSTRAINT DF_EV_AuditItem_ScanTime DEFAULT GETDATE(),
        [ScanMethod] NVARCHAR(50) NOT NULL, -- 'OCR' (สแกนกล้อง), 'BARCODE' (สแกนบาร์โค้ด), 'MANUAL' (พิมพ์ค้นหา)
        [DetectedStatus] NVARCHAR(50) NOT NULL, -- 'MATCHED' (ตรงพิกัด), 'MISMATCH' (ผิดพิกัด), 'NOT_IN_SYSTEM' (ไม่มีในระบบ)
        [PreviousLocation] NVARCHAR(200) NULL, -- พิกัดเดิมในระบบ ณ ตอนที่แสกนเจอ
        [IsConfirmed] BIT NOT NULL CONSTRAINT DF_EV_AuditItem_IsConfirmed DEFAULT 0, -- ยืนยันการอัปเดตย้ายพิกัด (1 = ยืนยัน, 0 = ยังไม่ยืนยัน)
        [CreatedBy] NVARCHAR(200) NULL, -- ชื่อหรือ ID ผู้ที่ทำการแสกนรถคันนี้
        [Notes] NVARCHAR(MAX) NULL,
        CONSTRAINT FK_EV_AuditItem_EV_AuditSession FOREIGN KEY (AuditSessionID) REFERENCES [dbo].[EV_AuditSession]([AuditSessionID]) ON DELETE CASCADE
    );
END
GO
