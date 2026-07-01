-- =========================================================================
-- SQL Server Stored Procedure for Registering Maintenance File Attachments (JSON)
-- =========================================================================

CREATE OR ALTER PROCEDURE dbo.sp_InsertMaintenanceAttachmentsJson
    @MaintenanceItemID INT,
    @AttachmentsJson NVARCHAR(MAX), -- JSON Array payload
    @CreateUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Temp table to parse JSON elements
    DECLARE @TempFiles TABLE (
        RowID INT IDENTITY(1,1),
        FileName NVARCHAR(255),
        OriginalFileName NVARCHAR(255),
        S3Key NVARCHAR(1000),
        FileType NVARCHAR(100),
        FileSize INT
    );
    
    -- Parse JSON Array and insert into temp table
    INSERT INTO @TempFiles (FileName, OriginalFileName, S3Key, FileType, FileSize)
    SELECT FileName, OriginalFileName, S3Key, FileType, FileSize
    FROM OPENJSON(@AttachmentsJson)
    WITH (
        FileName NVARCHAR(255) '$.fileName',
        OriginalFileName NVARCHAR(255) '$.originalFileName',
        S3Key NVARCHAR(1000) '$.s3Key',
        FileType NVARCHAR(100) '$.fileType',
        FileSize INT '$.fileSize'
    );
    
    -- Loop and insert each attachment
    DECLARE @Count INT = 0;
    DECLARE @Total INT = 0;
    SELECT @Total = COUNT(*) FROM @TempFiles;
    
    WHILE @Count < @Total
    BEGIN
        SET @Count = @Count + 1;
        
        DECLARE @FN NVARCHAR(255), @OFN NVARCHAR(255), @SK NVARCHAR(1000), @FT NVARCHAR(100), @FS INT;
        SELECT @FN = FileName, @OFN = OriginalFileName, @SK = S3Key, @FT = FileType, @FS = FileSize
        FROM @TempFiles WHERE RowID = @Count;
        
        -- 1. Insert into existing FileAttachment table
        INSERT INTO dbo.FileAttachment (
            FileName, 
            OriginalFileName,
            S3Key,
            FileSize,
            ContentType,
            ReferenceID,
            ReferenceType,
            UploadDate,
            CreatedBy,
            CreatedDate
        )
        VALUES (
            @FN, 
            @OFN,
            @SK,
            @FS, 
            @FT, 
            @MaintenanceItemID,
            'MAINTENANCE',
            GETDATE(),
            @CreateUserID,
            GETDATE()
        );
        
        DECLARE @NewFileID INT = SCOPE_IDENTITY();
        
        -- 2. Insert into existing EV_FileAttachmentMaintenanceItem link table
        INSERT INTO dbo.EV_FileAttachmentMaintenanceItem (
            MaintenanceItemID, 
            FileAttachmentID, 
            ProcessType,
            IsActive, 
            CreatedBy,
            CreatedDate
        )
        VALUES (
            @MaintenanceItemID, 
            @NewFileID, 
            'MAINTENANCE',
            1, 
            @CreateUserID,
            GETDATE()
        );
    END
END;
GO

-- =========================================================================
-- SQL Server Stored Procedure for Soft-Deleting Maintenance File Attachments (JSON)
-- =========================================================================

CREATE OR ALTER PROCEDURE dbo.sp_DeleteMaintenanceAttachmentsJson
    @MaintenanceItemID INT,
    @DeletedAttachmentIdsJson NVARCHAR(MAX), -- JSON Array of IDs e.g. [102, 105]
    @UpdateUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Parse the JSON array of IDs
    DECLARE @TempIDs TABLE (FileAttachmentID INT);
    
    INSERT INTO @TempIDs (FileAttachmentID)
    SELECT value
    FROM OPENJSON(@DeletedAttachmentIdsJson);
    
    -- Soft delete relationships in link table
    UPDATE dbo.EV_FileAttachmentMaintenanceItem
    SET IsActive = 0,
        UpdatedBy = @UpdateUserID,
        UpdatedDate = GETDATE()
    WHERE MaintenanceItemID = @MaintenanceItemID
      AND FileAttachmentID IN (SELECT FileAttachmentID FROM @TempIDs);
END;
GO

-- =========================================================================
-- SQL Server Stored Procedure for Updating Maintenance Ticket Status and Dates
-- =========================================================================

CREATE OR ALTER PROCEDURE dbo.sp_UpdateMaintenanceItem
    @MaintenanceItemID INT,
    @CarStatusCode NVARCHAR(50) = NULL,
    @MaintenanceStartDate DATETIME = NULL,
    @MaintenanceFinishDate DATETIME = NULL,
    @ServiceLocationCode NVARCHAR(50) = NULL,
    @UpdateUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE dbo.EV_MaintenanceItem
    SET 
        CarStatusCode = COALESCE(@CarStatusCode, CarStatusCode),
        MaintenanceStartDate = COALESCE(@MaintenanceStartDate, MaintenanceStartDate),
        MaintenanceFinishDate = COALESCE(@MaintenanceFinishDate, MaintenanceFinishDate),
        ServiceLocationCode = COALESCE(@ServiceLocationCode, ServiceLocationCode),
        UpdateDate = GETDATE(),
        UpdateUserID = @UpdateUserID
    WHERE MaintenanceItemID = @MaintenanceItemID AND IsActive = 1;
END;
GO

-- =========================================================================
-- SQL Server Stored Procedure for Inserting Maintenance Follow-up Logs
-- =========================================================================

CREATE OR ALTER PROCEDURE dbo.sp_InsertMaintenanceFollowUp
    @MaintenanceItemID INT,
    @FollowUpDetail NVARCHAR(MAX),
    @CreateUserID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 1. Insert into EV_MaintenanceFollowUp table
    INSERT INTO dbo.EV_MaintenanceFollowUp (
        MaintenanceItemID,
        FollowUpDate,
        FollowUpDetail,
        IsActive,
        CreateDate,
        CreateUserID
    ) 
    VALUES (
        @MaintenanceItemID,
        CAST(GETDATE() AS DATE),
        @FollowUpDetail,
        1,
        GETDATE(),
        @CreateUserID
    );
    
    -- 2. Update LastFollowUpDate and FollowUpDetail in EV_MaintenanceItem table
    UPDATE dbo.EV_MaintenanceItem
    SET LastFollowUpDate = GETDATE(),
        FollowUpDetail = @FollowUpDetail,
        UpdateDate = GETDATE(),
        UpdateUserID = @CreateUserID
    WHERE MaintenanceItemID = @MaintenanceItemID AND IsActive = 1;
END;
GO

-- =========================================================================
-- SQL Server Stored Procedure for Creating a New Maintenance Ticket (JSON)
-- =========================================================================

CREATE OR ALTER PROCEDURE dbo.sp_InsertMaintenanceItemJson
    @MaintenanceJson NVARCHAR(MAX), -- JSON object payload
    @NewMaintenanceItemID INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @InventoryItemID INT,
            @IncidentDate DATETIME,
            @CarStatusCode NVARCHAR(50),
            @IssueTitle NVARCHAR(MAX),
            @ProblemTypeCode NVARCHAR(50),
            @FaultPartyCode NVARCHAR(50),
            @CarCaseCode NVARCHAR(50),
            @ServiceLocationCode NVARCHAR(50),
            @InsuranceCode NVARCHAR(50),
            @FollowUpDetail NVARCHAR(MAX),
            @CreateUserID INT,
            @RegisterNo NVARCHAR(50),
            @VinNo NVARCHAR(50),
            @DriverName NVARCHAR(255);

    -- Extract values from JSON
    SELECT 
        @InventoryItemID = JSON_VALUE(@MaintenanceJson, '$.inventoryItemId'),
        @IncidentDate = JSON_VALUE(@MaintenanceJson, '$.incidentDate'),
        @CarStatusCode = JSON_VALUE(@MaintenanceJson, '$.carStatusCode'),
        @IssueTitle = JSON_VALUE(@MaintenanceJson, '$.issueTitle'),
        @ProblemTypeCode = JSON_VALUE(@MaintenanceJson, '$.problemTypeCode'),
        @FaultPartyCode = JSON_VALUE(@MaintenanceJson, '$.faultPartyCode'),
        @CarCaseCode = JSON_VALUE(@MaintenanceJson, '$.carCaseCode'),
        @ServiceLocationCode = JSON_VALUE(@MaintenanceJson, '$.serviceLocationCode'),
        @InsuranceCode = JSON_VALUE(@MaintenanceJson, '$.insuranceCode'),
        @FollowUpDetail = JSON_VALUE(@MaintenanceJson, '$.followUpDetail'),
        @CreateUserID = JSON_VALUE(@MaintenanceJson, '$.createUserId'),
        @RegisterNo = JSON_VALUE(@MaintenanceJson, '$.registerNo'),
        @VinNo = JSON_VALUE(@MaintenanceJson, '$.vinNo'),
        @DriverName = JSON_VALUE(@MaintenanceJson, '$.driverName');

    INSERT INTO dbo.EV_MaintenanceItem (
        InventoryItemID,
        ReportDate,
        IncidentDate,
        CarStatusCode,
        IssueTitle,
        ProblemTypeCode,
        FaultPartyCode,
        CarCaseCode,
        ServiceLocationCode,
        InsuranceCode,
        FollowUpDetail,
        IsActive,
        CreateDate,
        CreateUserID,
        RegisterNo,
        VinNo,
        DriverName
    )
    VALUES (
        @InventoryItemID,
        GETDATE(),
        @IncidentDate,
        @CarStatusCode,
        @IssueTitle,
        @ProblemTypeCode,
        @FaultPartyCode,
        @CarCaseCode,
        @ServiceLocationCode,
        @InsuranceCode,
        @FollowUpDetail,
        1, -- IsActive is 1
        GETDATE(),
        @CreateUserID,
        @RegisterNo,
        @VinNo,
        @DriverName
    );

    SET @NewMaintenanceItemID = SCOPE_IDENTITY();

    -- If FollowUpDetail is provided, insert an initial follow-up record
    IF @FollowUpDetail IS NOT NULL AND LTRIM(RTRIM(@FollowUpDetail)) != ''
    BEGIN
        INSERT INTO dbo.EV_MaintenanceFollowUp (
            MaintenanceItemID,
            FollowUpDate,
            FollowUpDetail,
            IsActive,
            CreateDate,
            CreateUserID
        )
        VALUES (
            @NewMaintenanceItemID,
            CAST(GETDATE() AS DATE),
            @FollowUpDetail,
            1,
            GETDATE(),
            @CreateUserID
        );
    END
END;
GO

-- =========================================================================
-- SQL Server Stored Procedure for Updating Maintenance Ticket Details (JSON)
-- =========================================================================

CREATE OR ALTER PROCEDURE dbo.sp_UpdateMaintenanceItemJson
    @UpdateJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @MaintenanceItemID INT,
            @CarStatusCode NVARCHAR(50),
            @MaintenanceStartDate DATETIME,
            @MaintenanceFinishDate DATETIME,
            @ServiceLocationCode NVARCHAR(50),
            @ServiceLocationName NVARCHAR(255),
            @FollowUpDetail NVARCHAR(MAX),
            @UpdateUserID INT,
            @DeletedAttachmentIdsJson NVARCHAR(MAX);

    -- Parse JSON values
    SELECT
        @MaintenanceItemID = JSON_VALUE(@UpdateJson, '$.maintenanceId'),
        @CarStatusCode = JSON_VALUE(@UpdateJson, '$.carStatusCode'),
        @MaintenanceStartDate = CASE WHEN JSON_VALUE(@UpdateJson, '$.startDate') IS NOT NULL THEN CAST(JSON_VALUE(@UpdateJson, '$.startDate') AS DATETIME) ELSE NULL END,
        @MaintenanceFinishDate = CASE WHEN JSON_VALUE(@UpdateJson, '$.finishDate') IS NOT NULL THEN CAST(JSON_VALUE(@UpdateJson, '$.finishDate') AS DATETIME) ELSE NULL END,
        @ServiceLocationCode = JSON_VALUE(@UpdateJson, '$.serviceLocationCode'),
        @ServiceLocationName = JSON_VALUE(@UpdateJson, '$.serviceLocationName'),
        @FollowUpDetail = JSON_VALUE(@UpdateJson, '$.followUpDetail'),
        @UpdateUserID = JSON_VALUE(@UpdateJson, '$.updateUserId'),
        @DeletedAttachmentIdsJson = JSON_QUERY(@UpdateJson, '$.deletedAttachmentIds');

    -- 1. Update EV_MaintenanceItem table
    UPDATE dbo.EV_MaintenanceItem
    SET 
        CarStatusCode = COALESCE(@CarStatusCode, CarStatusCode),
        MaintenanceStartDate = COALESCE(@MaintenanceStartDate, MaintenanceStartDate),
        MaintenanceFinishDate = COALESCE(@MaintenanceFinishDate, MaintenanceFinishDate),
        ServiceLocationCode = COALESCE(@ServiceLocationCode, ServiceLocationCode),
        UpdateDate = GETDATE(),
        UpdateUserID = @UpdateUserID
    WHERE MaintenanceItemID = @MaintenanceItemID AND IsActive = 1;

    -- 2. Auto-insert follow-up for location update if location changed
    IF @ServiceLocationCode IS NOT NULL
    BEGIN
        DECLARE @LocText NVARCHAR(MAX) = COALESCE(@ServiceLocationName, @ServiceLocationCode);
        INSERT INTO dbo.EV_MaintenanceFollowUp (
            MaintenanceItemID,
            FollowUpDate,
            FollowUpDetail,
            IsActive,
            CreateDate,
            CreateUserID
        )
        VALUES (
            @MaintenanceItemID,
            CAST(GETDATE() AS DATE),
            N'📍 อัปเดตสถานที่ซ่อมบำรุงเป็น: ' + @LocText,
            1,
            GETDATE(),
            @UpdateUserID
        );
    END

    -- 3. Insert manual follow-up progress log
    IF @FollowUpDetail IS NOT NULL AND LTRIM(RTRIM(@FollowUpDetail)) != ''
    BEGIN
        INSERT INTO dbo.EV_MaintenanceFollowUp (
            MaintenanceItemID,
            FollowUpDate,
            FollowUpDetail,
            IsActive,
            CreateDate,
            CreateUserID
        )
        VALUES (
            @MaintenanceItemID,
            CAST(GETDATE() AS DATE),
            @FollowUpDetail,
            1,
            GETDATE(),
            @UpdateUserID
        );

        -- Update parent ticket last follow up info
        UPDATE dbo.EV_MaintenanceItem
        SET LastFollowUpDate = GETDATE(),
            FollowUpDetail = @FollowUpDetail
        WHERE MaintenanceItemID = @MaintenanceItemID AND IsActive = 1;
    END

    -- 4. Delete attachments (if provided)
    IF @DeletedAttachmentIdsJson IS NOT NULL
    BEGIN
        DECLARE @TempIDs TABLE (FileAttachmentID INT);
        
        INSERT INTO @TempIDs (FileAttachmentID)
        SELECT value
        FROM OPENJSON(@DeletedAttachmentIdsJson);

        UPDATE dbo.EV_FileAttachmentMaintenanceItem
        SET IsActive = 0,
            UpdatedBy = @UpdateUserID,
            UpdatedDate = GETDATE()
        WHERE MaintenanceItemID = @MaintenanceItemID
          AND FileAttachmentID IN (SELECT FileAttachmentID FROM @TempIDs);
    END
END;
GO

-- =========================================================================
-- SQL Server Grant Execution Permission Script
-- =========================================================================

-- Grant EXECUTE permissions on Stored Procedures to the read-only database user
GRANT EXECUTE ON dbo.sp_InsertMaintenanceAttachmentsJson TO [user_readonly];
GRANT EXECUTE ON dbo.sp_DeleteMaintenanceAttachmentsJson TO [user_readonly];
GRANT EXECUTE ON dbo.sp_UpdateMaintenanceItem TO [user_readonly];
GRANT EXECUTE ON dbo.sp_InsertMaintenanceFollowUp TO [user_readonly];
GRANT EXECUTE ON dbo.sp_InsertMaintenanceItemJson TO [user_readonly];
GRANT EXECUTE ON dbo.sp_UpdateMaintenanceItemJson TO [user_readonly];
GO
