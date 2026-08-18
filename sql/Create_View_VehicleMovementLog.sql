-- ==============================================================================
-- View: dbo.View_VehicleLocationLog & dbo.View_VehicleMovementLog
-- Description: Vehicle Location Movement & Relocation History Log
-- Source: dbo.EV_VehicleLocationLog joined with dbo.EV_MsSubStatus (Type='LOCATION') & dbo.EV_MsStatus
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
    CONCAT('LOC-', ISNULL(CAST(l.InventoryItemID AS VARCHAR(20)), '0'), '-', CONVERT(VARCHAR(30), l.CreateDate, 126)) AS MovementID,
    l.InventoryItemID,
    l.VinNo,
    i.RegisterNo,
    i.Model,
    i.Project,
    i.ProjectType,
    i.Status AS StatusCode,
    ISNULL(st.DescriptionStatus, ISNULL(st.StatusName, i.Status)) AS StatusName,
    i.StatusType,
    ISNULL(subSt.DescriptionStatus, ISNULL(subSt.StatusName, i.StatusType)) AS SubStatusName,
    l.OldLocation AS FromLocationCode,
    ISNULL(locFrom.StatusName, l.OldLocation) AS FromLocation,
    l.NewLocation AS ToLocationCode,
    ISNULL(locTo.StatusName, l.NewLocation) AS ToLocation,
    l.NewLocation AS CurrentLocation,
    ISNULL(locTo.StatusName, l.NewLocation) AS CurrentLocationName,
    CONCAT(
        N'📍 ย้ายสถานที่: ', 
        ISNULL(locFrom.StatusName, ISNULL(l.OldLocation, '-')), 
        N' → ', 
        ISNULL(locTo.StatusName, ISNULL(l.NewLocation, '-'))
    ) AS MovementDetail,
    l.CreateDate AS MovementDate,
    l.CreateDate,
    l.CreateUserID,
    ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', ISNULL(u.LastName, '')))), ''), u.UserName) AS CreateUserName,
    1 AS IsActive
FROM dbo.EV_VehicleLocationLog l
LEFT JOIN dbo.EV_InventoryItem i ON l.InventoryItemID = i.InventoryItemID
LEFT JOIN dbo.EV_User u ON l.CreateUserID = u.UserID
LEFT JOIN dbo.EV_MsStatus st ON i.Status = st.StatusCode
LEFT JOIN dbo.EV_MsSubStatus subSt ON i.StatusType = subSt.StatusCode
LEFT JOIN dbo.EV_MsSubStatus locFrom ON l.OldLocation = locFrom.StatusCode AND locFrom.Type = 'LOCATION'
LEFT JOIN dbo.EV_MsSubStatus locTo ON l.NewLocation = locTo.StatusCode AND locTo.Type = 'LOCATION';
GO

-- สร้าง View ชื่อ View_VehicleMovementLog คู่กันไว้เพื่อให้เรียกใช้งานได้ทั้งสองชื่อ
CREATE VIEW dbo.View_VehicleMovementLog AS
SELECT * FROM dbo.View_VehicleLocationLog;
GO
