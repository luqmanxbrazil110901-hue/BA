"use server"

import { FilterState, WalletListResponse } from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001"

// ── Map frontend filter values → backend query params ────────────────────────
const CLIENT_TYPE_MAP: Record<string, string> = {
  "U Real user":  "user",
  "E Exchange":   "exchange",
  "S Script":     "bot",
  "AP Malicious": "malicious",
  "A Bridge":     "bridge",
}
const CLIENT_TIER_MAP: Record<string, string> = {
  "L1 <10k":        "shrimp",
  "L2 10k-99.9k":   "dolphin",
  "L3 100k-999.9k": "dolphin",
  "L4 1M-9.9M":     "shark",
  "L5 10M+":        "whale",
}

export async function fetchWallets(
  filters: Partial<FilterState>,
  page: number = 1,
  perPage: number = 50,
  chain: string = "eth"
): Promise<WalletListResponse> {
  const params = new URLSearchParams()
  params.set("page",     String(page))
  params.set("per_page", String(perPage))

  if (filters.search)
    params.set("search", filters.search)

  // If a single wallet_type filter is active, send it to backend
  if (filters.client_type?.length === 1)
    params.set("wallet_type", CLIENT_TYPE_MAP[filters.client_type[0]] ?? "user")

  if (filters.client_tier?.length === 1)
    params.set("wallet_tier", CLIENT_TIER_MAP[filters.client_tier[0]] ?? "shrimp")

  try {
    const res = await fetch(
      `${API_BASE}/api/${chain}/wallets/list?${params}`,
      { cache: "no-store" }
    )
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data: WalletListResponse = await res.json()

    // Client-side multi-filter (backend handles single-value; filter rest here)
    let filtered = data.data
    if ((filters.client_type?.length ?? 0) > 1)
      filtered = filtered.filter((r) => filters.client_type!.includes(r.client_type))
    if ((filters.client_tier?.length ?? 0) > 1)
      filtered = filtered.filter((r) => filters.client_tier!.includes(r.client_tier))
    if (filters.review?.length)
      filtered = filtered.filter((r) => filters.review!.includes(r.review))
    if (filters.freq_cycle?.length)
      filtered = filtered.filter((r) => filters.freq_cycle!.includes(r.freq_cycle))
    if (filters.freq_tier?.length)
      filtered = filtered.filter((r) => filters.freq_tier!.includes(r.freq_tier))
    if (filters.address_purity?.length)
      filtered = filtered.filter((r) => filters.address_purity!.includes(r.address_purity))
    if (filters.has_tc?.length)
      filtered = filtered.filter((r) =>
        filters.has_tc!.includes(r.has_tc ? "Yes" : "No")
      )

    return { ...data, data: filtered, total: filtered.length || data.total }
  } catch (err) {
    console.warn("Backend unavailable, using mock data:", err)
    return getMockData(filters, page, perPage)
  }
}

export async function fetchWalletDetail(address: string, chain = "eth") {
  try {
    const res = await fetch(`${API_BASE}/api/${chain}/wallets/${address}`, {
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    return res.json()
  } catch {
    return null
  }
}

// ── Deterministic seeded PRNG (mulberry32) — same output server + client ──────
function seeded(seed: number) {
  let s = seed
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Mock data (fallback when backend is offline) ──────────────────────────────
function getMockData(
  _filters: Partial<FilterState>,
  page: number,
  perPage: number
): WalletListResponse {
  const clientTypes = ["U Real user", "E Exchange", "S Script", "AP Malicious", "A Bridge"] as const
  const clientTiers = ["L1 <10k", "L2 10k-99.9k", "L3 100k-999.9k", "L4 1M-9.9M", "L5 10M+"] as const
  const freqTiers   = ["F1 0", "F2 1-3", "F3 4-10", "F4 11-19", "F5 20+"] as const
  const reviews     = ["A Auto", "M Manual", "TC Confirm"] as const
  const HEX         = "0123456789abcdef"

  const allData = Array.from({ length: 3540 }, (_, i) => {
    const rng  = seeded(i + 1)
    const addr = "0x" + Array.from({ length: 40 }, () => HEX[Math.floor(rng() * 16)]).join("")
    const mm   = String(Math.floor(rng() * 60)).padStart(2, "0")
    const ss   = String(Math.floor(rng() * 60)).padStart(2, "0")
    return {
      id:             `ID${String(i + 3521).padStart(7, "0")}`,
      address:        addr,
      client_id:      `ID${String(i + 3521).padStart(7, "0")}_R_U_1_A_D_F${Math.ceil(rng() * 5)}_C_260211`,
      data_source:    "R Real-time" as const,
      client_type:    clientTypes[Math.floor(rng() * clientTypes.length)],
      client_tier:    clientTiers[Math.floor(rng() * clientTiers.length)],
      has_tc:         rng() > 0.9,
      review:         reviews[Math.floor(rng() * reviews.length)],
      freq_cycle:     "D Day" as const,
      freq_tier:      freqTiers[Math.floor(rng() * freqTiers.length)],
      address_purity: rng() > 0.05 ? "C Clean" : "P Toxic",
      balance_usd:    rng() * 200000,
      tx_in_period:   Math.floor(rng() * 100) + 1,
      collection_date:"2026-02-11 00:00:00",
      update_time:    `2026-02-11 00:${mm}:${ss}`,
      reviewer:       "Ai Review",
    }
  })

  const start = (page - 1) * perPage
  return { total: allData.length, page, per_page: perPage, data: allData.slice(start, start + perPage) as WalletListResponse["data"] }
}
