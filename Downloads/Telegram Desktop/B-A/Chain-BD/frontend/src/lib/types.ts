export type DataSource = "R Real-time" | "H Historical"
export type ClientType = "U Real user" | "E Exchange" | "S Script" | "AP Malicious" | "A Bridge"
export type ClientTier = "L1 <10k" | "L2 10k-99.9k" | "L3 100k-999.9k" | "L4 1M-9.9M" | "L5 10M+"
export type ReviewStatus = "A Auto" | "M Manual" | "TC Confirm"
export type FreqCycle = "D Day" | "M Month" | "W Week" | "Y Year"
export type FreqTier = "F1 0" | "F2 1-3" | "F3 4-10" | "F4 11-19" | "F5 20+"
export type AddressPurity = "C Clean" | "P Toxic"

export interface WalletEntry {
  id: string
  address: string
  client_id: string
  data_source: DataSource
  client_type: ClientType
  client_tier: ClientTier
  has_tc: boolean
  review: ReviewStatus
  freq_cycle: FreqCycle
  freq_tier: FreqTier
  address_purity: AddressPurity
  balance_usd: number
  tx_in_period: number
  collection_date: string
  update_time: string
  reviewer: string
}

export interface WalletListResponse {
  total: number
  page: number
  per_page: number
  data: WalletEntry[]
}

export interface FilterState {
  data_source: string[]
  client_type: string[]
  client_tier: string[]
  review: string[]
  freq_cycle: string[]
  freq_tier: string[]
  address_purity: string[]
  has_tc: string[]
  search: string
}

export interface FilterCount {
  label: string
  value: string
  count: number
}
