-- =========================================================================
-- SQL Server Stored Procedure for Registering Maintenance File Attachments
-- =========================================================================

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
    
    -- Insert into existing FileAttachment table
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
    
    -- Insert into existing EV_FileAttachmentMaintenanceItem link table
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
