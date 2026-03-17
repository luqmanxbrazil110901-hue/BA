import os
import requests
from typing import List, Dict
from .xgboost_learner import classify_with_ai  # AI integration

def classify_wallet_hardcoded(row: Dict) -> Dict:
    """Hardcoded rules for initial labeling (fallback for AI)."""
    tx_count = row.get('tx_count', 0)
    risk = row.get('risk_score', 0.0)
    tags = list(row.get('tags', []))
    value_in = row.get('total_value_in', 0)
    avg_value = value_in / max(1, tx_count) if tx_count > 0 else 0
    tag_count = len(tags)

    # Hardcoded rules
    if any(tag in ['binance', 'coinbase', 'kraken', 'hot_wallet'] for tag in tags) or tx_count > 5000:
        reason = "High tx or exchange tag"
        conf = 0.95
        typ = "exchange"
    elif tx_count > 500 and risk > 0.6:  # High frequency + risk = bot
        reason = "High tx count + risk (automated/script)"
        conf = 0.85
        typ = "bot"
    elif any(tag in ['bridge', 'wormhole', 'hop', 'layerzero'] for tag in tags) or tag_count > 2:
        reason = "Bridge tags or many tags (cross-chain)"
        conf = 0.9
        typ = "bridge"
    elif tx_count < 50 and avg_value < 1.0:  # Low activity = real user
        reason = "Low tx/volume (organic personal)"
        conf = 0.8
        typ = "real_user"
    else:
        reason = "No strong signals (unknown)"
        conf = 0.5
        typ = "unknown"

    return {
        "type": typ,
        "confidence": conf,
        "reason": reason,
        "tags": tags,
        "features_used": {
            "tx_count": tx_count,
            "risk_score": risk,
            "tag_count": tag_count,
            "avg_value": avg_value
        }
    }

def get_external_label(chain: str, address: str) -> str:
    """External enrich with Etherscan for ETH (labels, balance if needed)."""
    if chain != 'eth' or not os.getenv('ETHERSCAN_API_KEY'):
        return ""
    
    # Etherscan API for label/enrich (balance as extra feature)
    url = f"https://api.etherscan.io/api?module=account&action=balance&address={address}&tag=latest&apikey={os.getenv('ETHERSCAN_API_KEY')}"
    try:
        resp = requests.get(url, timeout=5)
        data = resp.json()
        if data['status'] == '1':
            balance = int(data['result']) / 1e18  # ETH balance
            # Hardcoded label logic (expand with full label API)
            if balance > 1000:  # High balance = whale/exchange
                return "exchange"
            # Add more (e.g., tx count from another API call)
    except Exception as e:
        print(f"Etherscan enrich error: {e}")
    return ""

def classify_wallet_type(row: Dict) -> Dict:
    """Main: AI first, hardcoded fallback, Etherscan enrich."""
    row['chain'] = row.get('chain', 'eth')
    row['address'] = row.get('address', '')
    
    # Try AI (XGBoost)
    try:
        classification = classify_with_ai(row)
    except Exception as e:
        print(f"AI classify error (fallback hardcoded): {e}")
        classification = classify_wallet_hardcoded(row)
    
    # Enrich with Etherscan
    external = get_external_label(row['chain'], row['address'])
    if external:
        classification['type'] = external
        classification['tags'].append(f"external:{external}")
        classification['confidence'] = max(classification.get('confidence', 0.7), 0.9)
        classification['reason'] = classification.get('reason', '') + f" + Etherscan: {external}"
    
    return classification