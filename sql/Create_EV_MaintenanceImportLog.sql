-- =========================================================================
-- Audit log for the "Import Excel" feature on /maintenance
-- One row per Excel row processed (imported or skipped), grouped by ImportBatchID.
-- Run by a DBA, then GRANT SELECT, INSERT ON dbo.EV_MaintenanceImportLog TO app_butter;
-- =========================================================================
CREATE TABLE dbo.EV_MaintenanceImportLog (
    ImportLogID       bigint IDENTITY(1,1) NOT NULL,
    ImportBatchID     uniqueidentifier NOT NULL,
    FileName          nvarchar(260) NULL,
    RowNo             int NOT NULL,
    ClaimNumber       nvarchar(100) NULL,
    InsuranceJobNo    nvarchar(100) NULL,
    RegisterNo        nvarchar(50) NULL,
    Result            varchar(40) NOT NULL,        -- IMPORTED / SKIP_* / ERROR
    Reason            nvarchar(500) NULL,
    MaintenanceItemID int NULL,                    -- set when Result = IMPORTED
    RawJson           nvarchar(max) NULL,          -- whole Excel row, keyed by header
    CreateUserID      int NULL,
    CreateDate        datetime NOT NULL CONSTRAINT DF_EV_MaintenanceImportLog_CreateDate DEFAULT GETDATE(),
    CONSTRAINT PK_EV_MaintenanceImportLog PRIMARY KEY CLUSTERED (ImportLogID)
);
GO

CREATE INDEX IX_EV_MaintenanceImportLog_Batch ON dbo.EV_MaintenanceImportLog (ImportBatchID);
CREATE INDEX IX_EV_MaintenanceImportLog_Maint ON dbo.EV_MaintenanceImportLog (MaintenanceItemID) WHERE MaintenanceItemID IS NOT NULL;
GO

-- Recommended: speeds up the duplicate-claim lookup done on every import.
-- Non-unique on purpose (existing data may already contain repeated/empty claim numbers).
-- CREATE INDEX IX_EV_MaintenanceItem_ClaimNumber ON dbo.EV_MaintenanceItem (ClaimNumber) WHERE ClaimNumber IS NOT NULL;
