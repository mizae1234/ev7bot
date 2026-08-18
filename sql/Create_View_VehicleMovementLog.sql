-- ==============================================================================
-- View: dbo.View_VehicleLocationLog & dbo.View_VehicleMovementLog
-- Description: Vehicle Location Movement & Relocation History Log
-- Source: dbo.EV_VehicleNote (Strictly location relocation notes)
-- Used by: EV7 Dashboard & Butter AI Chatbot Assistant
-- ==============================================================================

IF OBJECT_ID('dbo.View_VehicleMovementLog', 'V') IS NOT NULL
    DROP VIEW dbo.View_VehicleMovementLog;
GO

IF OBJECT_ID('dbo.View_VehicleLocationLog', 'V') IS NOT NULL
    DROP VIEW dbo.View_VehicleLocationLog;
GO

CREATE VIEW dbo.View_VehicleLocationLog AS
SELECT
    CONCAT('NOTE-', n.VehicleNoteID) AS MovementID,
    n.InventoryItemID,
    i.VinNo,
    i.RegisterNo,
    i.Model,
    i.Project,
    i.ProjectType,
    i.CurrentLocation,
    ISNULL(locCurrent.StatusName, i.CurrentLocation) AS CurrentLocationName,
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
) AND n.IsActive = 1;
GO

-- สร้าง View ชื่อ View_VehicleMovementLog คู่กันไว้เพื่อให้เรียกใช้งานได้ทั้งสองชื่อ
CREATE VIEW dbo.View_VehicleMovementLog AS
SELECT * FROM dbo.View_VehicleLocationLog;
GO
