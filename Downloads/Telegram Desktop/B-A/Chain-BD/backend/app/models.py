from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class Wallet(BaseModel):
    address: str
    tx_count: int
    total_value_in: Optional[int] = None
    wallet_type: Optional[str] = None
    risk_score: Optional[float] = 0.0
    tags: Optional[List[str]] = []
    labels: Optional[List[dict]] = []

class Classification(BaseModel):
    type: str
    confidence: float
    tags: List[str] = []
    client_tier: str = "standard"  # New
    hist_type: str = "active"  # New
    u_rel_user: float = 0.5  # New
    u_label: str = "unknown"  # New
    u_bridge: float = 0.0  # New
    u_client: str = "unknown"  # New
    u_tier: str = "standard"  # New
    freq_cycle: str = "unknown"  # New
    freq_tier: str = "low"  # New
    tx_conf: str = "unknown"  # New
    txc: int = 0  # New
    yes: bool = False  # New
    probabilities: Dict[str, float] = {}  # All class probs
    features_used: Dict[str, Any] = {}  # Features
    reason: str = ""  # Explanation
    balance_eth: float = 0.0  # Etherscan

class Transaction(BaseModel):
    tx_hash: str
    block_number: int
    from_address: str
    to_address: str
    value: Optional[int] = 0
    timestamp: Optional[datetime] = None

class TxStatus(BaseModel):
    status: str
    confirmations: int
    block_number: Optional[int] = None
    timestamp: Optional[datetime] = None
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    value: float
    gas_used: Optional[int] = None

class WalletResponse(BaseModel):
    wallet: Wallet
    classification: Classification
    recent_txs_count: int
    eth_balance_usd: float = 0.0
    token_holdings_usd: float = 0.0
    total_balance_usd: float = 0.0

class DailyStat(BaseModel):
    date: str
    total_tx: int
    unique_wallets: int

class WalletListItem(BaseModel):
    id: str
    address: str
    client_id: str
    data_source: str
    client_type: str
    client_tier: str
    has_tc: bool
    review: str
    freq_cycle: str
    freq_tier: str
    address_purity: str
    balance_usd: float
    tx_in_period: int
    collection_date: str
    update_time: str
    reviewer: str

class WalletListResponse(BaseModel):
    total: int
    page: int
    per_page: int
    data: List[WalletListItem]