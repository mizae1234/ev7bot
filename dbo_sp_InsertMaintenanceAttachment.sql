-- =========================================================================
-- SQL Server DDL Script for FileAttachment and EV_FileAttachmentMaintenanceItem
-- =========================================================================

-- 1. Create FileAttachment table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FileAttachment]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[FileAttachment] (
        [FileAttachmentID] INT IDENTITY(1,1) NOT NULL,
        [FileName] NVARCHAR(255) NOT NULL,
        [FilePath] NVARCHAR(1000) NOT NULL,
        [FileType] NVARCHAR(100) NULL,
        [FileSize] INT NULL,
        [IsActive] BIT NOT NULL CONSTRAINT DF_FileAttachment_IsActive DEFAULT ((1)),
        [CreateDate] DATETIME NOT NULL CONSTRAINT DF_FileAttachment_CreateDate DEFAULT (GETDATE()),
        [CreateUserID] INT NULL,
        CONSTRAINT [PK_FileAttachment] PRIMARY KEY CLUSTERED ([FileAttachmentID] ASC)
    );
END;

-- 2. Create EV_FileAttachmentMaintenanceItem table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EV_FileAttachmentMaintenanceItem]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[EV_FileAttachmentMaintenanceItem] (
        [FileAttachmentMaintenanceItemID] INT IDENTITY(1,1) NOT NULL,
        [MaintenanceItemID] INT NOT NULL,
        [FileAttachmentID] INT NOT NULL,
        [IsActive] BIT NOT NULL CONSTRAINT DF_EV_FileAttachmentMaintenanceItem_IsActive DEFAULT ((1)),
        [CreateDate] DATETIME NOT NULL CONSTRAINT DF_EV_FileAttachmentMaintenanceItem_CreateDate DEFAULT (GETDATE()),
        [CreateUserID] INT NULL,
        CONSTRAINT [PK_EV_FileAttachmentMaintenanceItem] PRIMARY KEY CLUSTERED ([FileAttachmentMaintenanceItemID] ASC),
        CONSTRAINT [FK_EV_FileAttachmentMaintenanceItem_MaintenanceItem] FOREIGN KEY ([MaintenanceItemID]) REFERENCES [dbo].[EV_MaintenanceItem] ([MaintenanceItemID]),
        CONSTRAINT [FK_EV_FileAttachmentMaintenanceItem_FileAttachment] FOREIGN KEY ([FileAttachmentID]) REFERENCES [dbo].[FileAttachment] ([FileAttachmentID])
    );
END;

-- 3. Create sp_InsertMaintenanceAttachment Stored Procedure
GO
CREATE OR ALTER PROCEDURE dbo.sp_InsertMaintenanceAttachment
    @MaintenanceItemID INT,
    @FileName NVARCHAR(255),
    @FilePath NVARCHAR(1000),
    @FileType NVARCHAR(100),
    @FileSize INT,
    @CreateUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Insert into FileAttachment
    INSERT INTO dbo.FileAttachment (
        FileName, 
        FilePath, 
        FileType, 
        FileSize, 
        IsActive, 
        CreateDate, 
        CreateUserID
    )
    VALUES (
        @FileName, 
        @FilePath, 
        @FileType, 
        @FileSize, 
        1, 
        GETDATE(), 
        @CreateUserID
    );
    
    DECLARE @FileAttachmentID INT = SCOPE_IDENTITY();
    
    -- Insert into EV_FileAttachmentMaintenanceItem link table
    INSERT INTO dbo.EV_FileAttachmentMaintenanceItem (
        MaintenanceItemID, 
        FileAttachmentID, 
        IsActive, 
        CreateDate, 
        CreateUserID
    )
    VALUES (
        @MaintenanceItemID, 
        @FileAttachmentID, 
        1, 
        GETDATE(), 
        @CreateUserID
    );
    
    SELECT @FileAttachmentID AS FileAttachmentID;
END;
GO
