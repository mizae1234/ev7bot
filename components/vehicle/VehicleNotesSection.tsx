import { useEffect, useState, useRef } from 'react'

interface VehicleNote {
  VehicleNoteID: number
  InventoryItemID: number
  NoteDetail: string | null
  CreateDate: string
  CreateUserID: number | null
  CreateUserName: string
  IsActive: boolean
  attachments?: {
    FileAttachmentID: number
    fileName: string
    originalFileName: string
    s3Key: string
    fileSize: number
    contentType: string
    url: string
  }[]
}

interface MentionUser {
  id: number
  name: string
  fullName: string
}

interface VehicleNotesSectionProps {
  inventoryItemId: number
  registerNo: string
  lineUserId?: string | null
}

// SQL Server stores Bangkok time directly — mssql driver serializes as UTC (Z suffix).
// Use UTC methods to read the raw value without browser adding +7 again.
function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    const day = d.getUTCDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getUTCMonth()]
    const year = d.getUTCFullYear() + 543
    const hours = String(d.getUTCHours()).padStart(2, '0')
    const minutes = String(d.getUTCMinutes()).padStart(2, '0')
    return `${day} ${month} ${year} ${hours}:${minutes} น.`
  } catch {
    return dateStr || ''
  }
}

export function VehicleNotesSection({ inventoryItemId, registerNo, lineUserId: propLineUserId }: VehicleNotesSectionProps) {
  const [notes, setNotes] = useState<VehicleNote[]>([])
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Attachments state
  const [attachments, setAttachments] = useState<{
    fileName: string
    originalFileName: string
    s3Key: string
    fileSize: number
    fileType: string
    url: string
  }[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const uploadFiles = async (filesToUpload: FileList | File[]) => {
    try {
      setUploadingFiles(true)
      setError(null)
      
      const formData = new FormData()
      formData.append('processType', 'VEHICLE_NOTES')
      if (resolvedLineUserId) {
        formData.append('lineUserId', resolvedLineUserId)
      }
      
      for (let i = 0; i < filesToUpload.length; i++) {
        formData.append('files', filesToUpload[i])
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'อัปโหลดไฟล์ล้มเหลว')
      }

      if (json.files && Array.isArray(json.files)) {
        const formatted = json.files.map((f: any) => ({
          fileName: f.fileName,
          originalFileName: f.originalFileName,
          s3Key: f.s3Key,
          fileSize: f.fileSize,
          fileType: f.fileType,
          url: f.url || `https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com/${f.s3Key}`
        }))
        setAttachments(prev => [...prev, ...formatted])
      }
    } catch (err: any) {
      console.error('[Upload Error]', err)
      setError(err.message || 'อัปโหลดไฟล์ไม่สำเร็จ')
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files)
      e.target.value = ''
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          imageFiles.push(file)
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()
      uploadFiles(imageFiles)
    }
  }

  // Mentions
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([])
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionCursorPos, setMentionCursorPos] = useState(0)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Resolve current user's lineUserId
  const [resolvedLineUserId, setResolvedLineUserId] = useState<string | null>(null)

  useEffect(() => {
    if (propLineUserId) {
      setResolvedLineUserId(propLineUserId)
    } else if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('liff_profile')
      if (cached) {
        try {
          const profile = JSON.parse(cached)
          if (profile.userId) {
            setResolvedLineUserId(profile.userId)
          }
        } catch {}
      }
    }
  }, [propLineUserId])

  // Fetch Notes
  async function fetchNotes() {
    try {
      setLoading(true)
      const res = await fetch(`/api/vehicle/note?inventoryItemId=${inventoryItemId}`)
      if (!res.ok) throw new Error('Failed to load notes')
      const json = await res.json()
      if (json.vehicleNotes) {
        setNotes(json.vehicleNotes)
      }
    } catch (err: any) {
      console.error('Error fetching vehicle notes:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Mentions list
  async function fetchMentionUsers() {
    try {
      const res = await fetch('/api/users/mention-list')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setMentionUsers(data)
        }
      }
    } catch (err) {
      console.error('Failed to fetch mention users:', err)
    }
  }

  useEffect(() => {
    if (inventoryItemId) {
      fetchNotes()
    }
  }, [inventoryItemId])

  useEffect(() => {
    fetchMentionUsers()
  }, [])

  // Handle key triggers for @ mentions
  const handleTextChange = (val: string, cursorPos: number) => {
    setNoteText(val)
    
    const textBeforeCursor = val.slice(0, cursorPos)
    const lastAtIdx = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIdx !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1)
      // Show mention dropdown only if there are no spaces between @ and the cursor
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt)
        setMentionCursorPos(lastAtIdx)
        setShowMentionDropdown(true)
        return
      }
    }
    setShowMentionDropdown(false)
  }

  // Handle selecting a mention from the dropdown list
  const handleSelectMention = (name: string) => {
    const beforeAt = noteText.slice(0, mentionCursorPos)
    const afterCursor = noteText.slice(mentionCursorPos + 1 + mentionSearch.length)
    const replacement = `@${name} `
    
    const newText = beforeAt + replacement + afterCursor
    setNoteText(newText)
    setShowMentionDropdown(false)

    const newCursorPos = mentionCursorPos + replacement.length
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 50)
  }

  // Submit Note
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return

    try {
      setSubmitting(true)
      setError(null)
      const res = await fetch('/api/vehicle/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId,
          noteDetail: noteText,
          registerNo,
          lineUserId: resolvedLineUserId,
          attachments // Pass attachments list
        })
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'เกิดข้อผิดพลาดในการบันทึกโน้ต')
      }

      setNoteText('')
      setAttachments([]) // Reset attachments list
      await fetchNotes()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
      <div>
        <h3 className="text-xs font-bold text-slate-700 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800 pb-2 flex items-center gap-1.5">
          <span>💬 บันทึกข้อมูลรถทั่วไป / Chatlog ประจำรถ</span>
        </h3>
        <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
          บันทึกเคส การพบเห็น หรือประวัติทั่วไปของรถคันนี้ (สามารถพิมพ์ @ เพื่อกล่าวถึง/Mention แจ้งเตือนเพื่อนร่วมงานทาง LINE) หรือวางภาพ และแนบไฟล์ PDF ได้
        </p>
      </div>

      {/* Form Input */}
      <form onSubmit={handleSubmit} className="space-y-3 relative">
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={3}
            value={noteText}
            onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart)}
            onKeyUp={(e: any) => handleTextChange(e.target.value, e.target.selectionStart)}
            onClick={(e: any) => handleTextChange(e.target.value, e.target.selectionStart)}
            onPaste={handlePaste}
            placeholder="ระบุรายละเอียด เช่น พบจอดที่ปั๊ม ปตท., ยางหลังซ้ายอ่อน, ไฟหน้าฝั่งซ้ายไม่ติด (วางภาพที่นี่เพื่อแนบได้)"
            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none placeholder-slate-400 transition resize-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
          />

          {/* Mentions Dropdown */}
          {showMentionDropdown && (() => {
            const filtered = mentionUsers.filter(u => 
              u.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
              u.fullName.toLowerCase().includes(mentionSearch.toLowerCase())
            )
            if (filtered.length === 0) return null

            return (
              <div className="absolute left-0 bottom-full mb-2 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-[9999] py-1 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-slate-50/50 dark:bg-zinc-950 dark:border-zinc-800">
                  👥 แนะนำรายชื่อเพื่อพูดคุย (Mention)
                </div>
                {filtered.map(user => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectMention(user.name)}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center transition dark:text-zinc-300 dark:hover:bg-zinc-800 dark:border-zinc-800"
                  >
                    <span className="text-indigo-600 font-bold dark:text-indigo-400">@{user.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{user.fullName}</span>
                  </button>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Uploaded attachments preview list */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, idx) => {
              const isImage = file.fileType.startsWith('image/')
              return (
                <div key={idx} className="relative group border border-slate-200 dark:border-zinc-800 rounded-xl p-1.5 bg-slate-50 dark:bg-zinc-950 flex items-center gap-2 max-w-xs shadow-xxs">
                  {isImage ? (
                    <img src={file.url} alt={file.originalFileName} className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <span className="text-xl">📄</span>
                  )}
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-[10px] font-semibold truncate text-slate-700 dark:text-zinc-300">{file.originalFileName}</p>
                    <p className="text-[8px] text-slate-400">{(file.fileSize / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 p-0.5"
                  >
                    ❌
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <p className="text-xxs text-red-500 font-semibold">{error}</p>
        )}

        <div className="flex justify-between items-center">
          {/* File attachment upload trigger */}
          <div className="flex items-center gap-2">
            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-750 dark:text-zinc-300 font-bold text-xs py-2 px-3.5 rounded-xl transition shadow-sm flex items-center gap-1.5">
              📎 แนบไฟล์ (PDF/รูปภาพ)
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {uploadingFiles && (
              <span className="text-[10px] text-slate-450 dark:text-zinc-500 animate-pulse">กำลังอัปโหลดไฟล์...</span>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || uploadingFiles || !noteText.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-5 rounded-2xl transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                💾 บันทึกโน้ต
              </>
            )}
          </button>
        </div>
      </form>

      {/* Notes History / Timeline */}
      <div className="space-y-3 pt-2">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ประวัติบันทึก ({notes.length} รายการ)</h4>
        
        {loading && notes.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-400 animate-pulse">กำลังโหลดโน้ต...</div>
        ) : notes.length > 0 ? (
          <div className="space-y-3 pl-2 border-l border-slate-100 dark:border-zinc-800 ml-1 py-1 max-h-60 overflow-y-auto pr-1">
            {notes.map((note) => (
              <div key={note.VehicleNoteID} className="relative text-xxs space-y-1">
                <span className="absolute -left-[12.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white dark:border-zinc-900" />
                <div className="flex justify-between text-slate-400 dark:text-zinc-500 font-semibold">
                  <span>{formatTime(note.CreateDate)}</span>
                  <span className="font-bold">{note.CreateUserName}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-zinc-200 mt-1 leading-relaxed bg-slate-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 break-words">
                  {note.NoteDetail}
                </p>

                {/* Note Attachments list in timeline */}
                {note.attachments && note.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {note.attachments.map((att: any) => {
                      const isImage = att.contentType?.startsWith('image/') || att.fileType?.startsWith('image/')
                      return (
                        <a
                          key={att.FileAttachmentID}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border border-slate-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl p-2 bg-white dark:bg-zinc-900 flex items-center gap-2 max-w-xs transition shadow-sm"
                        >
                          {isImage ? (
                            <img src={att.url} alt={att.originalFileName} className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <span className="text-2xl">📄</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold truncate text-slate-700 dark:text-zinc-300 hover:underline">{att.originalFileName || att.fileName}</p>
                            <p className="text-[8px] text-slate-400">{(att.fileSize / 1024).toFixed(1)} KB</p>
                          </div>
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xxs text-slate-400 italic text-center py-2 dark:text-zinc-500">ยังไม่มีบันทึกข้อมูลทั่วไปประจำรถคันนี้</p>
        )}
      </div>
    </div>
  )
}
