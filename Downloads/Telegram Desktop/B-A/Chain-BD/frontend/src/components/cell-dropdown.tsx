"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"

interface Props {
  value: string
  options: string[]
  onChange: (v: string) => void
  colorMap?: Record<string, { bg: string; color: string }>
}

export function CellDropdown({ value, options, onChange, colorMap }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const style = colorMap?.[value]

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-opacity hover:opacity-80"
        style={
          style
            ? { background: style.bg, color: style.color }
            : { background: "var(--bg-base)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
        }
      >
        <span>{value}</span>
        <ChevronDown size={10} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-0.5 z-50 rounded shadow-lg border min-w-max overflow-hidden"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          {options.map((opt) => {
            const s = colorMap?.[opt]
            const isActive = opt === value
            return (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-colors hover:opacity-80"
                style={{
                  background: isActive ? "var(--bg-active)" : "transparent",
                  color: isActive ? "#fff" : "var(--text-primary)",
                }}
              >
                {s && (
                  <span
                    className="px-1.5 py-0.5 rounded font-medium"
                    style={{ background: s.bg, color: s.color, fontSize: 10 }}
                  >
                    {opt}
                  </span>
                )}
                {!s && <span>{opt}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
