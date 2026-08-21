-- =====================================================
-- SQL Script: Add Resolve/Repair fields to EV_Inspection & EV_InspectionItem
-- Date: 2026-08-21
-- Description:
--   เพิ่มฟิลด์สำหรับติดตามสถานะการเปิดงานซ่อม และการแก้ไขจุดชำรุดจากการตรวจรับคืนรถ
--   - EV_InspectionItem: 
--       ResolveStatus ('PENDING' = รอจัดการ, 'IN_PROGRESS' = เปิดงานซ่อมแล้ว, 'RESOLVED' = แก้ไขแล้ว, 'NO_ACTION_NEEDED' = ไม่ต้องทำ/ยอมรับสภาพ/ปล่อยผ่าน), 
--       ResolveRemark, ResolveUserID, ResolveDate
--   - EV_Inspection: 
--       RepairStatus ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'NO_ACTION_NEEDED'), 
--       RepairRemark
--   ทุกฟิลด์เป็น NULL เพื่อความปลอดภัยและไม่กระทบข้อมูลเดิม 100%
-- =====================================================

-- 1. เพิ่มฟิลด์ใน EV_InspectionItem (ระดับจุดความเสียหาย)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_InspectionItem]') AND name = 'ResolveStatus')
BEGIN
    ALTER TABLE [dbo].[EV_InspectionItem]
    ADD [ResolveStatus] VARCHAR(30) NULL,
        [ResolveRemark] NVARCHAR(500) NULL,
        [ResolveUserID] INT NULL,
        [ResolveDate] DATETIME NULL;
END
GO

-- 2. เพิ่มฟิลด์ใน EV_Inspection (ระดับภาพรวมใบรับคืน)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Inspection]') AND name = 'RepairStatus')
BEGIN
    ALTER TABLE [dbo].[EV_Inspection]
    ADD [RepairStatus] VARCHAR(30) NULL,
        [RepairRemark] NVARCHAR(500) NULL;
END
GO
