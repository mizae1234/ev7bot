-- Create Table for Repossessed Vehicles
CREATE TABLE dbo.EV_VehicleRepossess (
    RepossessID bigint IDENTITY(1,1) NOT NULL,
    InventoryItemID int NULL,
    VinNo varchar(250) NOT NULL,
    RentItemID bigint NULL,
    ContractNo varchar(250) NULL,
    RepossessDate datetime NOT NULL,
    RepossessLocation nvarchar(max) NULL,
    Remark nvarchar(max) NULL,
    IsActive bit NOT NULL DEFAULT 1,
    CreateDate datetime NOT NULL DEFAULT GETDATE(),
    CreateUserID int NULL,
    UpdateDate datetime NULL,
    UpdateUserID int NULL,
    CONSTRAINT PK_EV_VehicleRepossess PRIMARY KEY CLUSTERED (RepossessID)
);
