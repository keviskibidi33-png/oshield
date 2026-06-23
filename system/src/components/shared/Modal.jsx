import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold text-on-surface">{title}</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
