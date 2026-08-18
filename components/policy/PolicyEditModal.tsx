import React, { useState, useEffect } from 'react'
import { PolicyVehicleRecord, InsuranceMasterType } from '@/lib/policy/policy-types'

interface PolicyEditModalProps {
  record: PolicyVehicleRecord | null
  isOpen: boolean
  onClose: () => void
  onSaveSuccess: () => void
  masterTypes: InsuranceMasterType[]
  lineUserId?: string | null
}

export function PolicyEditModal({
  record,
  isOpen,
  onClose,
  onSaveSuccess,
  masterTypes,
  lineUserId
}: PolicyEditModalProps) {
  const [formData, setFormData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (record) {
      setFormData({
        vinNo: record.vinNo,
        registerNo: record.registerNo || '',
        insurancePolicyNo: record.insurancePolicyNo || '',
        insuranceType: record.insuranceType || 'DV1',
        insuranceStartDate: record.insuranceStartDate || '',
        insuranceEndDate: record.insuranceEndDate || '',
        insuranceCompany: record.insuranceCompany || '',
        actPolicyNo: record.actPolicyNo || '',
        actStartDate: record.actStartDate || '',
        actEndDate: record.actEndDate || '',
        actCompany: record.actCompany || '',
        vehicleTaxStartDate: record.vehicleTaxStartDate || '',
        vehicleTaxEndDate: record.vehicleTaxEndDate || '',
        meterTaxStartDate: record.meterTaxStartDate || '',
        meterTaxEndDate: record.meterTaxEndDate || ''
      })
      setError(null)
    }
  }, [record])

  if (!isOpen || !record) return null

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

  return (
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              ⚠️ {error}
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
                  value={formData.insuranceType || 'DV1'}
                  onChange={(e) => setFormData({ ...formData, insuranceType: e.target.value })}
                  className="w-full text-xs py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
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
  )
}
