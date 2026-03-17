from fastapi import APIRouter, Path, HTTPException, Body, Query
from fastapi.responses import RedirectResponse
from app.models import Wallet, Classification, WalletResponse, WalletListItem, WalletListResponse
from app.core.database import execute_query
from app.utils.bucketing import get_address_bucket
from app.utils.classifier import classify_wallet_type
from app.core.config import settings
from datetime import date, datetime
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
import requests
import time

router = APIRouter()

# ── Field mapping helpers ─────────────────────────────────────────────────────
def _client_type(wallet_type: str) -> str:
    return {
        "user":     "U Real user",
        "exchange": "E Exchange",
        "bot":      "S Script",
        "script":   "S Script",
        "bridge":   "A Bridge",
        "malicious":"AP Malicious",
    }.get((wallet_type or "").lower(), "U Real user")

def _client_tier(wallet_tier: str, balance_wei: int) -> str:
    if wallet_tier:
        return {
            "whale":   "L5 10M+",
            "shark":   "L4 1M-9.9M",
            "dolphin": "L3 100k-999.9k",
            "shrimp":  "L1 <10k",
        }.get(wallet_tier.lower(), "L1 <10k")
    usd = (balance_wei or 0) / 1e18 * _get_eth_price()
    if usd >= 10_000_000: return "L5 10M+"
    if usd >= 1_000_000:  return "L4 1M-9.9M"
    if usd >= 100_000:    return "L3 100k-999.9k"
    if usd >= 10_000:     return "L2 10k-99.9k"
    return "L1 <10k"

def _freq_tier(tx_count: int) -> str:
    if tx_count == 0:   return "F1 0"
    if tx_count <= 3:   return "F2 1-3"
    if tx_count <= 10:  return "F3 4-10"
    if tx_count <= 19:  return "F4 11-19"
    return "F5 20+"

def _row_to_list_item(i: int, row: dict, token_usd: float = 0.0) -> WalletListItem:
    addr        = row.get("address", "")
    tx_count    = int(row.get("tx_count") or 0)
    balance_wei = int(row.get("current_balance") or row.get("total_value_in") or 0)
    eth_price   = _get_eth_price()
    balance_usd = balance_wei / 1e18 * eth_price + token_usd  # ETH + token holdings
    risk        = float(row.get("risk_score") or 0.0)
    reviewed    = bool(row.get("reviewed"))
    reviewed_by = row.get("reviewed_by") or "Ai Review"
    wtype       = row.get("wallet_type") or "user"
    wtier       = row.get("wallet_tier") or ""
    updated     = row.get("updated_at") or row.get("last_seen") or datetime.utcnow()
    first_seen  = row.get("first_seen") or updated
    tags        = list(row.get("tags") or [])

    if reviewed:
        review = "TC Confirm" if "confirm" in reviewed_by.lower() else "M Manual"
    else:
        review = "A Auto"

    return WalletListItem(
        id              = f"ID{str(i).zfill(7)}",
        address         = addr,
        client_id       = f"ID{str(i).zfill(7)}_R_U_1_A_D_{_freq_tier(tx_count).replace(' ','')}_C_260211",
        data_source     = "R Real-time",
        client_type     = _client_type(wtype),
        client_tier     = _client_tier(wtier, balance_wei),
        has_tc          = "tc" in [t.lower() for t in tags] or reviewed,
        review          = review,
        freq_cycle      = "D Day",
        freq_tier       = _freq_tier(tx_count),
        address_purity  = "P Toxic" if risk > 0.7 else "C Clean",
        balance_usd     = round(balance_usd, 2),
        tx_in_period    = tx_count,
        collection_date = str(first_seen)[:19] if first_seen else "",
        update_time     = str(updated)[:19] if updated else "",
        reviewer        = reviewed_by,
    )

def _heuristic_wallet_type(tx_count: int, balance_wei: int) -> str:
    """Quick rule-based classification used for Etherscan-sourced addresses."""
    eth = balance_wei / 1e18
    if eth > 500  or tx_count > 5000:     return "exchange"
    if eth > 50   and tx_count > 100:     return "exchange"
    if eth > 200:                         return "exchange"
    if tx_count > 400:                    return "bot"
    if tx_count > 100:                    return "bot"
    if 40 <= tx_count <= 100:             return "bridge"   # medium-activity: cross-chain users
    if tx_count < 20:                     return "real_user"
    if eth > 10:                          return "bridge"
    return "unknown"


def _batch_eth_balances(chain: str, addresses: list[str]) -> dict[str, int]:
    """Fetch ETH balances for up to 20 addresses per call using balancemulti.
    Returns {address_lower: balance_wei}. Never raises."""
    key      = settings.etherscan_api_key
    chain_id = _CHAIN_IDS.get(chain, 1)
    base     = f"https://api.etherscan.io/v2/api?chainid={chain_id}&apikey={key}"
    result: dict[str, int] = {}

    # Split into chunks of 20 (Etherscan balancemulti limit)
    chunks = [addresses[i:i+20] for i in range(0, len(addresses), 20)]

    def fetch_chunk(addrs: list[str]) -> dict[str, int]:
        try:
            r = requests.get(
                f"{base}&module=account&action=balancemulti"
                f"&address={','.join(addrs)}&tag=latest",
                timeout=10
            ).json()
            if r.get("status") == "1":
                return {item["account"].lower(): int(item["balance"]) for item in r["result"]}
        except Exception:
            pass
        return {}

    try:
        with ThreadPoolExecutor(max_workers=min(len(chunks), 5)) as ex:
            for partial in ex.map(fetch_chunk, chunks):
                result.update(partial)
    except Exception:
        pass
    return result


def _etherscan_recent_addresses(chain: str, count: int = 100) -> list[dict]:
    """Fetch recent unique addresses from Etherscan block transactions, enriched with ETH balances."""
    key = settings.etherscan_api_key
    chain_id = _CHAIN_IDS.get(chain, 1)
    base = f"https://api.etherscan.io/v2/api?chainid={chain_id}&apikey={key}"
    try:
        # Get recent txs for a known active address as a seed (Uniswap router)
        r = requests.get(
            f"{base}&module=account&action=txlist"
            f"&address=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
            f"&startblock=0&endblock=99999999&page=1&offset={min(count,100)}&sort=desc",
            timeout=10
        ).json()
        seen, rows = set(), []
        for tx in (r.get("result") or []):
            for addr in [tx.get("from"), tx.get("to")]:
                if addr and addr not in seen and len(addr) == 42:
                    seen.add(addr)
                    rows.append({"address": addr, "tx_count": int(tx.get("nonce") or 0),
                                 "current_balance": 0, "wallet_type": "user",
                                 "wallet_tier": "", "risk_score": 0.0,
                                 "reviewed": False, "tags": []})
        rows = rows[:count]

        # Enrich with real ETH balances via balancemulti
        if rows:
            addrs = [r["address"] for r in rows]
            balances = _batch_eth_balances(chain, addrs)
            for row in rows:
                bal = balances.get(row["address"].lower(), 0)
                row["current_balance"] = bal
                # Classify by heuristics so the list shows diverse types
                row["wallet_type"] = _heuristic_wallet_type(row["tx_count"], bal)

        return rows
    except Exception:
        return []

_CHAIN_IDS = {
    "eth": 1, "bnb": 56, "arb": 42161, "op": 10,
    "base": 8453, "polygon": 137, "avax": 43114,
}

_eth_price_cache: dict = {"price": 3000.0, "ts": 0.0}

def _get_eth_price() -> float:
    """Fetch live ETH/USD price from Etherscan, cached for 60s."""
    import time
    now = time.time()
    if now - _eth_price_cache["ts"] < 60:
        return _eth_price_cache["price"]
    try:
        key = settings.etherscan_api_key
        r = requests.get(
            f"https://api.etherscan.io/v2/api?chainid=1&apikey={key}"
            f"&module=stats&action=ethprice",
            timeout=5
        ).json()
        if r.get("status") == "1":
            price = float(r["result"]["ethusd"])
            _eth_price_cache["price"] = price
            _eth_price_cache["ts"] = now
            return price
    except Exception:
        pass
    return _eth_price_cache["price"]

# ── Token price cache: {contract_lower: usd_price}, refreshed every 5 min ────
_token_price_cache: dict = {"prices": {}, "ts": 0.0}

def _get_token_prices_usd(contract_addresses: list[str]) -> dict[str, float]:
    """Fetch USD prices for ERC-20 contracts via DexScreener (free, no limit). Cached 5 min."""
    if not contract_addresses:
        return {}
    now = time.time()
    cached = _token_price_cache["prices"]
    missing = [a for a in contract_addresses if a.lower() not in cached]

    if missing:
        # DexScreener supports comma-separated contracts, up to 30 per request
        chunks = [missing[i:i+30] for i in range(0, len(missing), 30)]
        for chunk in chunks:
            try:
                joined = ",".join(chunk)
                r = requests.get(
                    f"https://api.dexscreener.com/tokens/v1/ethereum/{joined}",
                    timeout=8,
                    headers={"Accept": "application/json"},
                ).json()
                # DexScreener returns a list of pairs; take highest-liquidity pair per token
                seen: dict[str, float] = {}
                for pair in (r if isinstance(r, list) else []):
                    addr = pair.get("baseToken", {}).get("address", "").lower()
                    price = float(pair.get("priceUsd") or 0)
                    liq   = float((pair.get("liquidity") or {}).get("usd", 0))
                    if addr and price > 0:
                        if addr not in seen or liq > seen.get(f"_liq_{addr}", 0):
                            seen[addr] = price
                            seen[f"_liq_{addr}"] = liq
                for addr, price in seen.items():
                    if not addr.startswith("_liq_"):
                        cached[addr] = price
                _token_price_cache["ts"] = now
            except Exception:
                pass

    return {a.lower(): cached.get(a.lower(), 0.0) for a in contract_addresses}


def _get_token_holdings_usd(chain: str, address: str) -> float:
    """Fetch ERC-20 token holdings USD value for a single address. Never raises."""
    if chain != "eth":  # Only ETH chain supported via Etherscan free tier
        return 0.0
    try:
        key      = settings.etherscan_api_key
        chain_id = _CHAIN_IDS.get(chain, 1)
        base     = f"https://api.etherscan.io/v2/api?chainid={chain_id}&apikey={key}"

        # Step 1: find which tokens this address has interacted with
        r = requests.get(
            f"{base}&module=account&action=tokentx"
            f"&address={address}&page=1&offset=100&sort=desc",
            timeout=8,
        ).json()
        if r.get("status") != "1":
            return 0.0

        contracts = list({tx["contractAddress"].lower() for tx in r["result"]})
        if not contracts:
            return 0.0

        # Step 2: get current balance for each token (parallel)
        def fetch_token_bal(contract: str):
            try:
                d = requests.get(
                    f"{base}&module=account&action=tokenbalance"
                    f"&contractaddress={contract}&address={address}&tag=latest",
                    timeout=5,
                ).json()
                if d.get("status") == "1":
                    raw = int(d["result"])
                    # Get decimals from tokentx result
                    decimals = next(
                        (int(tx.get("tokenDecimal", 18)) for tx in r["result"]
                         if tx["contractAddress"].lower() == contract),
                        18,
                    )
                    return contract, raw / (10 ** decimals)
            except Exception:
                pass
            return contract, 0.0

        with ThreadPoolExecutor(max_workers=8) as ex:
            token_bals = dict(ex.map(lambda c: fetch_token_bal(c), contracts[:30]))

        # Filter zero balances
        non_zero = {c: v for c, v in token_bals.items() if v > 0}
        if not non_zero:
            return 0.0

        # Step 3: get USD prices from CoinGecko
        prices = _get_token_prices_usd(list(non_zero.keys()))

        total = sum(amt * prices.get(c, 0.0) for c, amt in non_zero.items())
        return total
    except Exception:
        return 0.0


def _get_token_holdings_usd_batch(chain: str, addresses: list[str]) -> dict[str, float]:
    """Fetch token holdings USD for a batch of addresses in parallel. Never raises."""
    result: dict[str, float] = {}
    if not addresses:
        return result
    try:
        with ThreadPoolExecutor(max_workers=5) as ex:
            futures = {ex.submit(_get_token_holdings_usd, chain, addr): addr for addr in addresses}
            for fut, addr in futures.items():
                try:
                    result[addr.lower()] = fut.result(timeout=15)
                except Exception:
                    result[addr.lower()] = 0.0
    except Exception:
        pass
    return result


def _etherscan_wallet_fallback(chain: str, address: str) -> dict:
    """Fetch balance + tx count from Etherscan in parallel. Never raises."""
    key      = settings.etherscan_api_key
    chain_id = _CHAIN_IDS.get(chain, 1)
    base     = f"https://api.etherscan.io/v2/api?chainid={chain_id}&apikey={key}"

    def get_balance():
        r = requests.get(f"{base}&module=account&action=balance&address={address}&tag=latest", timeout=5)
        d = r.json()
        return int(d["result"]) if d.get("status") == "1" else 0

    def get_tx_count():
        r = requests.get(f"{base}&module=proxy&action=eth_getTransactionCount&address={address}&tag=latest", timeout=5)
        d = r.json()
        return int(d["result"], 16) if d.get("result") else 0

    balance_wei, tx_count = 0, 0
    try:
        with ThreadPoolExecutor(max_workers=2) as ex:
            f_bal = ex.submit(get_balance)
            f_txc = ex.submit(get_tx_count)
            balance_wei = f_bal.result(timeout=6)
            tx_count    = f_txc.result(timeout=6)
    except Exception as e:
        print(f"Etherscan fallback partial/failed for {address}: {e}")

    return {
        "address": address, "tx_count": tx_count,
        "total_value_in": balance_wei, "wallet_type": None,
        "risk_score": 0.0, "tags": [], "labels": [],
    }


@router.get("/{chain}/wallets/list", response_model=WalletListResponse)
def list_wallets(
    chain: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    wallet_type: Optional[str] = None,
    wallet_tier: Optional[str] = None,
    search: Optional[str] = None,
):
    rows = []
    today = str(date.today())

    # ── 1. Try ScyllaDB wallets_by_activity (today's active wallets) ──────────
    try:
        if wallet_type:
            cql = (
                f"SELECT address, wallet_type, wallet_tier, risk_score, tx_count, "
                f"current_balance, reviewed, reviewed_by, tags, updated_at "
                f"FROM wallets_by_type "
                f"WHERE wallet_type = '{wallet_type}' AND wallet_tier = '{wallet_tier or 'shrimp'}' "
                f"LIMIT 1000;"
            )
        else:
            cql = (
                f"SELECT address, wallet_type, wallet_tier, risk_score, tx_count, "
                f"updated_at, tags "
                f"FROM wallets_by_activity WHERE day = '{today}' LIMIT 1000;"
            )
        rows = [dict(r) for r in execute_query(chain, cql)]
    except Exception:
        rows = []

    # ── 2. Fallback: Etherscan recent addresses ───────────────────────────────
    if not rows:
        rows = _etherscan_recent_addresses(chain, 200)

    # ── 3. Search filter ──────────────────────────────────────────────────────
    if search:
        q = search.lower()
        rows = [r for r in rows if q in (r.get("address") or "").lower()]

    total = len(rows)
    start = (page - 1) * per_page
    page_rows = rows[start: start + per_page]

    # Fetch token holdings for current page addresses in parallel
    page_addrs = [r["address"] for r in page_rows if r.get("address")]
    token_holdings = _get_token_holdings_usd_batch(chain, page_addrs)

    data = [
        _row_to_list_item(start + i + 1, r, token_usd=token_holdings.get((r.get("address") or "").lower(), 0.0))
        for i, r in enumerate(page_rows)
    ]
    return WalletListResponse(total=total, page=page, per_page=per_page, data=data)


@router.get("/{chain}/wallets/{address}", response_model=WalletResponse)
def get_wallet(chain: str, address: str = Path(...)):
    address = address.strip()
    bucket = get_address_bucket(address)

    try:
        rows = execute_query(chain, f"SELECT * FROM wallets WHERE address_bucket = {bucket} AND address = '{address}';")
    except Exception:
        rows = []

    row = dict(rows[0]) if rows else _etherscan_wallet_fallback(chain, address)
    row["chain"] = chain
    row["address"] = address

    try:
        classification = classify_wallet_type(row)
    except Exception:
        classification = {"type": "unknown", "confidence": 0.0, "tags": []}

    try:
        labels = [dict(r) for r in execute_query(chain, f"SELECT label, category FROM labels_by_category WHERE address = '{address}';")]
    except Exception:
        labels = []
    row["labels"] = labels

    try:
        recent_count = len(execute_query(chain, f"SELECT tx_hash FROM transactions_by_address WHERE address_bucket = {bucket} AND address = '{address}' LIMIT 10;"))
    except Exception:
        recent_count = row.get("tx_count", 0)

    # Add token holdings to balance
    token_usd   = _get_token_holdings_usd(chain, address)
    eth_price   = _get_eth_price()
    balance_wei = int(row.get("total_value_in") or row.get("current_balance") or 0)
    eth_usd     = round(balance_wei / 1e18 * eth_price, 2)
    total_usd   = round(eth_usd + token_usd, 2)

    return WalletResponse(
        wallet=Wallet(**{k: v for k, v in row.items() if k in Wallet.model_fields}),
        classification=Classification(**{k: v for k, v in classification.items() if k in ["type", "confidence", "tags"]}),
        recent_txs_count=recent_count,
        eth_balance_usd=eth_usd,
        token_holdings_usd=round(token_usd, 2),
        total_balance_usd=total_usd,
    )


@router.post("/{chain}/wallets/{address}/correct")
def correct_wallet_label(chain: str, address: str = Path(...), corrected_type: str = Body(...)):
    from app.utils.xgboost_learner import correct_label
    bucket = get_address_bucket(address)
    try:
        rows = execute_query(chain, f"SELECT * FROM wallets WHERE address_bucket = {bucket} AND address = '{address}';")
        features = dict(rows[0]) if rows else {}
        return correct_label(address, chain, corrected_type, features)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Shorthand /api/{chain}/{address} – MUST be last (2-segment catch-all) ─────
@router.get("/{chain}/{address}", include_in_schema=False)
def shorthand_address_lookup(chain: str, address: str = Path(...)):
    address = address.strip()
    if len(address) == 66:
        return RedirectResponse(url=f"/api/{chain}/txs/{address}/status")
    if len(address) == 42:
        return RedirectResponse(url=f"/api/{chain}/wallets/{address}")
    raise HTTPException(
        400,
        f"Unrecognized format ({len(address)} chars). "
        "Wallet = 42 chars, tx hash = 66 chars.",
    )
