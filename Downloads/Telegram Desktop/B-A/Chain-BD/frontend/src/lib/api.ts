// Pure client-side API calls — no "use server", no hydration issues
import { FilterState, WalletListResponse } from "./types"

// Support both env var names
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8001"

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

// ── Wallet list (dashboard table) ─────────────────────────────────────────────
export async function fetchWalletsApi(
  filters: Partial<FilterState>,
  page: number = 1,
  perPage: number = 50,
  chain: string = "eth"
): Promise<WalletListResponse> {
  const params = new URLSearchParams()
  params.set("page",     String(page))
  params.set("per_page", String(perPage))
  if (filters.search)                    params.set("search",      filters.search)
  if (filters.client_type?.length === 1) params.set("wallet_type", CLIENT_TYPE_MAP[filters.client_type[0]] ?? "user")
  if (filters.client_tier?.length === 1) params.set("wallet_tier", CLIENT_TIER_MAP[filters.client_tier[0]] ?? "shrimp")

  const res = await fetch(`${API_BASE}/api/${chain}/wallets/list?${params}`, { cache: "no-store" })
  if (!res.ok) throw new Error(`API ${res.status}`)

  const data: WalletListResponse = await res.json()

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
    filtered = filtered.filter((r) => filters.has_tc!.includes(r.has_tc ? "Yes" : "No"))

  return { ...data, data: filtered, total: filtered.length || data.total }
}

// ── Single wallet detail ──────────────────────────────────────────────────────
export async function fetchWallet(chain: string, address: string) {
  const res = await fetch(`${API_BASE}/api/${chain}/wallets/${address}`, { cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch wallet")
  return res.json()
}

// ── Wallet transactions ───────────────────────────────────────────────────────
export async function fetchWalletTxs(chain: string, address: string, limit = 10) {
  const res = await fetch(`${API_BASE}/api/${chain}/wallets/${address}/txs?limit=${limit}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch TXs")
  return res.json()
}

// ── Daily stats ───────────────────────────────────────────────────────────────
export async function fetchDailyStats(chain: string, days = 7) {
  const res = await fetch(`${API_BASE}/api/${chain}/stats/daily?days=${days}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch stats")
  return res.json()
}

// ── Correct wallet type (AI learning) ────────────────────────────────────────
export async function correctWalletType(
  chain: string,
  address: string,
  clientTypeLabel: string   // e.g. "U Real user"
): Promise<{ ok: boolean; message?: string }> {
  // Map display label → backend type
  const backendType = CLIENT_TYPE_MAP[clientTypeLabel] ?? clientTypeLabel
  try {
    const res = await fetch(
      `${API_BASE}/api/${chain}/wallets/${address}/correct`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendType),
        cache: "no-store",
      }
    )
    if (!res.ok) return { ok: false, message: `Error ${res.status}` }
    return { ok: true }
  } catch {
    return { ok: false, message: "Network error" }
  }
}

// ── Transaction status ────────────────────────────────────────────────────────
export async function fetchTxStatus(chain: string, txHash: string) {
  const res = await fetch(`${API_BASE}/api/${chain}/txs/${txHash}/status`, { cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch TX status")
  return res.json()
}
