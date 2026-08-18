-- ==============================================================================
-- Migration: Add InsuranceCompany to EV_PolicyLog and Refill existing with ICARE_INSURANCE (ไอแคร์ประกันภัย)
-- ==============================================================================

-- 1. Ensure InsuranceCompany exists in dbo.EV_PolicyLog
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EV_PolicyLog]') AND name = 'InsuranceCompany')
BEGIN
    ALTER TABLE [dbo].[EV_PolicyLog] ADD [InsuranceCompany] NVARCHAR(100) NULL;
END
GO

-- 2. Refill existing EV_Policy records with 'ไอแคร์ประกันภัย'
UPDATE dbo.EV_Policy
SET InsuranceCompany = N'ไอแคร์ประกันภัย'
WHERE InsurancePolicyNo IS NOT NULL 
  AND (InsuranceCompany IS NULL OR InsuranceCompany = '');
GO

-- 3. Refill existing EV_PolicyLog records with 'ไอแคร์ประกันภัย'
UPDATE dbo.EV_PolicyLog
SET InsuranceCompany = N'ไอแคร์ประกันภัย'
WHERE DocType = 'INSURANCE'
  AND (InsuranceCompany IS NULL OR InsuranceCompany = '');
GO
