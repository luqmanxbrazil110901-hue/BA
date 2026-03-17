import { WalletListResponse } from "./types"

function seeded(seed: number) {
  let s = seed
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TOTAL = 3540
const HEX   = "0123456789abcdef"
const CLIENT_TYPES  = ["U Real user", "E Exchange", "S Script", "AP Malicious", "A Bridge"] as const
const CLIENT_TIERS  = ["L1 <10k", "L2 10k-99.9k", "L3 100k-999.9k", "L4 1M-9.9M", "L5 10M+"] as const
const FREQ_TIERS    = ["F1 0", "F2 1-3", "F3 4-10", "F4 11-19", "F5 20+"] as const
const REVIEWS       = ["A Auto", "M Manual", "TC Confirm"] as const

export function getMockWallets(page: number, perPage: number): WalletListResponse {
  const start = (page - 1) * perPage
  const data  = Array.from({ length: perPage }, (_, idx) => {
    const i   = start + idx
    const rng = seeded(i + 1)
    const addr = "0x" + Array.from({ length: 40 }, () => HEX[Math.floor(rng() * 16)]).join("")
    const mm   = String(Math.floor(rng() * 60)).padStart(2, "0")
    const ss   = String(Math.floor(rng() * 60)).padStart(2, "0")
    return {
      id:             `ID${String(i + 3521).padStart(7, "0")}`,
      address:        addr,
      client_id:      `ID${String(i + 3521).padStart(7, "0")}_R_U_1_A_D_F${Math.ceil(rng() * 5)}_C_260211`,
      data_source:    "R Real-time"  as const,
      client_type:    CLIENT_TYPES[Math.floor(rng() * CLIENT_TYPES.length)],
      client_tier:    CLIENT_TIERS[Math.floor(rng() * CLIENT_TIERS.length)],
      has_tc:         rng() > 0.9,
      review:         REVIEWS[Math.floor(rng() * REVIEWS.length)],
      freq_cycle:     "D Day"        as const,
      freq_tier:      FREQ_TIERS[Math.floor(rng() * FREQ_TIERS.length)],
      address_purity: (rng() > 0.05 ? "C Clean" : "P Toxic") as "C Clean" | "P Toxic",
      balance_usd:    rng() * 200000,
      tx_in_period:   Math.floor(rng() * 100) + 1,
      collection_date:"2026-02-11 00:00:00",
      update_time:    `2026-02-11 00:${mm}:${ss}`,
      reviewer:       "Ai Review",
    }
  })
  return { total: TOTAL, page, per_page: perPage, data }
}
