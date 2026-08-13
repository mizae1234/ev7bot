'use client'

import React from 'react'

interface ImageLightboxProps {
  url: string
  onClose: () => void
}

export default function ImageLightbox({ url, onClose }: ImageLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[85vh]">
        <img
          src={url}
          alt="Enlarged view"
          className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-850"
        />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
