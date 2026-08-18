-- ==============================================================================
-- Migration: Create EV_MsInsuranceType, Alter EV_Policy, Create EV_PolicyLog
-- Description: Master table for insurance/policy types, enhanced EV_Policy, and audit history log.
-- Safety: Additive only. Zero impact on existing tables.
-- ==============================================================================

-- 1. Create Master Table for Insurance Types (dbo.EV_MsInsuranceType)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EV_MsInsuranceType]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[EV_MsInsuranceType] (
        [TypeCode] VARCHAR(20) NOT NULL PRIMARY KEY,
        [TypeName] NVARCHAR(100) NOT NULL,
        [Category] VARCHAR(50) NOT NULL, -- 'VOLUNTARY', 'COMPULSORY', 'TAX'
        [FilePrefix] VARCHAR(20) NULL,   -- 'PLMV', 'PLMC'
        [Description] NVARCHAR(255) NULL,
        [SortOrder] INT NOT NULL DEFAULT 0,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreateDate] DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

-- Seed / Sync Master Insurance Types
IF NOT EXISTS (SELECT 1 FROM [dbo].[EV_MsInsuranceType] WHERE [TypeCode] = 'DV1')
    INSERT INTO [dbo].[EV_MsInsuranceType] ([TypeCode], [TypeName], [Category], [FilePrefix], [Description], [SortOrder], [IsActive])
    VALUES ('DV1', N'ประกันภัยชั้น 1', 'VOLUNTARY', 'PLMV', N'ประกันภัยรถยนต์ภาคสมัครใจ ประเภท 1', 1, 1);

IF NOT EXISTS (SELECT 1 FROM [dbo].[EV_MsInsuranceType] WHERE [TypeCode] = 'DV2')
    INSERT INTO [dbo].[EV_MsInsuranceType] ([TypeCode], [TypeName], [Category], [FilePrefix], [Description], [SortOrder], [IsActive])
    VALUES ('DV2', N'ประกันภัยชั้น 2', 'VOLUNTARY', 'PLMV', N'ประกันภัยรถยนต์ภาคสมัครใจ ประเภท 2', 2, 1);

IF NOT EXISTS (SELECT 1 FROM [dbo].[EV_MsInsuranceType] WHERE [TypeCode] = 'DV3')
    INSERT INTO [dbo].[EV_MsInsuranceType] ([TypeCode], [TypeName], [Category], [FilePrefix], [Description], [SortOrder], [IsActive])
    VALUES ('DV3', N'ประกันภัยชั้น 3', 'VOLUNTARY', 'PLMV', N'ประกันภัยรถยนต์ภาคสมัครใจ ประเภท 3', 3, 1);

IF NOT EXISTS (SELECT 1 FROM [dbo].[EV_MsInsuranceType] WHERE [TypeCode] = 'DV5')
    INSERT INTO [dbo].[EV_MsInsuranceType] ([TypeCode], [TypeName], [Category], [FilePrefix], [Description], [SortOrder], [IsActive])
    VALUES ('DV5', N'ประกันภัย 2+, 3+', 'VOLUNTARY', 'PLMV', N'ประกันภัยรถยนต์ภาคสมัครใจ ประเภท 2+ หรือ 3+', 4, 1);

IF NOT EXISTS (SELECT 1 FROM [dbo].[EV_MsInsuranceType] WHERE [TypeCode] = 'DAC')
    INSERT INTO [dbo].[EV_MsInsuranceType] ([TypeCode], [TypeName], [Category], [FilePrefix], [Description], [SortOrder], [IsActive])
    VALUES ('DAC', N'พ.ร.บ. คุ้มครองผู้ประสบภัยจากรถ', 'COMPULSORY', 'PLMC', N'ประกันภัยภาคบังคับ (พ.ร.บ.)', 5, 1);

IF NOT EXISTS (SELECT 1 FROM [dbo].[EV_MsInsuranceType] WHERE [TypeCode] = 'TAX_VEHICLE')
    INSERT INTO [dbo].[EV_MsInsuranceType] ([TypeCode], [TypeName], [Category], [FilePrefix], [Description], [SortOrder], [IsActive])
    VALUES ('TAX_VEHICLE', N'ภาษีรถยนต์ประจำปี', 'TAX', NULL, N'ป้ายภาษี/ต่อภาษีรถยนต์ประจำปี', 6, 1);

IF NOT EXISTS (SELECT 1 FROM [dbo].[EV_MsInsuranceType] WHERE [TypeCode] = 'TAX_METER')
    INSERT INTO [dbo].[EV_MsInsuranceType] ([TypeCode], [TypeName], [Category], [FilePrefix], [Description], [SortOrder], [IsActive])
    VALUES ('TAX_METER', N'ภาษีตรวจมิเตอร์แท็กซี่', 'TAX', NULL, N'การตรวจรับรองมิเตอร์แท็กซี่ประจำปี', 7, 1);
GO

-- 2. Ensure / Alter Table dbo.EV_Policy (Additive columns only)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[EV_Policy] (
        [PolicyID] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [VinNo] VARCHAR(50) NOT NULL,
        [RegisterNo] VARCHAR(50) NULL,
        [RegisterBookCopyPath] VARCHAR(500) NULL,
        [RegisterDate] DATE NULL,
        [InsurancePolicyNo] VARCHAR(100) NULL,
        [InsuranceType] VARCHAR(20) NULL,
        [InsuranceStartDate] DATE NULL,
        [InsuranceEndDate] DATE NULL,
        [InsuranceFilePath] VARCHAR(500) NULL,
        [InsuranceCompany] NVARCHAR(100) NULL,
        [ActPolicyNo] VARCHAR(100) NULL,
        [ActStartDate] DATE NULL,
        [ActEndDate] DATE NULL,
        [ActFilePath] VARCHAR(500) NULL,
        [ActCompany] NVARCHAR(100) NULL,
        [VehicleTaxStartDate] DATE NULL,
        [VehicleTaxEndDate] DATE NULL,
        [VehicleTaxFilePath] VARCHAR(500) NULL,
        [MeterTaxStartDate] DATE NULL,
        [MeterTaxEndDate] DATE NULL,
        [MeterTaxFilePath] VARCHAR(500) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreateDate] DATETIME NOT NULL DEFAULT GETDATE(),
        [CreateUserID] INT NULL,
        [UpdateDate] DATETIME NULL,
        [UpdateUserID] INT NULL
    );
END
ELSE
BEGIN
    -- Add any missing columns safely
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'InsuranceType')
        ALTER TABLE [dbo].[EV_Policy] ADD [InsuranceType] VARCHAR(20) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'InsuranceFilePath')
        ALTER TABLE [dbo].[EV_Policy] ADD [InsuranceFilePath] VARCHAR(500) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'InsuranceCompany')
        ALTER TABLE [dbo].[EV_Policy] ADD [InsuranceCompany] NVARCHAR(100) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'ActFilePath')
        ALTER TABLE [dbo].[EV_Policy] ADD [ActFilePath] VARCHAR(500) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'ActCompany')
        ALTER TABLE [dbo].[EV_Policy] ADD [ActCompany] NVARCHAR(100) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'VehicleTaxStartDate')
        ALTER TABLE [dbo].[EV_Policy] ADD [VehicleTaxStartDate] DATE NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'VehicleTaxEndDate')
        ALTER TABLE [dbo].[EV_Policy] ADD [VehicleTaxEndDate] DATE NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'VehicleTaxFilePath')
        ALTER TABLE [dbo].[EV_Policy] ADD [VehicleTaxFilePath] VARCHAR(500) NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'MeterTaxStartDate')
        ALTER TABLE [dbo].[EV_Policy] ADD [MeterTaxStartDate] DATE NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'MeterTaxEndDate')
        ALTER TABLE [dbo].[EV_Policy] ADD [MeterTaxEndDate] DATE NULL;

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_Policy]') AND name = 'MeterTaxFilePath')
        ALTER TABLE [dbo].[EV_Policy] ADD [MeterTaxFilePath] VARCHAR(500) NULL;
END
GO

-- Create Index on VinNo for EV_Policy
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_EV_Policy_VinNo' AND object_id = OBJECT_ID('dbo.EV_Policy'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_EV_Policy_VinNo] ON [dbo].[EV_Policy] ([VinNo]);
END
GO

-- 3. Create Policy Audit Log Table (dbo.EV_PolicyLog)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EV_PolicyLog]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[EV_PolicyLog] (
        [LogID] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [VinNo] VARCHAR(50) NOT NULL,
        [RegisterNo] VARCHAR(50) NULL,
        [DocType] VARCHAR(50) NOT NULL,       -- 'INSURANCE', 'ACT', 'VEHICLE_TAX', 'METER_TAX'
        [PolicyType] VARCHAR(20) NULL,        -- 'DV1', 'DV2', 'DV3', 'DV5', 'DAC', 'TAX_VEHICLE', 'TAX_METER'
        [PolicyTypeName] NVARCHAR(100) NULL,  -- 'ประกันภัยชั้น 1', 'พ.ร.บ.', etc.
        [PolicyNo] VARCHAR(100) NULL,
        [StartDate] DATE NULL,
        [EndDate] DATE NULL,
        [OriginalFileName] NVARCHAR(250) NULL,
        [FilePath] VARCHAR(500) NULL,         -- S3 Key or URL
        [FileSize] BIGINT NULL,
        [UploadSource] VARCHAR(50) NOT NULL DEFAULT 'BATCH_PDF_UPLOAD', -- 'BATCH_PDF_UPLOAD', 'EXCEL_IMPORT', 'MANUAL'
        [IsCurrent] BIT NOT NULL DEFAULT 1,   -- 1 = Current Active Doc, 0 = Archived History
        [Remark] NVARCHAR(500) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreateDate] DATETIME NOT NULL DEFAULT GETDATE(),
        [CreateUserID] INT NULL
    );

    CREATE NONCLUSTERED INDEX [IX_EV_PolicyLog_VinNo] ON [dbo].[EV_PolicyLog] ([VinNo]);
    CREATE NONCLUSTERED INDEX [IX_EV_PolicyLog_DocType] ON [dbo].[EV_PolicyLog] ([DocType]);
END
GO
