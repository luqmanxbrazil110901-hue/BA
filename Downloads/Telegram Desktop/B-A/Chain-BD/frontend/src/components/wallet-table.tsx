"use client"

import { useState } from "react"
import { Copy, Check, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react"
import { WalletEntry } from "@/lib/types"
import { useI18n } from "@/lib/i18n-context"
import { TranslationKey } from "@/lib/i18n"
import { CellDropdown } from "./cell-dropdown"
import { correctWalletType } from "@/lib/api"

// ── Option lists for editable columns ────────────────────────────────────────
const CLIENT_TYPE_OPTS = ["U Real user", "E Exchange", "S Script", "AP Malicious", "A Bridge"]
const CLIENT_TIER_OPTS = ["L1 <10k", "L2 10k-99.9k", "L3 100k-999.9k", "L4 1M-9.9M", "L5 10M+"]
const HAS_TC_OPTS      = ["No", "Yes"]
const REVIEW_OPTS      = ["A Auto", "M Manual", "TC Confirm"]
const FREQ_CYCLE_OPTS  = ["D Day", "M Month", "W Week", "Y Year"]
const FREQ_TIER_OPTS   = ["F1 0", "F2 1-3", "F3 4-10", "F4 11-19", "F5 20+"]

const CLIENT_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  "U Real user":  { bg: "#dcfce7", color: "#16a34a" },
  "E Exchange":   { bg: "#ede9fe", color: "#7c3aed" },
  "S Script":     { bg: "#fef9c3", color: "#b45309" },
  "AP Malicious": { bg: "#fee2e2", color: "#dc2626" },
  "A Bridge":     { bg: "#e0e7ff", color: "#4338ca" },
}
const PURITY_COLORS: Record<string, { bg: string; color: string }> = {
  "C Clean": { bg: "#dcfce7", color: "#16a34a" },
  "P Toxic":  { bg: "#fee2e2", color: "#dc2626" },
}
// Validated options per field — used to check corrections are in range
export const VALID_CLIENT_TYPES = new Set(CLIENT_TYPE_OPTS)

type SortDir = "asc" | "desc" | null
type SortKey = keyof WalletEntry

interface ColDef { key: SortKey; labelKey: TranslationKey; width?: string }

const COLUMNS: ColDef[] = [
  { key: "address",         labelKey: "colAddress",    width: "w-36" },
  { key: "client_id",       labelKey: "colClientId",   width: "w-52" },
  { key: "data_source",     labelKey: "colDataSource", width: "w-24" },
  { key: "client_type",     labelKey: "colClientType", width: "w-24" },
  { key: "client_tier",     labelKey: "colClientTier", width: "w-28" },
  { key: "has_tc",          labelKey: "colHasTc",      width: "w-16" },
  { key: "review",          labelKey: "colReview",     width: "w-24" },
  { key: "freq_cycle",      labelKey: "colFreqCycle",  width: "w-20" },
  { key: "freq_tier",       labelKey: "colFreqTier",   width: "w-20" },
  { key: "address_purity",  labelKey: "colPurity",     width: "w-24" },
  { key: "balance_usd",     labelKey: "colBalance",    width: "w-28" },
  { key: "tx_in_period",    labelKey: "colTxPeriod",   width: "w-20" },
  { key: "collection_date", labelKey: "colCollection", width: "w-36" },
  { key: "update_time",     labelKey: "colUpdate",     width: "w-36" },
  { key: "reviewer",        labelKey: "colReviewer",   width: "w-24" },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ color: "var(--text-muted)" }}
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  )
}

interface Toast { id: number; ok: boolean; msg: string }

interface Props {
  data: WalletEntry[]
  total: number
  page: number
  perPage: number
  onPageChange: (p: number) => void
  onPerPageChange: (n: number) => void
  isLoading: boolean
  chain?: string
}

export function WalletTable({ data, total, page, perPage, onPageChange, onPerPageChange, isLoading, chain = "eth" }: Props) {
  const { t } = useI18n()
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [edits,   setEdits]   = useState<Record<string, Partial<WalletEntry>>>({})
  const [toasts,  setToasts]  = useState<Toast[]>([])

  function pushToast(ok: boolean, msg: string) {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, ok, msg }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }

  function editRow(id: string, field: keyof WalletEntry, value: string | boolean) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  async function correctType(address: string, newClientType: string) {
    // Validate: must be one of the known options
    if (!VALID_CLIENT_TYPES.has(newClientType)) {
      pushToast(false, `Invalid type: ${newClientType}`)
      return
    }
    const res = await correctWalletType(chain, address, newClientType)
    if (res.ok) {
      pushToast(true, `Saved "${newClientType}" — AI will learn`)
    } else {
      pushToast(false, res.message ?? "Save failed")
    }
  }

  function getRow(row: WalletEntry): WalletEntry {
    return edits[row.id] ? { ...row, ...edits[row.id] } : row
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === "asc") { setSortDir("desc") }
      else { setSortKey(null); setSortDir(null) }
    } else {
      setSortKey(key); setSortDir("asc")
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey || !sortDir) return 0
    const av = a[sortKey], bv = b[sortKey]
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === "asc" ? cmp : -cmp
  })

  const totalPages  = Math.ceil(total / perPage)
  const startEntry  = (page - 1) * perPage + 1
  const endEntry    = Math.min(page * perPage, total)

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown size={11} style={{ opacity: 0.4 }} />
    if (sortDir === "asc") return <ArrowUp size={11} style={{ color: "var(--accent)" }} />
    return <ArrowDown size={11} style={{ color: "var(--accent)" }} />
  }

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-100 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-2 px-3 py-2 rounded shadow-lg text-xs font-medium animate-fade-in"
            style={{
              background: toast.ok ? "#dcfce7" : "#fee2e2",
              color:      toast.ok ? "#15803d" : "#dc2626",
              border:     `1px solid ${toast.ok ? "#86efac" : "#fca5a5"}`,
            }}
          >
            <span>{toast.ok ? "✓" : "✗"}</span>
            <span>{toast.msg}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div
        className="overflow-auto flex-1 rounded border"
        style={{ borderColor: "var(--border)" }}
      >
        <table className="text-xs w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "var(--bg-base)", borderBottom: `1px solid var(--border)` }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer select-none ${col.width ?? ""}`}
                  style={{ color: "var(--text-secondary)" }}
                >
                  <div className="flex items-center gap-1">
                    {t(col.labelKey)}
                    <SortIcon col={col.key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: `1px solid var(--border-light)` }}>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-2">
                      <div className="h-3 rounded animate-pulse" style={{ background: "var(--border)" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-12 text-center" style={{ color: "var(--text-muted)" }}>
                  {t("noData")}
                </td>
              </tr>
            ) : (
              sorted.map((rawRow) => {
                const row = getRow(rawRow)
                return (
                <tr
                  key={row.id}
                  className="transition-colors"
                  style={{ borderBottom: `1px solid var(--border-light)` }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Address */}
                  <td className="px-3 py-2 font-mono group">
                    <div className="flex items-center">
                      <span className="truncate max-w-30 cursor-pointer hover:underline" style={{ color: "var(--text-link)" }} title={row.address}>
                        {row.address.slice(0, 8)}...{row.address.slice(-4)}
                      </span>
                      <CopyButton text={row.address} />
                    </div>
                  </td>
                  {/* Client ID */}
                  <td className="px-3 py-2 truncate max-w-50" style={{ color: "var(--text-muted)" }} title={row.client_id}>
                    {row.client_id}
                  </td>
                  {/* Data Source */}
                  <td className="px-3 py-2">
                    <span style={{
                      padding: "1px 6px", borderRadius: 4, fontSize: 11,
                      background: row.data_source === "R Real-time" ? "#dbeafe" : "#fef3c7",
                      color:      row.data_source === "R Real-time" ? "#1d4ed8" : "#92400e",
                    }}>
                      {row.data_source === "R Real-time" ? "R" : "H"}
                    </span>
                    <span className="ml-1" style={{ color: "var(--text-secondary)" }}>
                      {row.data_source.split(" ")[1]}
                    </span>
                  </td>
                  {/* Client Type — dropdown (also sends correction to backend) */}
                  <td className="px-3 py-1.5">
                    <CellDropdown
                      value={row.client_type}
                      options={CLIENT_TYPE_OPTS}
                      colorMap={CLIENT_TYPE_COLORS}
                      onChange={(v) => { editRow(row.id, "client_type", v); correctType(rawRow.address, v) }}
                    />
                  </td>
                  {/* Client Tier — dropdown */}
                  <td className="px-3 py-1.5">
                    <CellDropdown
                      value={row.client_tier}
                      options={CLIENT_TIER_OPTS}
                      onChange={(v) => editRow(row.id, "client_tier", v)}
                    />
                  </td>
                  {/* Has TC — dropdown */}
                  <td className="px-3 py-1.5">
                    <CellDropdown
                      value={row.has_tc ? "Yes" : "No"}
                      options={HAS_TC_OPTS}
                      onChange={(v) => editRow(row.id, "has_tc", v === "Yes")}
                    />
                  </td>
                  {/* Review — dropdown */}
                  <td className="px-3 py-1.5">
                    <CellDropdown
                      value={row.review}
                      options={REVIEW_OPTS}
                      onChange={(v) => editRow(row.id, "review", v)}
                    />
                  </td>
                  {/* Freq Cycle — dropdown */}
                  <td className="px-3 py-1.5">
                    <CellDropdown
                      value={row.freq_cycle}
                      options={FREQ_CYCLE_OPTS}
                      onChange={(v) => editRow(row.id, "freq_cycle", v)}
                    />
                  </td>
                  {/* Freq Tier — dropdown */}
                  <td className="px-3 py-1.5">
                    <CellDropdown
                      value={row.freq_tier}
                      options={FREQ_TIER_OPTS}
                      onChange={(v) => editRow(row.id, "freq_tier", v)}
                    />
                  </td>
                  {/* Address Purity */}
                  <td className="px-3 py-2">
                    <span style={{
                      padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                      background: row.address_purity.startsWith("C") ? "#dcfce7" : "#fee2e2",
                      color:      row.address_purity.startsWith("C") ? "#16a34a" : "#dc2626",
                    }}>
                      {row.address_purity}
                    </span>
                  </td>
                  {/* Balance USD */}
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {row.balance_usd > 0
                      ? `$${row.balance_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "$0.00"}
                  </td>
                  {/* Tx in Period */}
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{row.tx_in_period}</td>
                  {/* Collection Date */}
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{row.collection_date}</td>
                  {/* Update Time */}
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{row.update_time}</td>
                  {/* Reviewer */}
                  <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{row.reviewer}</td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        className="flex items-center justify-between px-2 py-2 border-t text-xs shrink-0"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        <span>
          {t("totalEntries", { total: total.toLocaleString(), start: total > 0 ? startEntry : 0, end: endEntry })}
        </span>
        <div className="flex items-center gap-1">
          {[
            { label: t("first"), fn: () => onPageChange(1),            disabled: page === 1 },
            { label: t("prev"),  fn: () => onPageChange(page - 1),     disabled: page === 1 },
            { label: t("next"),  fn: () => onPageChange(page + 1),     disabled: page >= totalPages },
            { label: t("last"),  fn: () => onPageChange(totalPages),   disabled: page >= totalPages },
          ].map(({ label, fn, disabled }) => (
            <button
              key={label}
              onClick={fn}
              disabled={disabled}
              className="px-2 py-1 rounded border disabled:opacity-40 hover:opacity-80 transition-opacity"
              style={{ borderColor: "var(--border)", background: "var(--bg-base)", color: "var(--text-secondary)" }}
            >
              {label}
            </button>
          ))}
          <span className="px-2">{page} / {totalPages}</span>
          <span style={{ color: "var(--text-muted)" }}>{t("perPage")}</span>
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="rounded px-1 py-0.5 text-xs ml-1 border"
            style={{ borderColor: "var(--border)", background: "var(--bg-base)", color: "var(--text-secondary)" }}
          >
            {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
