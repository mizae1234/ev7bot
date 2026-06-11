'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'bot'
  content: string
  timestamp: Date
}

const QUICK_ACTIONS = [
  { label: '🚗 วันนี้ปล่อยรถกี่คัน', message: 'วันนี้ปล่อยรถกี่คัน' },
  { label: '🔧 สถานะงานซ่อม', message: 'วันนี้มีงานซ่อมกี่รายการ ซ่อมเสร็จกี่คัน' },
  { label: '📅 สรุปเดือนนี้', message: 'สรุปเดือนนี้หน่อย' },
  { label: '🔍 ค้นหารถ', message: 'ค้นหารถรุ่น Y Plus 490' },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      content: 'สวัสดีค่า~ 🧈✨\nButter พร้อมช่วยเหลือแล้วนะคะ!\n\nถามอะไรเกี่ยวกับข้อมูลรถก็ได้เลย เช่น\n💬 "วันนี้ปล่อยรถกี่คัน"\n💬 "รถรุ่น Y Plus 490 ซ่อมค้างกี่คัน"\n💬 "สรุปเดือนนี้หน่อย"',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      })

      const data = await res.json()

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        content: data.reply || data.error || 'Butter ไม่สามารถตอบได้ค่ะ 🤔',
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, botMsg])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'bot',
          content: 'เกิดข้อผิดพลาดในการเชื่อมต่อค่ะ 😅 ลองใหม่อีกทีนะคะ',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  const renderMessageText = (content: string) => {
    const linkRegex = /(?:🔗\s*ดูเพิ่มเติม:\s*|ดูเพิ่มเติมได้ที่นี่:\s*)(https?:\/\/[^\s]+|\/vehicle\/[^\s]+)/gi
    const parts = content.split(linkRegex)
    
    if (parts.length <= 1) {
      return content
    }

    const textBefore = parts[0]
    const rawUrl = parts[1]
    const textAfter = parts.slice(2).join('')

    let displayUrl = rawUrl
    try {
      if (rawUrl.startsWith('http')) {
        const urlObj = new URL(rawUrl)
        displayUrl = urlObj.pathname + urlObj.search
      }
    } catch {
      // Ignore
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ whiteSpace: 'pre-wrap' }}>{textBefore}</span>
        <a
          href={displayUrl}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            alignSelf: 'flex-start',
            padding: '8px 16px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)'
          }}
        >
          <span>🔗 ดูรายละเอียดรถเพิ่มเติม</span>
        </a>
        {textAfter && <span style={{ whiteSpace: 'pre-wrap' }}>{textAfter}</span>}
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(250, 204, 21, 0.15)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <a href="/dashboard" style={{
          color: '#94a3b8',
          textDecoration: 'none',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '8px',
          background: 'rgba(148, 163, 184, 0.1)',
          transition: 'all 0.2s',
        }}>
          ← Dashboard
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            boxShadow: '0 0 20px rgba(250, 204, 21, 0.3)',
          }}>
            🧈
          </div>
          <div>
            <div style={{
              fontWeight: 700,
              fontSize: '18px',
              color: '#f8fafc',
              letterSpacing: '-0.01em',
            }}>
              Butter
            </div>
            <div style={{
              fontSize: '12px',
              color: isLoading ? '#facc15' : '#22c55e',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isLoading ? '#facc15' : '#22c55e',
                display: 'inline-block',
                animation: isLoading ? 'pulse 1.5s infinite' : 'none',
              }} />
              {isLoading ? 'กำลังพิมพ์...' : 'ออนไลน์'}
            </div>
          </div>
        </div>
        <div style={{
          padding: '4px 12px',
          borderRadius: '20px',
          background: 'rgba(250, 204, 21, 0.1)',
          border: '1px solid rgba(250, 204, 21, 0.2)',
          fontSize: '11px',
          color: '#facc15',
          fontWeight: 600,
        }}>
          AI Powered 🤖
        </div>
      </header>

      {/* Messages Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto',
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '8px',
              alignItems: 'flex-end',
              animation: 'fadeInUp 0.3s ease-out',
            }}
          >
            {msg.role === 'bot' && (
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #facc15, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0,
              }}>
                🧈
              </div>
            )}
            <div style={{
              maxWidth: '75%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user'
                ? '18px 18px 4px 18px'
                : '18px 18px 18px 4px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                : 'rgba(30, 41, 59, 0.9)',
              border: msg.role === 'user'
                ? 'none'
                : '1px solid rgba(250, 204, 21, 0.1)',
              color: '#f1f5f9',
              fontSize: '14px',
              lineHeight: '1.6',
              wordBreak: 'break-word',
              boxShadow: msg.role === 'user'
                ? '0 2px 10px rgba(59, 130, 246, 0.3)'
                : '0 2px 10px rgba(0, 0, 0, 0.2)',
            }}>
              {msg.role === 'bot' ? renderMessageText(msg.content) : (
                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              )}
              <div style={{
                fontSize: '10px',
                color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#64748b',
                marginTop: '6px',
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}>
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
            animation: 'fadeInUp 0.3s ease-out',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #facc15, #f59e0b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0,
            }}>
              🧈
            </div>
            <div style={{
              padding: '14px 20px',
              borderRadius: '18px 18px 18px 4px',
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(250, 204, 21, 0.1)',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
            }}>
              <span className="typing-dot" style={{ animationDelay: '0s' }} />
              <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
              <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div style={{
          maxWidth: '800px',
          width: '100%',
          margin: '0 auto',
          padding: '0 16px 12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.message}
              onClick={() => sendMessage(action.message)}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                background: 'rgba(250, 204, 21, 0.08)',
                border: '1px solid rgba(250, 204, 21, 0.2)',
                color: '#facc15',
                fontSize: '13px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isLoading ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'rgba(250, 204, 21, 0.15)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(250, 204, 21, 0.08)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(250, 204, 21, 0.1)',
        padding: '16px',
        position: 'sticky',
        bottom: 0,
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ถาม Butter อะไรก็ได้..."
            disabled={isLoading}
            autoFocus
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: '24px',
              border: '1px solid rgba(250, 204, 21, 0.15)',
              background: 'rgba(30, 41, 59, 0.8)',
              color: '#f1f5f9',
              fontSize: '15px',
              outline: 'none',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(250, 204, 21, 0.4)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(250, 204, 21, 0.1)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(250, 204, 21, 0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: input.trim() && !isLoading
                ? 'linear-gradient(135deg, #facc15, #f59e0b)'
                : 'rgba(100, 116, 139, 0.3)',
              border: 'none',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              transition: 'all 0.2s',
              boxShadow: input.trim() && !isLoading
                ? '0 4px 15px rgba(250, 204, 21, 0.3)'
                : 'none',
              transform: 'scale(1)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (input.trim() && !isLoading) {
                e.currentTarget.style.transform = 'scale(1.05)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            {isLoading ? '⏳' : '➤'}
          </button>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes typingBounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #facc15;
          display: inline-block;
          animation: typingBounce 1.2s infinite;
        }
        input::placeholder {
          color: #64748b;
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(250, 204, 21, 0.2);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(250, 204, 21, 0.4);
        }
      `}</style>
    </div>
  )
}
