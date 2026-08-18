import React, { useState, useEffect, useRef } from 'react'
import { PolicyVehicleRecord, InsuranceMasterType, InsuranceCompanyOption } from '@/lib/policy/policy-types'
import { PdfViewerModal } from './PdfViewerModal'

interface PolicyEditModalProps {
  record: PolicyVehicleRecord | null
  isOpen: boolean
  onClose: () => void
  onSaveSuccess: () => void
  masterTypes: InsuranceMasterType[]
  companies?: InsuranceCompanyOption[]
  lineUserId?: string | null
}

const SPACES_CDN = process.env.NEXT_PUBLIC_SPACES_CDN_URL || 'https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com'

export function PolicyEditModal({
  record,
  isOpen,
  onClose,
  onSaveSuccess,
  masterTypes,
  companies = [],
  lineUserId
}: PolicyEditModalProps) {
  const [formData, setFormData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    if (record) {
      setFormData({
        vinNo: record.vinNo,
        registerNo: record.registerNo || '',
        insurancePolicyNo: record.insurancePolicyNo || '',
        insuranceType: record.insuranceType || '',
        insuranceStartDate: record.insuranceStartDate || '',
        insuranceEndDate: record.insuranceEndDate || '',
        insuranceCompany: record.insuranceCompany || '',
        insuranceFilePath: record.insuranceFilePath || '',
        actPolicyNo: record.actPolicyNo || '',
        actStartDate: record.actStartDate || '',
        actEndDate: record.actEndDate || '',
        actCompany: record.actCompany || '',
        actFilePath: record.actFilePath || '',
        vehicleTaxStartDate: record.vehicleTaxStartDate || '',
        vehicleTaxEndDate: record.vehicleTaxEndDate || '',
        vehicleTaxFilePath: record.vehicleTaxFilePath || '',
        meterTaxStartDate: record.meterTaxStartDate || '',
        meterTaxEndDate: record.meterTaxEndDate || '',
        meterTaxFilePath: record.meterTaxFilePath || ''
      })
      setError(null)
      setUploadError(null)
      setUploadingDoc(null)
    }
  }, [record])

  if (!isOpen || !record) return null

  const getFullUrl = (path?: string | null) => {
    if (!path) return ''
    if (path.startsWith('http')) return path
    return `${SPACES_CDN}/${path}`
  }

  // Handle single file upload for a specific document type
  const handleSingleFileUpload = async (
    file: File,
    docType: 'INSURANCE' | 'ACT' | 'VEHICLE_TAX' | 'METER_TAX'
  ) => {
    if (!file) return
    try {
      setUploadingDoc(docType)
      setUploadError(null)

      const uploadForm = new FormData()
      uploadForm.append('file', file)
      uploadForm.append('vinNo', record.vinNo)
      if (record.registerNo) uploadForm.append('registerNo', record.registerNo)
      uploadForm.append('docType', docType)
      if (lineUserId) uploadForm.append('lineUserId', lineUserId)

      const res = await fetch('/api/policy/upload-single', {
        method: 'POST',
        body: uploadForm
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์')
      }

      // Update state with newly uploaded file path
      if (docType === 'INSURANCE') {
        setFormData((prev: any) => ({ ...prev, insuranceFilePath: data.filePath }))
      } else if (docType === 'ACT') {
        setFormData((prev: any) => ({ ...prev, actFilePath: data.filePath }))
      } else if (docType === 'VEHICLE_TAX') {
        setFormData((prev: any) => ({ ...prev, vehicleTaxFilePath: data.filePath }))
      } else if (docType === 'METER_TAX') {
        setFormData((prev: any) => ({ ...prev, meterTaxFilePath: data.filePath }))
      }

      onSaveSuccess()
    } catch (err: any) {
      console.error('[Upload Single Policy Error]', err)
      setUploadError(`อัปโหลดไฟล์ไม่สำเร็จ: ${err.message}`)
    } finally {
      setUploadingDoc(null)
    }
  }

  const handleRemoveFile = (docType: 'INSURANCE' | 'ACT' | 'VEHICLE_TAX' | 'METER_TAX') => {
    if (docType === 'INSURANCE') {
      setFormData((prev: any) => ({ ...prev, insuranceFilePath: '' }))
    } else if (docType === 'ACT') {
      setFormData((prev: any) => ({ ...prev, actFilePath: '' }))
    } else if (docType === 'VEHICLE_TAX') {
      setFormData((prev: any) => ({ ...prev, vehicleTaxFilePath: '' }))
    } else if (docType === 'METER_TAX') {
      setFormData((prev: any) => ({ ...prev, meterTaxFilePath: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          lineUserId
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        onSaveSuccess()
        onClose()
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการบันทึก')
      }
    } catch (err: any) {
      setError(err.message || 'การเชื่อมต่อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  // Component for file attachment control
  const FileAttachmentField = ({
    docType,
    filePath,
    title,
    accentColor = 'blue'
  }: {
    docType: 'INSURANCE' | 'ACT' | 'VEHICLE_TAX' | 'METER_TAX'
    filePath?: string | null
    title: string
    accentColor?: 'blue' | 'purple' | 'amber' | 'emerald'
  }) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const isUploading = uploadingDoc === docType

    const colorClasses = {
      blue: 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/60 hover:bg-blue-100/60',
      purple: 'text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/40 border-purple-200/80 dark:border-purple-800/60 hover:bg-purple-100/60',
      amber: 'text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100/60',
      emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100/60'
    }

    return (
      <div className="space-y-1.5 pt-1">
        <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          📎 แนบไฟล์เอกสาร ({title})
        </label>

        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleSingleFileUpload(f, docType)
            e.target.value = ''
          }}
          className="hidden"
        />

        {filePath ? (
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 shadow-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 text-xs">
                📄
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {filePath.split('/').pop() || 'เอกสารแนบ'}
                </p>
                <p className="text-[10px] text-zinc-400 font-mono truncate">
                  {filePath}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewDoc({ url: getFullUrl(filePath), title: `${title} - ${record.registerNo || record.vinNo}` })}
                className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>👁️</span> ดูเอกสาร
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                title="เปลี่ยนไฟล์"
              >
                🔄 เปลี่ยน
              </button>

              <button
                type="button"
                onClick={() => handleRemoveFile(docType)}
                className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                title="ลบไฟล์แนบ"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-2.5 px-3 rounded-xl border border-dashed text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isUploading
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700 cursor-not-allowed'
                  : colorClasses[accentColor]
              }`}
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>กำลังอัปโหลดไฟล์...</span>
                </>
              ) : (
                <>
                  <span>📤</span>
                  <span>คลิกเพื่ออัปโหลดไฟล์ {title} (PDF, PNG, JPG)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal Card */}
        <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-10 my-8">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>✏️ จัดการข้อมูลประกันภัยและภาษี</span>
              </h3>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                ทะเบียน: {record.registerNo || 'ไม่มีทะเบียน'} | VIN: {record.vinNo}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                ⚠️ {error}
              </div>
            )}

            {uploadError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                ⚠️ {uploadError}
              </div>
            )}

            {/* Section 1: ประกันภาคสมัครใจ (PLMV) */}
            <div className="space-y-3 p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 uppercase tracking-wider">
                <span>🛡️ ประกันภัยภาคสมัครใจ (PLMV)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    ประเภทประกัน
                  </label>
                  <select
                    value={formData.insuranceType || ''}
                    onChange={(e) => setFormData({ ...formData, insuranceType: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">-- กรุณาเลือกประเภทประกัน --</option>
                    {masterTypes.filter(m => m.category === 'VOLUNTARY').map(m => (
                      <option key={m.typeCode} value={m.typeCode}>
                        {m.typeCode} - {m.typeName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    เลขที่กรมธรรม์
                  </label>
                  <input
                    type="text"
                    value={formData.insurancePolicyNo || ''}
                    onChange={(e) => setFormData({ ...formData, insurancePolicyNo: e.target.value })}
                    placeholder="เช่น DV1BK2508000072"
                    className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    วันเริ่มคุ้มครอง
                  </label>
                  <input
                    type="date"
                    value={formData.insuranceStartDate || ''}
                    onChange={(e) => setFormData({ ...formData, insuranceStartDate: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    วันหมดอายุความคุ้มครอง
                  </label>
                  <input
                    type="date"
                    value={formData.insuranceEndDate || ''}
                    onChange={(e) => setFormData({ ...formData, insuranceEndDate: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    🏢 บริษัทประกันภัย
                  </label>
                  <select
                    value={formData.insuranceCompany || ''}
                    onChange={(e) => setFormData({ ...formData, insuranceCompany: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">-- กรุณาเลือกบริษัทประกันภัย --</option>
                    {companies.length > 0 ? (
                      companies.map(c => (
                        <option key={c.statusCode} value={c.statusName}>
                          {c.statusName} ({c.statusCode})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="ไอแคร์ประกันภัย">ไอแคร์ประกันภัย (ICARE_INSURANCE)</option>
                        <option value="เมืองไทยประกันภัย">เมืองไทยประกันภัย (MUANGTHAI_INSURANCE)</option>
                        <option value="วิริยะประกันภัย">วิริยะประกันภัย (VIRIYA_INSURANCE)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Upload Single File: Insurance PDF/Image */}
                <div className="sm:col-span-2">
                  <FileAttachmentField
                    docType="INSURANCE"
                    filePath={formData.insuranceFilePath}
                    title="กรมธรรม์ประกันภัย"
                    accentColor="blue"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: พ.ร.บ. (PLMC) */}
            <div className="space-y-3 p-4 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
              <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5 uppercase tracking-wider">
                <span>📜 พ.ร.บ. คุ้มครองผู้ประสบภัยจากรถ (PLMC)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    เลขที่ พ.ร.บ.
                  </label>
                  <input
                    type="text"
                    value={formData.actPolicyNo || ''}
                    onChange={(e) => setFormData({ ...formData, actPolicyNo: e.target.value })}
                    placeholder="เช่น DACBK2508000072"
                    className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    วันหมดอายุ พ.ร.บ.
                  </label>
                  <input
                    type="date"
                    value={formData.actEndDate || ''}
                    onChange={(e) => setFormData({ ...formData, actEndDate: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    🏢 บริษัทผู้รับประกัน พ.ร.บ.
                  </label>
                  <select
                    value={formData.actCompany || ''}
                    onChange={(e) => setFormData({ ...formData, actCompany: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    <option value="">-- กรุณาเลือกบริษัท พ.ร.บ. --</option>
                    {companies.length > 0 ? (
                      companies.map(c => (
                        <option key={c.statusCode} value={c.statusName}>
                          {c.statusName} ({c.statusCode})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="ไอแคร์ประกันภัย">ไอแคร์ประกันภัย (ICARE_INSURANCE)</option>
                        <option value="เมืองไทยประกันภัย">เมืองไทยประกันภัย (MUANGTHAI_INSURANCE)</option>
                        <option value="วิริยะประกันภัย">วิริยะประกันภัย (VIRIYA_INSURANCE)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Upload Single File: Act PDF/Image */}
                <div className="sm:col-span-2">
                  <FileAttachmentField
                    docType="ACT"
                    filePath={formData.actFilePath}
                    title="เอกสาร พ.ร.บ."
                    accentColor="purple"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: ภาษีรถประจำปี และภาษีมิเตอร์ */}
            <div className="space-y-3 p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                <span>🏷️ ภาษีรถยนต์ประจำปี และ ภาษีมิเตอร์แท็กซี่</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    วันหมดอายุภาษีรถประจำปี
                  </label>
                  <input
                    type="date"
                    value={formData.vehicleTaxEndDate || ''}
                    onChange={(e) => setFormData({ ...formData, vehicleTaxEndDate: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    วันหมดอายุตรวจมิเตอร์แท็กซี่
                  </label>
                  <input
                    type="date"
                    value={formData.meterTaxEndDate || ''}
                    onChange={(e) => setFormData({ ...formData, meterTaxEndDate: e.target.value })}
                    className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Upload Single File: Vehicle Tax */}
                <div className="sm:col-span-2">
                  <FileAttachmentField
                    docType="VEHICLE_TAX"
                    filePath={formData.vehicleTaxFilePath}
                    title="ป้ายภาษีรถยนต์ประจำปี"
                    accentColor="amber"
                  />
                </div>

                {/* Upload Single File: Meter Tax */}
                <div className="sm:col-span-2">
                  <FileAttachmentField
                    docType="METER_TAX"
                    filePath={formData.meterTaxFilePath}
                    title="เอกสารตรวจมิเตอร์แท็กซี่"
                    accentColor="emerald"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer Buttons */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin text-zinc-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>บันทึกข้อมูล</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* PDF / File Preview Modal */}
      {previewDoc && (
        <PdfViewerModal
          url={previewDoc.url}
          title={previewDoc.title}
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </>
  )
}
