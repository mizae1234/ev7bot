'use client'
import React from 'react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems: number
  itemsPerPage: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage
}: PaginationProps) {
  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const getPageNumbers = () => {
    const pages: number[] = []
    const range = 2 // Number of pages to show around current page
    
    let start = Math.max(1, currentPage - range)
    let end = Math.min(totalPages, currentPage + range)

    // Adjust if near start or end
    if (currentPage <= range) {
      end = Math.min(totalPages, range * 2 + 1)
    } else if (currentPage > totalPages - range) {
      start = Math.max(1, totalPages - range * 2)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
      <div className="text-zinc-500 dark:text-zinc-400 font-medium">
        แสดง {startItem} - {endItem} จากทั้งหมด {totalItems} รายการ
      </div>
      
      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-800 dark:hover:bg-zinc-850 text-zinc-500 transition-colors"
          title="หน้าก่อนหน้า"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Page Numbers */}
        {getPageNumbers()[0] > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className={`h-8 w-8 rounded-xl font-semibold transition-all ${
                currentPage === 1
                  ? 'bg-indigo-650 text-white shadow-sm'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              1
            </button>
            {getPageNumbers()[0] > 2 && (
              <span className="px-1 text-zinc-400 dark:text-zinc-650">...</span>
            )}
          </>
        )}

        {getPageNumbers().map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`h-8 w-8 rounded-xl font-semibold transition-all ${
              currentPage === p
                ? 'bg-indigo-650 text-white shadow-sm'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            {p}
          </button>
        ))}

        {getPageNumbers()[getPageNumbers().length - 1] < totalPages && (
          <>
            {getPageNumbers()[getPageNumbers().length - 1] < totalPages - 1 && (
              <span className="px-1 text-zinc-400 dark:text-zinc-650">...</span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className={`h-8 w-8 rounded-xl font-semibold transition-all ${
                currentPage === totalPages
                  ? 'bg-indigo-650 text-white shadow-sm'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next Button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-800 dark:hover:bg-zinc-850 text-zinc-500 transition-colors"
          title="หน้าถัดไป"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
