import { useEffect, useState, useRef } from 'react'

interface VehicleNote {
  VehicleNoteID: number
  InventoryItemID: number
  NoteDetail: string | null
  CreateDate: string
  CreateUserID: number | null
  CreateUserName: string
  IsActive: boolean
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

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    const day = d.getDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getMonth()]
    const year = d.getFullYear() + 543
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
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
          lineUserId: resolvedLineUserId
        })
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'เกิดข้อผิดพลาดในการบันทึกโน้ต')
      }

      setNoteText('')
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
          บันทึกเคส การพบเห็น หรือประวัติทั่วไปของรถคันนี้ (สามารถพิมพ์ @ เพื่อกล่าวถึง/Mention แจ้งเตือนเพื่อนร่วมงานทาง LINE)
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
            placeholder="ระบุรายละเอียด เช่น พบจอดที่ปั๊ม ปตท., ยางหลังซ้ายอ่อน, ไฟหน้าฝั่งซ้ายไม่ติด..."
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

        {error && (
          <p className="text-xxs text-red-500 font-semibold">{error}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !noteText.trim()}
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
              <div key={note.VehicleNoteID} className="relative text-xxs">
                <span className="absolute -left-[12.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white dark:border-zinc-900" />
                <div className="flex justify-between text-slate-400 dark:text-zinc-500 font-semibold">
                  <span>{formatTime(note.CreateDate)}</span>
                  <span className="font-bold">{note.CreateUserName}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-zinc-200 mt-1 leading-relaxed bg-slate-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 break-words">
                  {note.NoteDetail}
                </p>
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
