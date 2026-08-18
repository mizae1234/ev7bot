-- ==============================================================================
-- View: dbo.View_VehicleMovementLog
-- Description: Unified Vehicle Movement and Location History Log
-- Used by: EV7 Dashboard (Vehicle Movement Page) and Butter AI Chatbot Assistant
-- ==============================================================================

IF OBJECT_ID('dbo.View_VehicleMovementLog', 'V') IS NOT NULL
    DROP VIEW dbo.View_VehicleMovementLog;
GO

CREATE VIEW dbo.View_VehicleMovementLog AS
WITH AllMovements AS (
    -- 1. Direct Location Change Notes (from EV_VehicleNote)
    SELECT
        CONCAT('NOTE-', n.VehicleNoteID) AS MovementID,
        'LOCATION_CHANGE' AS MovementType,
        N'ย้ายสถานที่ / อัปเดตสถานะ' AS MovementTypeName,
        n.InventoryItemID,
        i.VinNo,
        i.RegisterNo,
        i.Model,
        i.Project,
        i.ProjectType,
        i.CurrentLocation,
        NULL AS OriginLocation,
        NULL AS DestinationLocation,
        n.NoteDetail AS MovementDetail,
        n.CreateDate AS MovementDate,
        n.CreateDate,
        n.CreateUserID,
        ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', ISNULL(u.LastName, '')))), ''), u.UserName) AS CreateUserName,
        n.IsActive
    FROM dbo.EV_VehicleNote n
    INNER JOIN dbo.EV_InventoryItem i ON n.InventoryItemID = i.InventoryItemID
    LEFT JOIN dbo.EV_User u ON n.CreateUserID = u.UserID
    WHERE (
        n.NoteDetail LIKE N'%ย้ายสถานที่%' 
        OR n.NoteDetail LIKE N'%📍%' 
        OR n.NoteDetail LIKE N'%เปลี่ยนสถานที่%'
        OR n.NoteDetail LIKE N'%ยึดคืนรถยนต์%'
    ) AND n.IsActive = 1

    UNION ALL

    -- 2. Repossessions (from EV_VehicleRepossess)
    SELECT
        CONCAT('REPOSSESS-', r.RepossessID) AS MovementID,
        'REPOSSESS' AS MovementType,
        N'ยึดคืนรถยนต์' AS MovementTypeName,
        r.InventoryItemID,
        r.VinNo,
        i.RegisterNo,
        i.Model,
        i.Project,
        i.ProjectType,
        i.CurrentLocation,
        r.RepossessLocation AS OriginLocation,
        NULL AS DestinationLocation,
        ISNULL(r.Remark, N'ดำเนินการยึดคืนรถยนต์เข้าสู่ระบบ') AS MovementDetail,
        ISNULL(r.RepossessDate, r.CreateDate) AS MovementDate,
        r.CreateDate,
        r.CreateUserID,
        ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', ISNULL(u.LastName, '')))), ''), u.UserName) AS CreateUserName,
        r.IsActive
    FROM dbo.EV_VehicleRepossess r
    LEFT JOIN dbo.EV_InventoryItem i ON (r.InventoryItemID = i.InventoryItemID OR r.VinNo = i.VinNo)
    LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
    WHERE r.IsActive = 1

    UNION ALL

    -- 3. Returns (from EV_ReturnItem)
    SELECT
        CONCAT('RETURN-', ret.ReturnItemID) AS MovementID,
        'RETURN' AS MovementType,
        N'ตรวจรับคืนรถยนต์' AS MovementTypeName,
        i.InventoryItemID,
        ret.VinNo,
        i.RegisterNo,
        i.Model,
        i.Project,
        i.ProjectType,
        i.CurrentLocation,
        NULL AS OriginLocation,
        ret.ParkLocation AS DestinationLocation,
        CONCAT(N'รับคืนรถยนต์ ลูกค้า: ', ISNULL(ret.CustomerName, '-'), CASE WHEN ret.Mileage IS NOT NULL THEN CONCAT(N' | เลขไมล์: ', ret.Mileage, N' กม.') ELSE N'' END) AS MovementDetail,
        ISNULL(ret.ReturnDate, ret.ReceiveDate) AS MovementDate,
        ISNULL(ret.ReturnDate, ret.ReceiveDate) AS CreateDate,
        NULL AS CreateUserID,
        N'เจ้าหน้าที่รับคืนรถ' AS CreateUserName,
        1 AS IsActive
    FROM dbo.EV_ReturnItem ret
    LEFT JOIN dbo.EV_InventoryItem i ON ret.VinNo = i.VinNo
    WHERE ret.ParkLocation IS NOT NULL OR ret.ReturnDate IS NOT NULL
)
SELECT
    m.MovementID,
    m.MovementType,
    m.MovementTypeName,
    m.InventoryItemID,
    m.VinNo,
    m.RegisterNo,
    m.Model,
    m.Project,
    m.ProjectType,
    m.CurrentLocation,
    ISNULL(loc.StatusName, m.CurrentLocation) AS CurrentLocationName,
    m.OriginLocation,
    m.DestinationLocation,
    m.MovementDetail,
    m.MovementDate,
    m.CreateDate,
    m.CreateUserID,
    m.CreateUserName,
    m.IsActive
FROM AllMovements m
LEFT JOIN dbo.EV_MsSubStatus loc ON m.CurrentLocation = loc.StatusCode AND loc.Type = 'LOCATION';
GO
