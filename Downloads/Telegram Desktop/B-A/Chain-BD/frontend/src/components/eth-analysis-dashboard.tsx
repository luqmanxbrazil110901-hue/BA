"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import {
  Search, RefreshCw, Download, SlidersHorizontal,
  Globe, Sun, Moon, User, ChevronDown,
} from "lucide-react"
import { FilterSidebar } from "./filter-sidebar"
import { WalletTable } from "./wallet-table"
import { fetchWalletsApi } from "@/lib/api"
import { getMockWallets } from "@/lib/mock"
import { FilterState } from "@/lib/types"
import { useI18n } from "@/lib/i18n-context"
import { LOCALES, Locale } from "@/lib/i18n"

const DEFAULT_FILTERS: FilterState = {
  data_source: [], client_type: [], client_tier: [], review: [],
  freq_cycle: [], freq_tier: [], address_purity: [], has_tc: [], search: "",
}

export function EthAnalysisDashboard() {
  const { t, locale, setLocale } = useI18n()
  const { theme, setTheme }      = useTheme()
  // Avoid hydration mismatch: don't render theme-dependent UI until mounted
  const [mounted, setMounted]    = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && theme === "dark"

  const [filters, setFilters]         = useState<FilterState>(DEFAULT_FILTERS)
  const [page, setPage]               = useState(1)
  const [perPage, setPerPage]         = useState(50)
  const [searchInput, setSearchInput] = useState("")
  const [langOpen, setLangOpen]       = useState(false)

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey:       ["wallets", filters, page, perPage],
    queryFn:        () => fetchWalletsApi(filters, page, perPage),
    // If backend fails, fall back to mock
    placeholderData: (prev) => prev,
    retry:          1,
  })

  // Show mock when backend is unreachable
  const displayData = data ?? getMockWallets(page, perPage)

  function handleFilterChange(next: FilterState) { setFilters(next); setPage(1) }
  function handleSearch() { setFilters((f) => ({ ...f, search: searchInput })); setPage(1) }
  function handlePageChange(p: number) { setPage(p) }
  function handlePerPageChange(n: number) { setPerPage(n); setPage(1) }

  function handleDownload() {
    const rows = displayData.data.map((r: (typeof displayData.data)[0]) => [
      r.address, r.client_id, r.data_source, r.client_type, r.client_tier,
      r.has_tc ? "Yes" : "No", r.review, r.freq_cycle, r.freq_tier,
      r.address_purity, r.balance_usd.toFixed(2), r.tx_in_period,
      r.collection_date, r.update_time, r.reviewer,
    ])
    const header = [
      t("colAddress"), t("colClientId"), t("colDataSource"), t("colClientType"),
      t("colClientTier"), t("colHasTc"), t("colReview"), t("colFreqCycle"),
      t("colFreqTier"), t("colPurity"), t("colBalance"), t("colTxPeriod"),
      t("colCollection"), t("colUpdate"), t("colReviewer"),
    ]
    const csv  = [header, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a    = document.createElement("a")
    a.href     = URL.createObjectURL(blob)
    a.download = `eth_analysis_page${page}.csv`
    a.click()
  }

  const total      = displayData.total
  const startEntry = (page - 1) * perPage + 1
  const endEntry   = Math.min(page * perPage, total)
  const currentLang = LOCALES.find((l) => l.value === locale)

  return (
    <div className="flex flex-col h-screen text-sm"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
        style={{ background: "var(--bg-header)", borderColor: "var(--border)" }}
      >
        <h1 className="font-semibold text-base">{t("appTitle")}</h1>

        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>

          {/* Language picker */}
          <div className="relative">
            <button onClick={() => setLangOpen((o) => !o)}
              className="flex items-center gap-1 px-2 py-1.5 rounded hover:opacity-80 transition-opacity"
            >
              <Globe size={13} />
              <span>{currentLang?.label}</span>
              <ChevronDown size={11} />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 rounded shadow-lg border z-50 overflow-hidden min-w-[100px]"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
              >
                {LOCALES.map((loc) => (
                  <button key={loc.value}
                    onClick={() => { setLocale(loc.value as Locale); setLangOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-opacity flex items-center gap-2"
                    style={{
                      background: locale === loc.value ? "var(--bg-active)" : "transparent",
                      color: locale === loc.value ? "#fff" : "var(--text-primary)",
                    }}
                  >
                    <span className="font-medium">{loc.label}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {loc.value === "en" ? "English" : loc.value === "zh" ? "中文" : "Tiếng Việt"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme toggle — only render after mount to avoid mismatch */}
          {mounted && (
            <button onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex items-center gap-1 px-2 py-1.5 rounded hover:opacity-80 transition-opacity"
            >
              {isDark ? <Moon size={13} /> : <Sun size={13} />}
              <span>{isDark ? t("darkMode") : t("lightMode")}</span>
            </button>
          )}

          {/* User */}
          <div className="flex items-center gap-1 pl-2 ml-1 border-l"
            style={{ borderColor: "var(--border)" }}
          >
            <User size={13} />
            <span>{t("adminLabel")}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <FilterSidebar filters={filters} onChange={handleFilterChange} />

        {/* ── Main ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 p-4 gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{t("dataList")}</h2>
            {error && (
              <span className="text-[11px] px-2 py-0.5 rounded"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                Backend offline — showing demo data
              </span>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 rounded px-3 py-2 shrink-0 border"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {t("totalEntries", { total: total.toLocaleString(), start: total > 0 ? startEntry : 0, end: endEntry })}
              </span>
              <div className="flex items-center rounded overflow-hidden ml-2 border"
                style={{ borderColor: "var(--border)" }}
              >
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder={t("searchPlaceholder")}
                  className="text-xs px-2 py-1.5 w-44 outline-none bg-transparent"
                  style={{ color: "var(--text-primary)" }}
                />
                <button onClick={handleSearch} className="px-2 py-1.5 border-l"
                  style={{ background: "var(--bg-base)", borderColor: "var(--border)" }}
                >
                  <Search size={12} style={{ color: "var(--text-muted)" }} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border hover:opacity-80"
                style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <SlidersHorizontal size={12} /> {t("advancedFilter")}
              </button>
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border hover:opacity-80"
                style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <Download size={12} /> {t("downloadPage")}
              </button>
              <button onClick={() => refetch()} disabled={isFetching}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border hover:opacity-80 disabled:opacity-40"
                style={{ background: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
                {t("refresh")}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 min-h-0">
            <WalletTable
              data={displayData.data}
              total={total}
              page={page}
              perPage={perPage}
              onPageChange={handlePageChange}
              onPerPageChange={handlePerPageChange}
              isLoading={isLoading}
              chain="eth"
            />
          </div>
        </main>
      </div>

      {langOpen && <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />}
    </div>
  )
}
