'use client'

import React, { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface FollowUpLog {
  followUpId: number
  followUpDate: string
  followUpDetail: string
  createUserName: string
}

interface AttachedFile {
  id: string
  name: string
  url: string
  type: 'image' | 'document'
  fileSize?: string
}

export default function EditMaintenancePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id ? String(params.id) : '10023'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl max-w-md w-full space-y-4">
        <div className="w-16 h-16 bg-amber-50 rounded-full border border-amber-200 flex items-center justify-center text-3xl mx-auto">🚧</div>
        <h2 className="text-xl font-bold text-slate-900">หน้านี้ยังไม่เปิดใช้งาน</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          ระบบยังไม่เปิดให้แก้ไข/อัปเดตใบแจ้งซ่อมผ่านหน้าจอ Web Admin Desktop ในขณะนี้ กรุณาทำรายการผ่านมือถือ (Mobile LIFF) แทน
        </p>
        <button
          onClick={() => router.back()}
          className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl shadow-md transition"
        >
          ย้อนกลับ
        </button>
      </div>
    </div>
  )

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // 1. Basic Info
  const [project, setProject] = useState('Line Man')
  const [registerNo, setRegisterNo] = useState('กอ-8372')
  const [vinNo, setVinNo] = useState('LNADHAB36T1G02515')
  const [driverName, setDriverName] = useState('คุณ ศราวุธ คืนรถ')
  const [incidentDate, setIncidentDate] = useState('2026-06-26T09:30')
  const [reportDate, setReportDate] = useState('2026-06-26T10:00')
  const [issueTitle, setIssueTitle] = useState('รถขัดข้อง เครื่องยนต์สตาร์ทไม่ติดเนื่องจากแบตเตอรี่เสื่อมสภาพ')

  // 2. Problem Details
  const [problemType, setProblemType] = useState('WEAR')
  const [faultParty, setFaultParty] = useState('FAULT_DRIVER')
  const [carCase, setCarCase] = useState('DAMAGE_LIGHT')
  const [insurance, setInsurance] = useState('ICARE_INSURANCE')
  const [rootCause, setRootCause] = useState('แบตเตอรี่รถยนต์แรงดันตก ชาร์จไม่เข้า อายุการใช้งานเกินกำหนด')
  const [fixAction, setFixAction] = useState('ทำการจัมป์สตาร์ทเบื้องต้นและทำเรื่องขออนุมัติเปลี่ยนลูกใหม่ที่ศูนย์')

  // 3. Maintenance Details
  const [statusCode, setStatusCode] = useState('IN_MAINTENANCE')
  const [needsReplacement, setNeedsReplacement] = useState(true)
  const [replacementVin, setReplacementVin] = useState('')
  const [replacementLocation, setReplacementLocation] = useState('')
  const [replacementStartDate, setReplacementStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [replCarSearch, setReplCarSearch] = useState('')
  const [replacementCars, setReplacementCars] = useState<any[]>([])
  const [loadingReplacementCars, setLoadingReplacementCars] = useState(false)

  const loadReplacementCars = async (search: string = '') => {
    setLoadingReplacementCars(true)
    try {
      const res = await fetch(`/api/vehicles/search?replacement=true&q=${encodeURIComponent(search)}`)
      if (res.ok) {
        const data = await res.json()
        setReplacementCars(data)
      }
    } catch (err) {
      console.error('Failed to load replacement cars:', err)
    } finally {
      setLoadingReplacementCars(false)
    }
  }
  const [serviceLocation, setServiceLocation] = useState('HQ_GARAGE')
  const [startDate, setStartDate] = useState('2026-06-26')
  const [finishDate, setFinishDate] = useState('2026-06-29')
  const [returnDate, setReturnDate] = useState('')

  // 4. Follow-up Timeline Mock Data
  const [followUps, setFollowUps] = useState<FollowUpLog[]>([
    {
      followUpId: 2,
      followUpDate: '2026-06-27T10:00:00.000Z',
      followUpDetail: 'ยื่นเอกสารขออนุมัติเคลมเปลี่ยนแบตเตอรี่ก้อนใหม่แล้ว ศูนย์บริการเสนอราคากลับมาแล้ว รออนุมัติการจ่ายเงิน',
      createUserName: 'แอดมิน สมชาย'
    },
    {
      followUpId: 1,
      followUpDate: '2026-06-26T14:30:00.000Z',
      followUpDetail: 'นำรถสไลด์ไปลากจูงรถเข้ามาถึงอู่ศูนย์กลางแชสซี (สำนักงานใหญ่) เรียบร้อยแล้ว ช่างกำลังรื้อตรวจสอบแรงดันไฟ',
      createUserName: 'แอดมิน กิตติพงษ์'
    }
  ])

  // New Follow Up form state
  const [newFollowUpText, setNewFollowUpText] = useState('')

  // Dynamic attachments list prefilled with some mock records
  const [attachments, setAttachments] = useState<AttachedFile[]>([
    {
      id: 'prefill-1',
      name: 'front_bumper_damage.jpg',
      url: 'https://images.unsplash.com/photo-1508974239320-0a029497e820?q=80&w=200&auto=format&fit=crop', // mock image url
      type: 'image',
      fileSize: '1.24 MB'
    },
    {
      id: 'prefill-2',
      name: 'insurance_claim_form_signed.pdf',
      url: '#',
      type: 'document',
      fileSize: '2.45 MB'
    }
  ])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'document') => {
    const files = e.target.files
    if (files && files.length > 0) {
      const newAttachments: AttachedFile[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const url = URL.createObjectURL(file)
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2)
        newAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          url,
          type: fileType,
          fileSize: `${sizeMb} MB`
        })
      }
      setAttachments(prev => [...prev, ...newAttachments])
    }
    e.target.value = ''
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

  const fetchDriverFromRegisterNo = async (regNo: string) => {
    if (!regNo.trim()) return
    try {
      const res = await fetch(`/api/vehicle/${encodeURIComponent(regNo.trim())}`)
      if (res.ok) {
        const data = await res.json()
        if (data.currentRent) {
          const name = `${data.currentRent.FirstName} ${data.currentRent.LastName}`.trim()
          setDriverName(name)
          if (data.car && data.car.VinNo) {
            setVinNo(data.car.VinNo)
          }
          if (data.car && data.car.Project) {
            setProject(data.car.Project)
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch vehicle info:', err)
    }
  }

  const handleAddFollowUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFollowUpText.trim()) return

    const newLog: FollowUpLog = {
      followUpId: Date.now(),
      followUpDate: new Date().toISOString(),
      followUpDetail: newFollowUpText.trim(),
      createUserName: 'คุณ ผู้ใช้งานปัจจุบัน'
    }

    setFollowUps(prev => [newLog, ...prev])
    setNewFollowUpText('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (statusCode === 'WAITING_FOR_MAINTENANCE' || statusCode === 'IN_MAINTENANCE') {
      if (!serviceLocation || !serviceLocation.trim()) {
        alert('กรุณาระบุสถานที่/อู่ที่ซ่อม')
        return
      }
    }

    setSubmitting(true)

    try {
      const payload = {
        maintenanceId: id,
        project,
        registerNo,
        vinNo,
        driverName,
        incidentDate,
        reportDate,
        issueTitle,
        problemType,
        faultParty,
        carCase,
        insurance,
        rootCause,
        fixAction,
        statusCode,
        needsReplacement,
        hasReplacement: needsReplacement,
        replacementVin: needsReplacement ? replacementVin : null,
        replacementLocation: needsReplacement ? replacementLocation : null,
        replacementStartDate: needsReplacement ? replacementStartDate : null,
        serviceLocation,
        startDate,
        finishDate,
        returnDate,
        followUps,
        attachments: attachments.map(a => ({
          name: a.name,
          type: a.type,
          fileSize: a.fileSize
        })),
        source: 'ADMIN_DESKTOP_EDIT'
      }

      const res = await fetch('/api/external-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('ไม่สามารถบันทึกข้อมูลได้')

      setSuccess(true)
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setSubmitting(false)
    }
  }

  const formatLiffTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      const day = d.getUTCDate()
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
      const month = months[d.getUTCMonth()]
      const year = d.getUTCFullYear() + 543
      const hour = d.getUTCHours().toString().padStart(2, '0')
      const minute = d.getUTCMinutes().toString().padStart(2, '0')
      return `${day} ${month} ${year} ${hour}:${minute}`
    } catch {
      return isoString
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex justify-center items-start text-slate-800">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-500 text-sm">🔧 ระบบงานซ่อมบำรุง /</span>
              <span className="text-slate-400 text-sm">แก้ไขใบแจ้งซ่อม</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              แก้ไขข้อมูลการแจ้งซ่อม <span className="text-indigo-600">#{id}</span> (แอดมิน)
            </h1>
          </div>
          <button
            onClick={() => router.push('/maintenance')}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-250 hover:bg-slate-50 transition"
          >
            ย้อนกลับ
          </button>
        </div>

        {success ? (
          /* SUCCESS SCREEN */
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-250 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">แก้ไขข้อมูลสำเร็จ!</h2>
            <p className="text-sm text-slate-500 mb-6 max-w-md">
              บันทึกการอัปเดตและรายการติดตามผลของใบซ่อมบำรุง <span className="font-bold text-indigo-600">#{id}</span> ไปยังระบบภายนอกเสร็จเรียบร้อยแล้ว
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSuccess(false)}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-750 rounded-xl transition shadow-md"
              >
                แก้ไขฟอร์มต่อ
              </button>
              <button
                onClick={() => router.push('/maintenance')}
                className="px-6 py-2.5 text-sm font-semibold border border-slate-300 hover:bg-slate-100 rounded-xl transition"
              >
                ไปที่หน้าติดตามงานซ่อม
              </button>
            </div>
          </div>
        ) : (
          /* FORM BODY */
          <div className="p-8 grid grid-cols-3 gap-8">
            
            {/* Form Fields Column */}
            <form onSubmit={handleSubmit} className="col-span-2 space-y-8 border-r border-slate-100 pr-8">
              
              {/* Section 1: ข้อมูลเบื้องต้น */}
              <div className="space-y-4">
                <div className="border-l-4 border-indigo-500 pl-3">
                  <h3 className="text-base font-bold text-slate-900">ข้อมูลเบื้องต้น</h3>
                  <p className="text-xxs text-slate-500">ข้อมูลพื้นฐานของรถที่เกิดปัญหาและวันเวลาเกิดเหตุ</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">Project / โครงการ</label>
                    <select
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="Line Man">Line Man</option>
                      <option value="Taxi">Taxi</option>
                      <option value="EV7">EV7</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">Register No. / ทะเบียนรถ</label>
                    <input
                      type="text"
                      value={registerNo}
                      onChange={(e) => setRegisterNo(e.target.value)}
                      onBlur={(e) => fetchDriverFromRegisterNo(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold block mb-1 text-slate-700">Vin No. / เลขตัวถัง</label>
                      <input
                        type="text"
                        value={vinNo}
                        onChange={(e) => setVinNo(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold block mb-1 text-slate-700">ชื่อ-นามสกุล ผู้ขับ</label>
                      <input
                        type="text"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">วันที่เกิดเหตุ</label>
                    <input
                      type="datetime-local"
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">วันที่รับแจ้ง</label>
                    <input
                      type="datetime-local"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs font-semibold block mb-1 text-slate-700">เรื่องที่แจ้ง / อาการชำรุด</label>
                    <textarea
                      rows={2}
                      value={issueTitle}
                      onChange={(e) => setIssueTitle(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition resize-none"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Section 2: รายละเอียดปัญหา */}
              <div className="space-y-4">
                <div className="border-l-4 border-indigo-500 pl-3">
                  <h3 className="text-base font-bold text-slate-900">รายละเอียดปัญหา</h3>
                  <p className="text-xxs text-slate-500">ประเภทปัญหา ฝ่ายผิด ประกันภัยรถยนต์ และวิเคราะห์สาเหตุ</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">ประเภทของปัญหา</label>
                    <select
                      value={problemType}
                      onChange={(e) => setProblemType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">เลือกประเภทของปัญหา</option>
                      <option value="ACCIDENT">อุบัติเหตุ (ACCIDENT)</option>
                      <option value="PRODUCT">ชิ้นส่วนผลิตไม่ได้คุณภาพ (PRODUCT)</option>
                      <option value="USAGE">การใช้งานผิดวิธี (USAGE)</option>
                      <option value="WEAR">การเสื่อมสภาพจากการสึกหรอ (WEAR)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">ฝ่ายผิด</label>
                    <select
                      value={faultParty}
                      onChange={(e) => setFaultParty(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">เลือกฝ่ายผิด</option>
                      <option value="FAULT_DRIVER">คนขับรถของเรา (DRIVER)</option>
                      <option value="FAULT_COUNTERPARTY">คู่กรณี (COUNTERPART)</option>
                      <option value="FAULT_MANUFACTURER">ผู้ผลิตแชสซี/แบตเตอรี่ (MANUFACTURER)</option>
                      <option value="FAULT_OTHER">เหตุการณ์ภายนอก/ระบุไม่ได้ (OTHER)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">กรณีรถ</label>
                    <select
                      value={carCase}
                      onChange={(e) => setCarCase(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">เลือกกรณีรถ</option>
                      <option value="DAMAGE_LIGHT">เคสซ่อมเบา (DAMAGE_LIGHT)</option>
                      <option value="DAMAGE_HEAVY">เคสซ่อมหนัก (DAMAGE_HEAVY)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">ประกัน</label>
                    <select
                      value={insurance}
                      onChange={(e) => setInsurance(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">เลือกประกัน</option>
                      <option value="ICARE_INSURANCE">ไอแคร์ประกันภัย (ICARE)</option>
                      <option value="MUANGTHAI_INSURANCE">เมืองไทยประกันภัย (MUANGTHAI)</option>
                      <option value="NO_INSURANCE">ไม่มีประกันภัย (NO_INSURANCE)</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs font-semibold block mb-1 text-slate-700">สาเหตุที่พบ (Root Cause Found)</label>
                    <textarea
                      rows={2}
                      value={rootCause}
                      onChange={(e) => setRootCause(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition resize-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs font-semibold block mb-1 text-slate-700">การแก้ไข (Fix Action)</label>
                    <textarea
                      rows={2}
                      value={fixAction}
                      onChange={(e) => setFixAction(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition resize-none"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Section 3: เอกสารแนบและการอัปโหลด */}
              <div className="space-y-4">
                <div className="border-l-4 border-indigo-500 pl-3">
                  <h3 className="text-base font-bold text-slate-900">เอกสารและรูปภาพแนบ</h3>
                  <p className="text-xxs text-slate-500">แนบรูปภาพสภาพความเสียหาย ใบเคลม หรือไฟล์เอกสารอื่นๆ</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-250 rounded-2xl py-4 text-slate-700 bg-slate-50/50">
                    <span className="text-xl">📸</span>
                    <span className="text-xs font-bold mt-1 text-slate-900">แนบรูปภาพสภาพรถ</span>
                    <div className="flex gap-2 w-full max-w-[240px] mt-2 px-3">
                      <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 cursor-pointer transition active:scale-[0.98] text-[10px] font-bold text-slate-700 shadow-sm text-center">
                        <span>📸 ถ่ายรูปสด</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleFileUpload(e, 'image')}
                          className="hidden"
                        />
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 cursor-pointer transition active:scale-[0.98] text-[10px] font-bold text-slate-700 shadow-sm text-center">
                        <span>🖼️ คลังภาพ</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'image')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-250 hover:border-indigo-500 hover:bg-slate-50 cursor-pointer rounded-2xl py-4 transition text-slate-700">
                    <span className="text-xl">📄</span>
                    <span className="text-xs font-bold mt-1">แนบไฟล์เอกสาร (PDF, Word, etc.)</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(e, 'document')}
                      className="hidden"
                    />
                  </label>
                </div>

                {attachments.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                    {attachments.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between border border-slate-200 bg-white p-2.5 rounded-2xl text-xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                          {file.type === 'image' ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 shrink-0">
                              <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 shrink-0 flex items-center justify-center text-lg text-indigo-650">
                              📄
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <p className="font-bold text-slate-800 truncate leading-snug">{file.name}</p>
                            <p className="text-xxs text-slate-400 font-mono">{file.fileSize}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(file.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg border border-transparent transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <hr className="border-slate-100" />

              {/* Section 4: การซ่อมบำรุง */}
              <div className="space-y-4">
                <div className="border-l-4 border-indigo-500 pl-3">
                  <h3 className="text-base font-bold text-slate-900">การซ่อมบำรุง</h3>
                  <p className="text-xxs text-slate-500">ติดตามสถานะอู่ซ่อมบำรุง วันส่งซ่อม และวันซ่อมเสร็จ</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">สถานะใบแจ้งซ่อม</label>
                    <select
                      value={statusCode}
                      onChange={(e) => setStatusCode(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="WAITING_FOR_MAINTENANCE">รอเข้าซ่อม (WAITING_FOR_MAINTENANCE)</option>
                      <option value="IN_MAINTENANCE">อยู่ระหว่างการซ่อม (IN_MAINTENANCE)</option>
                      <option value="COMPLETE">ซ่อมเสร็จเรียบร้อย (COMPLETE)</option>
                      <option value="STILL_WORK">รถขัดข้องแต่ยังคงวิ่งบริการได้ (STILL_WORK)</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={needsReplacement}
                        onChange={(e) => {
                          setNeedsReplacement(e.target.checked)
                          if (e.target.checked) {
                            loadReplacementCars('')
                          } else {
                            setReplacementVin('')
                            setReplCarSearch('')
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-350 text-indigo-650 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-semibold text-slate-700">ต้องการรถทดแทนระหว่างการซ่อม</span>
                    </label>
                  </div>

                  {needsReplacement && (
                    <div className="col-span-2 grid grid-cols-2 gap-4 bg-indigo-50/10 p-4 rounded-2xl border border-indigo-100/30">
                      <div className="relative">
                        <label className="text-xs font-semibold block mb-1 text-slate-700">
                          <span className="text-rose-555">*</span> ข้อมูลรถทดแทน
                        </label>
                        <input
                          type="text"
                          placeholder="🔎 ค้นหาทะเบียน หรือ VIN..."
                          value={replCarSearch}
                          onChange={(e) => {
                            setReplCarSearch(e.target.value)
                            loadReplacementCars(e.target.value)
                          }}
                          onFocus={() => loadReplacementCars(replCarSearch)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-semibold"
                        />
                        {/* Results dropdown list */}
                        {replacementCars.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50">
                            {replacementCars.map((car) => (
                              <div
                                key={car.InventoryItemID}
                                onClick={() => {
                                  setReplacementVin(car.VinNo)
                                  setReplCarSearch(`${car.RegisterNo || '-'} (${car.Model || '-'}) [Project: ${car.Project || '-'}]`)
                                  setReplacementCars([]) // Hide dropdown
                                }}
                                className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0 text-xs text-slate-800"
                              >
                                <span className="font-bold text-indigo-650">{car.RegisterNo || '-'}</span> 
                                <span className="text-slate-500"> (VIN: {car.VinNo} | {car.Model || '-'})</span>
                                <div className="text-[10px] text-slate-450 mt-0.5">โครงการ: <span className="font-semibold text-slate-650">{car.Project || '-'}</span></div>
                              </div>
                            ))}
                          </div>
                        )}
                        {replacementVin && (
                          <div className="mt-1 text-xxs font-bold text-emerald-600">
                            ✓ เลือกแล้ว: {replacementVin}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold block mb-1 text-slate-700">
                          <span className="text-rose-555">*</span> สถานที่รับ/คืนรถทดแทน
                        </label>
                        <select
                          value={replacementLocation}
                          onChange={(e) => setReplacementLocation(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
                        >
                          <option value="">เลือกสถานที่รับ/คืนรถทดแทน</option>
                          <option value="AION_GI_KANCHANAPISEK">Aion กาญจนาฯ</option>
                          <option value="AION_GI_RAMINTRA_EXPRESSWAY">Aion เลียบด่วนฯ</option>
                          <option value="AION_GI_PIBULSONGKRAM">Aion พิบูลฯ</option>
                          <option value="AION_GI_MINBURI">Aion มีนบุรี</option>
                          <option value="AION_GI_MAHACHAI">Aion มหาชัย</option>
                          <option value="AION_GI_SALAYA">Aion ศาลายา</option>
                          <option value="EV7_YARD_PRAPADAENG">EV7 Yard พระประแดง</option>
                          <option value="SMART_TAXI">สมาร์ทเแท็กซี่</option>
                          <option value="GARAGE_BUNGKHWANG">อู่ บึงขวาง</option>
                          <option value="GARAGE_TS">อู่ TS</option>
                          <option value="GARAGE_88_CAR">อู่ 88 คาร์</option>
                          <option value="GARAGE_CRN_PAKKRET">อู่ CRN ปากเกร็ด</option>
                          <option value="GARAGE_56_COLOR">อู่ 56 Color</option>
                          <option value="GARAGE_PRICHA">อู่ ปรีชา</option>
                          <option value="GARAGE_PERFECTCAR">อู่ เพอร์เฟคคาร์</option>
                          <option value="GARAGE_SAHACAR">อู่ สหาคาร์</option>
                          <option value="GARAGE_PREMIUMCAR">อู่ พรีเมี่ยมคาร์</option>
                          <option value="GARAGE_BESTCARPAINT">อู่ เบสท์คาร์เพ้นท์</option>
                          <option value="BRANCH_AYUTTHAYA">สาขา อยุธยา</option>
                          <option value="BB_CARPAINT">อู่ บีบี คาร์เพ้นท์</option>
                          <option value="AUTOHAUS">อู่ Autohaus</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold block mb-1 text-slate-700">วันที่ขอรถทดแทน</label>
                        <input
                          type="date"
                          value={replacementStartDate}
                          onChange={(e) => setReplacementStartDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">สถานที่ทำการ (ตรวจเช็ค/แก้ไข)</label>
                    <select
                      value={serviceLocation}
                      onChange={(e) => setServiceLocation(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">เลือกสถานที่เข้าซ่อม</option>
                      <option value="HQ_GARAGE">อู่สำนักงานใหญ่</option>
                      <option value="SAMUT_PRAKAN_GARAGE">อู่สมุทรปราการ</option>
                      <option value="PATHUM_THANI_GARAGE">อู่ปทุมธานี</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">วันที่นำรถเข้าซ่อม</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">วันที่รถซ่อมเสร็จ</label>
                    <input
                      type="date"
                      value={finishDate}
                      onChange={(e) => setFinishDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-700">วันที่รับรถกลับ</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/maintenance')}
                  className="px-6 py-3 text-sm font-semibold rounded-xl border border-slate-250 hover:bg-slate-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-650 rounded-xl transition shadow-md"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>

            </form>

            {/* Follow-up Timeline Column */}
            <div className="col-span-1 space-y-6">
              
              {/* Title Section */}
              <div className="border-l-4 border-amber-500 pl-3">
                <h3 className="text-base font-bold text-slate-900">📋 ประวัติการติดตาม</h3>
                <p className="text-xxs text-slate-500">ติดตามผลการเข้าซ่อมของรถ และอัปเดตความคืบหน้าของงาน</p>
              </div>

              {/* Add New Follow-Up Entry Form */}
              <form onSubmit={handleAddFollowUp} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <label className="text-xs font-bold block text-slate-800">
                  📝 บันทึกความคืบหน้าการติดตามผลใหม่
                </label>
                <textarea
                  rows={3}
                  value={newFollowUpText}
                  onChange={(e) => setNewFollowUpText(e.target.value)}
                  placeholder="กรอกรายละเอียดความคืบหน้า เช่น ประสานงานกับช่างเรียบร้อยแล้ว, อยู่ระหว่างรออะไหล่นำส่ง..."
                  required
                  className="w-full bg-white border border-slate-350 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 transition resize-none"
                />
                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-xs font-bold py-2.5 rounded-xl transition shadow-sm"
                >
                  ➕ เพิ่มบันทึกการติดตาม
                </button>
              </form>

              {/* Follow-Up Timeline Display */}
              <div className="space-y-4">
                {followUps.length > 0 ? (
                  <div className="border-l-2 border-slate-200 pl-4 ml-1 space-y-4">
                    {followUps.map((f) => (
                      <div key={f.followUpId} className="relative text-xs animate-fade-in-up">
                        {/* Timeline dot */}
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white shadow-sm" />
                        
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <span className="font-semibold text-xxs">{formatLiffTime(f.followUpDate)}</span>
                          <span className="font-bold text-xxs uppercase tracking-wider">{f.createUserName}</span>
                        </div>
                        <div className="bg-slate-50/75 p-3 rounded-xl border border-slate-150">
                          <p className="text-slate-800 leading-relaxed font-semibold">
                            {f.followUpDetail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-400 italic py-6">ยังไม่มีประวัติการติดตามในเคสซ่อมนี้</p>
                )}
              </div>

            </div>

          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  )
}
