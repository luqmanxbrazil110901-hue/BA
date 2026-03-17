from fastapi import APIRouter, Path, HTTPException
from typing import List
from app.models import Transaction, TxStatus
from app.core.database import execute_query
from app.utils.bucketing import get_address_bucket, get_week_bucket
from app.utils.tx_status import get_tx_status

router = APIRouter()

def get_wallet_txs_internal(chain: str, address: str, limit: int):
    bucket = get_address_bucket(address)
    week = get_week_bucket()
    cql = f"""
    SELECT tx_hash, block_number, from_address, to_address, value, timestamp 
    FROM transactions_by_address 
    WHERE address_bucket = {bucket} AND address = '{address}' AND week = '{week}' 
    LIMIT {limit};
    """
    return execute_query(chain, cql)

@router.get("/{chain}/wallets/{address}/txs", response_model=List[Transaction])
def get_wallet_txs(chain: str, address: str = Path(...), limit: int = 10):
    if limit > 100:
        raise HTTPException(400, "Limit too high")
    rows = get_wallet_txs_internal(chain, address, limit)
    return [Transaction(**dict(row)) for row in rows]

@router.get("/{chain}/txs/{tx_hash}", response_model=Transaction)
def get_tx(chain: str, tx_hash: str = Path(...)):
    cql = f"SELECT * FROM transactions_by_hash WHERE tx_hash = '{tx_hash}';"
    rows = execute_query(chain, cql)
    if not rows:
        raise HTTPException(404, "TX not found")
    return Transaction(**dict(rows[0]))

@router.get("/{chain}/txs/{tx_hash}/status", response_model=TxStatus)
def get_tx_status_endpoint(chain: str, tx_hash: str = Path(...)):
    tx_hash = tx_hash.strip()
    if len(tx_hash) < 60:
        raise HTTPException(400, "Invalid tx hash")
    data = get_tx_status(chain, tx_hash)
    if 'error' in data:
        raise HTTPException(400, data['error'])
    data['from_address'] = data.pop('from', None)
    data['to_address'] = data.pop('to', None)
    data.pop('fetched_at', None)
    return TxStatus(**data)