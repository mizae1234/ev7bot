import { ParsedPolicyFile } from './policy-types'

/**
 * Parses insurance & compulsory (พ.ร.บ.) PDF filename
 * Examples:
 *   PLMV_LNAAKAA12R5E01443_DV1BK2508000072_17082569.PDF (Voluntary Insurance Type 1)
 *   PLMC_LNAAKAA12R5E01443_DACBK2508000072_17082569.PDF (Compulsory / Act พ.ร.บ.)
 */
export function parsePolicyFileName(fileName: string, fileSize = 0): ParsedPolicyFile {
  const cleanName = fileName.trim()
  const baseName = cleanName.replace(/\.[^/.]+$/, '') // Remove extension
  const extMatch = cleanName.match(/\.([a-zA-Z0-9]+)$/)
  const ext = extMatch ? extMatch[1].toLowerCase() : ''

  if (ext !== 'pdf') {
    return {
      originalFileName: cleanName,
      fileSize,
      prefix: 'UNKNOWN',
      docType: 'UNKNOWN',
      policyType: null,
      policyTypeName: null,
      vinNo: null,
      policyNo: null,
      rawExpiryBuddhist: null,
      expiryDateStr: null,
      startDateStr: null,
      isValid: false,
      validationError: 'ไฟล์ต้องเป็นนามสกุล .PDF เท่านั้น'
    }
  }

  // Split by underscore or hyphen delimiter
  const parts = baseName.split('_')

  if (parts.length < 4) {
    return {
      originalFileName: cleanName,
      fileSize,
      prefix: 'UNKNOWN',
      docType: 'UNKNOWN',
      policyType: null,
      policyTypeName: null,
      vinNo: null,
      policyNo: null,
      rawExpiryBuddhist: null,
      expiryDateStr: null,
      startDateStr: null,
      isValid: false,
      validationError: 'รูปแบบชื่อไฟล์ไม่ถูกต้อง (ต้องมี 4 ส่วน เช่น PLMV_VIN_POLICYNO_EXPIRY.PDF)'
    }
  }

  const rawPrefix = parts[0].toUpperCase()
  const rawVin = parts[1].toUpperCase()
  const rawPolicyNo = parts[2].toUpperCase()
  const rawExpiry = parts[3]

  // 1. Check Prefix
  let prefix: 'PLMV' | 'PLMC' | 'UNKNOWN' = 'UNKNOWN'
  let docType: 'INSURANCE' | 'ACT' | 'UNKNOWN' = 'UNKNOWN'

  if (rawPrefix === 'PLMV') {
    prefix = 'PLMV'
    docType = 'INSURANCE'
  } else if (rawPrefix === 'PLMC') {
    prefix = 'PLMC'
    docType = 'ACT'
  } else {
    // If prefix is not PLMV/PLMC, check if it starts with DAC for Act or DV for Insurance
    if (rawPolicyNo.startsWith('DAC') || rawPrefix.includes('ACT') || rawPrefix.includes('PRB')) {
      prefix = 'PLMC'
      docType = 'ACT'
    } else {
      prefix = 'PLMV'
      docType = 'INSURANCE'
    }
  }

  // 2. Check VIN
  let vinNo = rawVin
  if (vinNo.length !== 17) {
    // Check if another part has 17 characters
    const foundVin = parts.find(p => p.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/i.test(p))
    if (foundVin) {
      vinNo = foundVin.toUpperCase()
    }
  }

  if (vinNo.length !== 17) {
    return {
      originalFileName: cleanName,
      fileSize,
      prefix,
      docType,
      policyType: null,
      policyTypeName: null,
      vinNo,
      policyNo: rawPolicyNo,
      rawExpiryBuddhist: rawExpiry,
      expiryDateStr: null,
      startDateStr: null,
      isValid: false,
      validationError: `เลขตัวถัง (VIN) ต้องมีความยาว 17 หลัก (พบ ${vinNo.length} หลัก: "${vinNo}")`
    }
  }

  // 3. Check Policy Type
  let policyType: string | null = null
  let policyTypeName: string | null = null

  if (docType === 'ACT' || rawPolicyNo.startsWith('DAC')) {
    policyType = 'DAC'
    policyTypeName = 'พ.ร.บ. คุ้มครองผู้ประสบภัยจากรถ'
  } else if (rawPolicyNo.startsWith('DV1')) {
    policyType = 'DV1'
    policyTypeName = 'ประกันภัยชั้น 1'
  } else if (rawPolicyNo.startsWith('DV2')) {
    policyType = 'DV2'
    policyTypeName = 'ประกันภัยชั้น 2'
  } else if (rawPolicyNo.startsWith('DV3')) {
    policyType = 'DV3'
    policyTypeName = 'ประกันภัยชั้น 3'
  } else if (rawPolicyNo.startsWith('DV5')) {
    policyType = 'DV5'
    policyTypeName = 'ประกันภัย 2+, 3+'
  } else {
    // Default fallback based on prefix
    if (prefix === 'PLMC') {
      policyType = 'DAC'
      policyTypeName = 'พ.ร.บ. คุ้มครองผู้ประสบภัยจากรถ'
    } else {
      policyType = 'DV1'
      policyTypeName = 'ประกันภัยภาคสมัครใจ'
    }
  }

  // 4. Parse Expiry Date: DDMMYYYY in Buddhist Era (e.g. 17082569)
  let expiryDateStr: string | null = null
  let startDateStr: string | null = null

  // Clean date digits
  const dateDigits = rawExpiry.replace(/\D/g, '')

  if (dateDigits.length === 8) {
    const dd = parseInt(dateDigits.substring(0, 2), 10)
    const mm = parseInt(dateDigits.substring(2, 4), 10)
    const yyyyBE = parseInt(dateDigits.substring(4, 8), 10)

    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      let yyyyAD = yyyyBE
      // If Buddhist Era (e.g. > 2500), convert to Christian Era
      if (yyyyBE >= 2500) {
        yyyyAD = yyyyBE - 543
      }

      const formattedMonth = String(mm).padStart(2, '0')
      const formattedDay = String(dd).padStart(2, '0')
      expiryDateStr = `${yyyyAD}-${formattedMonth}-${formattedDay}`

      // Estimate Start Date as 1 year before
      const startYear = yyyyAD - 1
      startDateStr = `${startYear}-${formattedMonth}-${formattedDay}`
    }
  }

  if (!expiryDateStr) {
    return {
      originalFileName: cleanName,
      fileSize,
      prefix,
      docType,
      policyType,
      policyTypeName,
      vinNo,
      policyNo: rawPolicyNo,
      rawExpiryBuddhist: rawExpiry,
      expiryDateStr: null,
      startDateStr: null,
      isValid: false,
      validationError: `รูปแบบวันหมดอายุไม่ถูกต้อง "${rawExpiry}" (ต้องเป็น 8 หลัก วัน/เดือน/ปี พ.ศ. เช่น 17082569)`
    }
  }

  return {
    originalFileName: cleanName,
    fileSize,
    prefix,
    docType,
    policyType,
    policyTypeName,
    vinNo,
    policyNo: rawPolicyNo,
    rawExpiryBuddhist: dateDigits,
    expiryDateStr,
    startDateStr,
    isValid: true,
    validationError: null
  }
}
