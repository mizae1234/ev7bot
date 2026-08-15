-- =====================================================
-- SQL Script: Add Row/Slot fields to EV_AuditItem
-- Date: 2026-08-16
-- Description:
--   เพิ่มฟิลด์สำหรับบันทึกตำแหน่งจอดรถ (แถว/ช่อง/ลำดับซ้อนคัน)
--   ในการทำ Stock Audit
--   - AuditRow: ชื่อแถว (string เช่น "A", "B", "1", "โซนเหนือ")
--   - AuditSlot: เลขช่องจอด (string เช่น "1", "2", "3")
--   - SlotPosition: ลำดับในช่องเดียวกัน กรณีจอดซ้อนคัน (1 = คันแรก, 2 = คันซ้อน)
--   ทุกฟิลด์เป็น NULL เพื่อไม่กระทบ data เดิม
-- =====================================================

-- Add AuditRow column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_AuditItem]') AND name = 'AuditRow')
BEGIN
    ALTER TABLE [dbo].[EV_AuditItem]
    ADD [AuditRow] NVARCHAR(100) NULL;  -- แถว (เช่น "A", "B", "1")
END
GO

-- Add AuditSlot column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_AuditItem]') AND name = 'AuditSlot')
BEGIN
    ALTER TABLE [dbo].[EV_AuditItem]
    ADD [AuditSlot] NVARCHAR(100) NULL;  -- ช่องจอด (เช่น "1", "2", "3")
END
GO

-- Add SlotPosition column
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_AuditItem]') AND name = 'SlotPosition')
BEGIN
    ALTER TABLE [dbo].[EV_AuditItem]
    ADD [SlotPosition] INT NULL CONSTRAINT DF_EV_AuditItem_SlotPosition DEFAULT 1;  -- ลำดับซ้อนคัน (1 = คันแรก, 2 = คันซ้อน)
END
GO
