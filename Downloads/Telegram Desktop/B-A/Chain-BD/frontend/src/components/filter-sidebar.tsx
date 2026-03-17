"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"
import { FilterState } from "@/lib/types"
import { useI18n } from "@/lib/i18n-context"
import { TranslationKey } from "@/lib/i18n"

interface FilterGroup {
  key: keyof FilterState
  labelKey: TranslationKey
  options: { label: string; value: string; count: number }[]
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    key: "data_source", labelKey: "dataSource",
    options: [
      { label: "R Real-time", value: "R Real-time", count: 3537 },
      { label: "H Historical", value: "H Historical", count: 3 },
    ],
  },
  {
    key: "client_type", labelKey: "clientType",
    options: [
      { label: "U Real user",  value: "U Real user",  count: 2944 },
      { label: "E Exchange",   value: "E Exchange",   count: 278  },
      { label: "S Script",     value: "S Script",     count: 161  },
      { label: "AP Malicious", value: "AP Malicious", count: 154  },
      { label: "A Bridge",     value: "A Bridge",     count: 3    },
    ],
  },
  {
    key: "client_tier", labelKey: "clientTier",
    options: [
      { label: "L1 <10k",       value: "L1 <10k",       count: 3220 },
      { label: "L2 10k-99.9k",  value: "L2 10k-99.9k",  count: 206  },
      { label: "L3 100k-999.9k",value: "L3 100k-999.9k",count: 68   },
      { label: "L4 1M-9.9M",    value: "L4 1M-9.9M",    count: 27   },
      { label: "L5 10M+",       value: "L5 10M+",        count: 19   },
    ],
  },
  {
    key: "review", labelKey: "review",
    options: [
      { label: "A Auto",     value: "A Auto",     count: 3536 },
      { label: "M Manual",   value: "M Manual",   count: 4    },
      { label: "TC Confirm", value: "TC Confirm", count: 8    },
    ],
  },
  {
    key: "freq_cycle", labelKey: "freqCycle",
    options: [
      { label: "D Day",   value: "D Day",   count: 3534 },
      { label: "M Month", value: "M Month", count: 3    },
      { label: "W Week",  value: "W Week",  count: 2    },
      { label: "Y Year",  value: "Y Year",  count: 1    },
    ],
  },
  {
    key: "freq_tier", labelKey: "freqTier",
    options: [
      { label: "F2 1-3",   value: "F2 1-3",   count: 1439 },
      { label: "F5 20+",   value: "F5 20+",   count: 1181 },
      { label: "F3 4-10",  value: "F3 4-10",  count: 601  },
      { label: "F4 11-19", value: "F4 11-19", count: 288  },
      { label: "F1 0",     value: "F1 0",     count: 31   },
    ],
  },
  {
    key: "address_purity", labelKey: "addressPurity",
    options: [
      { label: "C Clean", value: "C Clean", count: 3536 },
      { label: "P Toxic", value: "P Toxic", count: 4    },
    ],
  },
  {
    key: "has_tc", labelKey: "hasTc",
    options: [
      { label: "No",  value: "No",  count: 3532 },
      { label: "Yes", value: "Yes", count: 8    },
    ],
  },
]

interface Props {
  filters: FilterState
  onChange: (f: FilterState) => void
}

export function FilterSidebar({ filters, onChange }: Props) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggle(key: string) {
    setCollapsed((p) => ({ ...p, [key]: !p[key] }))
  }

  function toggleValue(groupKey: keyof FilterState, value: string) {
    if (groupKey === "search") return
    const cur = filters[groupKey] as string[]
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
    onChange({ ...filters, [groupKey]: next })
  }

  function clearAll() {
    onChange({ data_source: [], client_type: [], client_tier: [], review: [], freq_cycle: [], freq_tier: [], address_purity: [], has_tc: [], search: "" })
  }

  const hasFilters = Object.entries(filters).some(([k, v]) =>
    k !== "search" ? (v as string[]).length > 0 : v !== ""
  )

  return (
    <aside
      className="w-48 shrink-0 border-r flex flex-col text-xs "
      style={{ background: "var(--bg-sidebar)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("filterTitle")}
        </span>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-0.5 text-[11px]"
            style={{ color: "var(--accent)" }}
          >
            <X size={11} /> {t("clearFilters")}
          </button>
        )}
      </div>

      <p className="px-3 py-1.5 text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
        {t("filterHint")}
      </p>

      <div className="overflow-y-auto flex-1 no-scrollbar">
        {FILTER_GROUPS.map((group) => {
          const selected = filters[group.key] as string[]
          const isOpen   = !collapsed[group.key]
          return (
            <div key={group.key} className="border-b" style={{ borderColor: "var(--border-light)" }}>
              <button
                onClick={() => toggle(group.key)}
                className="w-full flex items-center justify-between px-3 py-2 font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                <span>{t(group.labelKey)}</span>
                {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {isOpen && (
                <div className="pb-1">
                  {group.options.map((opt) => {
                    const active = selected.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleValue(group.key, opt.value)}
                        className="w-full flex items-center justify-between px-3 py-1 transition-colors"
                        style={{
                          background: active ? "var(--bg-active)" : "transparent",
                          color: active ? "#fff" : "var(--text-secondary)",
                        }}
                      >
                        <span className="truncate">{opt.label}</span>
                        <span className="ml-1" style={{ color: active ? "#ddd" : "var(--text-muted)" }}>
                          {opt.count.toLocaleString()}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
