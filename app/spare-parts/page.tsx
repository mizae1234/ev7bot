'use client'

import React, { useState, useEffect, useRef } from 'react'
import Barcode from 'react-barcode'
import * as XLSX from 'xlsx'
import { AuthGuard } from '@/components/ui/AuthGuard'

interface SparePart {
  PartID: number
  SKU: string
  PartName: string
  ProductNumberReference?: string
  SearchName?: string
  IsActive: boolean
}

function SparePartsAdminDashboard() {
  const [parts, setParts] = useState<SparePart[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [printPart, setPrintPart] = useState<SparePart | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchParts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/spare-parts')
      const data = await res.json()
      if (res.ok) {
        setParts(data.parts || [])
      } else {
        alert('Error: ' + data.error)
      }
    } catch (e) {
      console.error(e)
      alert('Failed to fetch parts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchParts()
  }, [])

  const processAndUpload = async (newParts: {SKU: string, PartName: string, ProductNumberReference?: string}[]) => {
    if (newParts.length === 0) {
      alert('ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบไฟล์ (A: Item number, B: Product Number reference, C: Product name)')
      setImporting(false)
      return
    }

    try {
      const res = await fetch('/api/spare-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: newParts })
      })
      const data = await res.json()
      if (res.ok) {
        alert(`นำเข้าสำเร็จ!\n- เพิ่มรายการใหม่: ${data.inserted} รายการ\n- ข้าม (มี SKU นี้แล้ว): ${data.skipped} รายการ`)
        fetchParts()
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        alert('Error: ' + data.error)
      }
    } catch (e) {
      console.error(e)
      alert('Failed to import')
    } finally {
      setImporting(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 })
        
        // Parse rows (skip empty rows and header row if it exists by checking if row[0] is 'Item number')
        const newParts = data
          .filter(row => row && row.length >= 1 && row[0] && String(row[0]).trim() !== '' && String(row[0]).trim().toLowerCase() !== 'item number')
          .map(row => ({
            SKU: String(row[0] || '').trim(),
            ProductNumberReference: String(row[1] || '').trim(),
            PartName: String(row[2] || '').trim() || String(row[0] || '').trim()
          }))
          
        processAndUpload(newParts)
      } catch (err) {
        console.error(err)
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel')
        setImporting(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handlePrint = (part: SparePart) => {
    setPrintPart(part)
    setTimeout(() => {
      window.print()
      setPrintPart(null)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 print:bg-white print:text-black print:p-0">
      
      {/* Print View (Only visible when printing) */}
      <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:h-screen print:w-full">
        {printPart && (
          <div className="text-center p-8 bg-white text-black max-w-sm w-full">
            <Barcode 
              value={printPart.SKU} 
              width={2} 
              height={80} 
              fontSize={20} 
              displayValue={true} 
              margin={10}
            />
            <p className="text-lg font-bold mt-4 uppercase text-center leading-tight">
              {printPart.PartName}
            </p>
          </div>
        )}
      </div>

      {/* Screen View */}
      <div className="print:hidden max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-4">
          <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            🔧 จัดการฐานข้อมูลอะไหล่ (Spare Parts)
          </h1>
          <p className="text-slate-400 mt-2">เพิ่มข้อมูลและพิมพ์บาร์โค้ดสำหรับระบบ Audit</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Import Section */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
              <h2 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
                📥 นำเข้าจาก Excel
              </h2>
              <p className="text-xs text-slate-400 mb-4">รูปแบบ 3 คอลัมน์: A=Item number (SKU), B=Product No., C=Product name</p>
              
              <div className="relative border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-cyan-400 transition cursor-pointer bg-slate-900/50">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  disabled={importing}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="text-3xl mb-2">📊</div>
                <div className="text-sm font-bold text-cyan-400">
                  {importing ? 'กำลังประมวลผล...' : 'คลิกหรือลากไฟล์ Excel มาวางที่นี่'}
                </div>
                <div className="text-xs text-slate-500 mt-1">รองรับ .xlsx, .xls, .csv</div>
              </div>
            </div>
          </div>

          {/* List Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                  📦 รายการอะไหล่ในระบบ ({parts.length})
                </h2>
                <button
                  onClick={fetchParts}
                  className="text-sm bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition"
                >
                  🔄 รีเฟรช
                </button>
              </div>

              {loading ? (
                <div className="text-center py-10 text-slate-400">กำลังโหลด...</div>
              ) : parts.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/50 rounded-xl border border-dashed border-slate-600 text-slate-400">
                  ยังไม่มีข้อมูลอะไหล่ กรุณานำเข้าข้อมูล
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg">รหัส (SKU)</th>
                        <th className="px-4 py-3">ชื่ออะไหล่</th>
                        <th className="px-4 py-3 text-right rounded-tr-lg">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((part, idx) => (
                        <tr key={part.PartID} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                          <td className="px-4 py-3 font-mono text-cyan-300">{part.SKU}</td>
                          <td className="px-4 py-3 font-medium">{part.PartName}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handlePrint(part)}
                              className="bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1 ml-auto"
                            >
                              <span>🖨️</span> พิมพ์บาร์โค้ด
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SparePartsAdminPage() {
  return (
    <AuthGuard>
      <SparePartsAdminDashboard />
    </AuthGuard>
  )
}
