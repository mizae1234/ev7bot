-- ==============================================================================
-- View: dbo.View_VehicleLocationLog & dbo.View_VehicleMovementLog
-- Description: Unified Vehicle Location Relocation Log
-- Sources: dbo.EV_VehicleLocationLog (Structured Log) + dbo.EV_VehicleNote (Location Notes)
-- Used by: EV7 Dashboard & Butter AI Chatbot Assistant
-- ==============================================================================

IF OBJECT_ID('dbo.View_VehicleMovementLog', 'V') IS NOT NULL
    DROP VIEW dbo.View_VehicleMovementLog;
GO

IF OBJECT_ID('dbo.View_VehicleLocationLog', 'V') IS NOT NULL
    DROP VIEW dbo.View_VehicleLocationLog;
GO

CREATE VIEW dbo.View_VehicleLocationLog AS
WITH AllLocationLogs AS (
    -- 1. บันทึกจากตาราง EV_VehicleLocationLog โดยตรง
    SELECT
        CONCAT('LOC-', ISNULL(CAST(l.InventoryItemID AS VARCHAR), '0'), '-', FORMAT(l.CreateDate, 'yyyyMMddHHmmssfff')) AS MovementID,
        l.InventoryItemID,
        l.VinNo,
        i.RegisterNo,
        i.Model,
        i.Project,
        i.ProjectType,
        l.OldLocation AS FromLocation,
        ISNULL(locOld.StatusName, l.OldLocation) AS FromLocationName,
        l.NewLocation AS ToLocation,
        ISNULL(locNew.StatusName, l.NewLocation) AS ToLocationName,
        CONCAT(
            N'📍 ย้ายสถานที่: ', 
            ISNULL(locOld.StatusName, l.OldLocation), 
            N' → ', 
            ISNULL(locNew.StatusName, l.NewLocation),
            CASE WHEN l.ActionCode IS NOT NULL THEN CONCAT(N' | ดำเนินการ: ', l.ActionCode) ELSE N'' END
        ) AS MovementDetail,
        l.CreateDate AS MovementDate,
        l.CreateDate,
        l.CreateUserID,
        ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', ISNULL(u.LastName, '')))), ''), u.UserName) AS CreateUserName,
        1 AS IsActive
    FROM dbo.EV_VehicleLocationLog l
    LEFT JOIN dbo.EV_InventoryItem i ON (l.InventoryItemID = i.InventoryItemID OR l.VinNo = i.VinNo)
    LEFT JOIN dbo.EV_User u ON l.CreateUserID = u.UserID
    LEFT JOIN dbo.EV_MsSubStatus locOld ON l.OldLocation = locOld.StatusCode AND locOld.Type = 'LOCATION'
    LEFT JOIN dbo.EV_MsSubStatus locNew ON l.NewLocation = locNew.StatusCode AND locNew.Type = 'LOCATION'

    UNION ALL

    -- 2. บันทึกประวัติจาก EV_VehicleNote ที่มีการย้ายสถานที่
    SELECT
        CONCAT('NOTE-', n.VehicleNoteID) AS MovementID,
        n.InventoryItemID,
        i.VinNo,
        i.RegisterNo,
        i.Model,
        i.Project,
        i.ProjectType,
        NULL AS FromLocation,
        NULL AS FromLocationName,
        i.CurrentLocation AS ToLocation,
        ISNULL(locCurrent.StatusName, i.CurrentLocation) AS ToLocationName,
        n.NoteDetail AS MovementDetail,
        n.CreateDate AS MovementDate,
        n.CreateDate,
        n.CreateUserID,
        ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', ISNULL(u.LastName, '')))), ''), u.UserName) AS CreateUserName,
        n.IsActive
    FROM dbo.EV_VehicleNote n
    INNER JOIN dbo.EV_InventoryItem i ON n.InventoryItemID = i.InventoryItemID
    LEFT JOIN dbo.EV_User u ON n.CreateUserID = u.UserID
    LEFT JOIN dbo.EV_MsSubStatus locCurrent ON i.CurrentLocation = locCurrent.StatusCode AND locCurrent.Type = 'LOCATION'
    WHERE (
        n.NoteDetail LIKE N'%ย้ายสถานที่%' 
        OR n.NoteDetail LIKE N'%เปลี่ยนสถานที่%'
    ) AND n.IsActive = 1
)
SELECT * FROM AllLocationLogs;
GO

-- สร้าง View ชื่อ View_VehicleMovementLog คู่กันไว้เพื่อให้เรียกใช้งานได้ทั้งสองชื่อ
CREATE VIEW dbo.View_VehicleMovementLog AS
SELECT * FROM dbo.View_VehicleLocationLog;
GO
