-- =====================================================
-- CREATE OR ALTER VIEW: View_EV_ReturnItemWithInventory
-- Date: 2026-07-31
-- Description: View joining dbo.EV_ReturnItem (Return details) 
--              with dbo.EV_InventoryItem (Vehicle stock details) on VinNo
-- =====================================================

CREATE OR ALTER VIEW dbo.View_EV_ReturnItemWithInventory AS
SELECT
    -- From Return Item (r)
    r.ReturnItemID,
    r.RentItemID,
    r.VinNo,
    r.Model AS ReturnModel,
    r.RegisterNo AS ReturnRegisterNo,
    r.CustomerName,
    r.PhoneNo,
    r.ReceiveDate,
    r.ReturnDate,
    r.IdleDays,
    r.Mileage,
    r.ParkLocation,
    r.Status AS ReturnStatus,
    r.Group AS ReturnGroup,
    r.IsActive AS ReturnIsActive,
    r.Remark AS ReturnRemark,
    r.RemarkForCustomer,
    r.RemarkForReturnCar,
    r.IsSentToK2,
    r.SentToK2Date,
    r.CreateDate AS ReturnCreateDate,
    r.CreateUserID AS ReturnCreateUserID,
    r.UpdateDate AS ReturnUpdateDate,
    r.UpdateUserID AS ReturnUpdateUserID,

    -- From Inventory Item (i)
    i.InventoryItemID,
    i.RegisterNo AS InventoryRegisterNo,
    i.Model AS InventoryModel,
    i.Project,
    i.ProjectType,
    i.Company,
    i.Status AS InventoryStatus,
    i.StatusType AS InventoryStatusType,
    i.CurrentLocation AS InventoryCurrentLocation,
    i.Exterior_Color,
    i.Interior_Color,
    i.IsActive AS InventoryIsActive
FROM dbo.EV_ReturnItem r
LEFT JOIN dbo.EV_InventoryItem i ON r.VinNo = i.VinNo;
