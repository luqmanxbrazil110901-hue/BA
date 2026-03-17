import requests
from typing import Dict, Optional
from datetime import datetime
from app.core.database import execute_query
from app.core.config import settings

BASE = "https://api.etherscan.io/v2/api?chainid=1"

def _get(params: dict, timeout: int = 8) -> Optional[dict]:
    key = settings.etherscan_api_key
    if not key:
        return None
    try:
        r = requests.get(BASE, params={**params, "apikey": key}, timeout=timeout)
        return r.json()
    except Exception as e:
        print(f"Etherscan HTTP error: {e}")
        return None

def get_eth_tx_status(tx_hash: str) -> Optional[Dict]:
    if not settings.etherscan_api_key:
        return None

    # ── 1. Try proxy endpoint (works for recent txs) ──────────────────────────
    tx, receipt = None, None
    d = _get({"module": "proxy", "action": "eth_getTransactionByHash", "txhash": tx_hash})
    if d and isinstance(d.get("result"), dict):
        tx = d["result"]

    d2 = _get({"module": "proxy", "action": "eth_getTransactionReceipt", "txhash": tx_hash})
    if d2 and isinstance(d2.get("result"), dict):
        receipt = d2["result"]

    # ── 2. Fallback: Etherscan's own index (works for archive txs) ────────────
    receipt_status_resp = _get({"module": "transaction", "action": "gettxreceiptstatus", "txhash": tx_hash})
    receipt_status = None
    if receipt_status_resp and receipt_status_resp.get("message") == "OK":
        receipt_status = receipt_status_resp["result"].get("status")  # "1"=ok "0"=fail ""=unknown

    # If nothing came back at all, we can't help
    if tx is None and receipt is None and receipt_status is None:
        return None

    # ── 3. Current block for confirmation count ───────────────────────────────
    current_block = 0
    bn = _get({"module": "proxy", "action": "eth_blockNumber"})
    if bn and bn.get("result"):
        try:
            current_block = int(bn["result"], 16)
        except Exception:
            pass

    # ── 4. Build response ─────────────────────────────────────────────────────
    block_number = None
    if tx and tx.get("blockNumber"):
        try:
            block_number = int(tx["blockNumber"], 16)
        except Exception:
            pass
    elif receipt and receipt.get("blockNumber"):
        try:
            block_number = int(receipt["blockNumber"], 16)
        except Exception:
            pass

    confirmations = max(0, current_block - block_number) if block_number else 0

    # Determine status
    if receipt_status == "0":
        status = "failed"
    elif receipt_status == "1" or (block_number and confirmations >= 0):
        status = "confirmed"
    else:
        status = "pending"

    gas_used = None
    if receipt and receipt.get("gasUsed"):
        try:
            gas_used = int(receipt["gasUsed"], 16)
        except Exception:
            pass

    return {
        "status": status,
        "confirmations": confirmations,
        "block_number": block_number,
        "timestamp": None,
        "from": tx["from"] if tx else None,
        "to": tx.get("to") if tx else None,
        "value": int(tx["value"], 16) / 1e18 if tx and tx.get("value") else 0.0,
        "gas_used": gas_used,
        "fetched_at": datetime.now().isoformat(),
    }

def get_tx_status(chain: str, tx_hash: str) -> Dict:
    # Cache check
    cql = f"SELECT * FROM transactions_by_hash WHERE tx_hash = '{tx_hash}';"
    rows = execute_query(chain, cql)
    if rows:
        row = dict(rows[0])
        if row.get('status') == 'confirmed' and row.get('confirmations', 0) > 0:
            return row

    # Fetch from Etherscan (ETH only for now)
    status_data = None
    if chain == 'eth':
        status_data = get_eth_tx_status(tx_hash)
    else:
        return {'error': f'Unsupported chain for status: {chain}'}

    if not status_data:
        return {'error': 'Failed to fetch from Etherscan – check API key'}

    # Cache (optional)
    try:
        update_cql = f"""
        INSERT INTO transactions_by_hash (tx_hash, status, confirmations, block_number, timestamp, from_address, to_address, value) 
        VALUES ('{tx_hash}', '{status_data['status']}', {status_data['confirmations']}, {status_data['block_number']}, '{status_data['timestamp']}', 
                '{status_data['from']}', '{status_data['to']}', {status_data['value']});
        """
        execute_query(chain, update_cql)
    except Exception as e:
        print(f"Cache failed (optional): {e}")

    return status_data