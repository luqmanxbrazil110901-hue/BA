import xgboost as xgb
import pandas as pd
import joblib
import os
from typing import Dict, List
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.preprocessing import LabelEncoder
from datetime import datetime
import requests  # For Etherscan features

MODEL_PATH = "wallet_ai_model.pkl"    # Saved model
ENCODER_PATH = "wallet_ai_encoder.pkl"  # LabelEncoder
LOG_PATH = "wallet_learning_log.csv"  # Logs for learning (predictions + corrections)
FEATURES = ['tx_count', 'risk_score', 'tag_count', 'avg_value', 'balance_eth']  # Input features
LABELS = ['bot', 'real_user', 'exchange', 'bridge', 'unknown']  # Output classes

# Initial sample data – diverse, realistic wallet patterns for all 5 classes
INITIAL_SAMPLES = pd.DataFrame({
    # ── exchange (high balance + high volume) ─────────────────────────────
    'tx_count':   [80000, 50000, 12000, 9000,  6000,  8500,  15000, 22000,
    # ── bot (high freq + medium risk) ─────────────────────────────────────
                   600,   800,   1200,  2500,  450,   900,   3000,  700,
    # ── bridge (cross-chain, tag-heavy) ───────────────────────────────────
                   120,   200,   80,    350,   60,    180,   400,   250,
    # ── real_user (low freq, organic) ─────────────────────────────────────
                   5,     12,    25,    3,     18,    8,     30,    15,    40,  2,
    # ── unknown (no clear signal) ─────────────────────────────────────────
                   100,   60,    200,   90,    150,   70],
    'risk_score': [0.9,   0.85,  0.7,   0.65,  0.7,   0.6,   0.75,  0.8,
                   0.85,  0.9,   0.8,   0.88,  0.75,  0.82,  0.92,  0.78,
                   0.4,   0.35,  0.3,   0.45,  0.25,  0.4,   0.5,   0.38,
                   0.1,   0.15,  0.2,   0.05,  0.18,  0.12,  0.22,  0.08,  0.25, 0.1,
                   0.5,   0.45,  0.55,  0.48,  0.52,  0.42],
    'tag_count':  [5,     4,     3,     3,     2,     2,     4,     3,
                   2,     3,     2,     4,     1,     3,     4,     2,
                   4,     5,     3,     4,     2,     5,     4,     3,
                   0,     0,     1,     0,     0,     0,     1,     0,     0,  0,
                   0,     1,     0,     1,     0,     0],
    'avg_value':  [500.,  300.,  150.,  120.,  80.,   90.,   200.,  250.,
                   50.,   80.,   60.,   100.,  40.,   70.,   120.,  55.,
                   30.,   25.,   20.,   35.,   15.,   28.,   40.,   32.,
                   0.3,   0.8,   1.5,   0.1,   1.0,   0.5,   2.0,   0.4,   3.0, 0.2,
                   5.,    3.,    8.,    4.,    6.,    2.],
    'balance_eth':[20000.,15000.,3000., 2500., 1200., 1800., 5000., 8000.,
                   50.,   80.,   120.,  200.,  30.,   90.,   300.,  60.,
                   80.,   150.,  60.,   200.,  40.,   120.,  250.,  100.,
                   1.2,   2.5,   4.0,   0.5,   3.0,   1.8,   5.0,   0.8,   6.0, 0.3,
                   15.,   8.,    25.,   10.,   20.,   5.],
    'label':      ['exchange','exchange','exchange','exchange','exchange','exchange','exchange','exchange',
                   'bot','bot','bot','bot','bot','bot','bot','bot',
                   'bridge','bridge','bridge','bridge','bridge','bridge','bridge','bridge',
                   'real_user','real_user','real_user','real_user','real_user','real_user','real_user','real_user','real_user','real_user',
                   'unknown','unknown','unknown','unknown','unknown','unknown']
})

def get_etherscan_balance(address: str) -> float:
    """Fetch live balance from Etherscan as AI feature."""
    api_key = os.getenv('ETHERSCAN_API_KEY', '')
    if not api_key or not address.startswith('0x'):
        return 0.0
    url = f"https://api.etherscan.io/api?module=account&action=balance&address={address}&tag=latest&apikey={api_key}"
    try:
        resp = requests.get(url, timeout=5)
        data = resp.json()
        if data['status'] == '1':
            return int(data['result']) / 1e18  # ETH
    except Exception as e:
        print(f"Etherscan balance fetch error: {e}")
    return 0.0

def train_xgboost_model():
    """Train/load model – learns from initial + log/corrections."""
    if os.path.exists(MODEL_PATH) and os.path.exists(ENCODER_PATH):
        model = joblib.load(MODEL_PATH)
        le = joblib.load(ENCODER_PATH)
        print("XGBoost model loaded from previous learning!")
        return model, le

    # Load data
    df = INITIAL_SAMPLES.copy()
    if os.path.exists(LOG_PATH):
        try:
            log_df = pd.read_csv(LOG_PATH)
            df = pd.concat([df, log_df[FEATURES + ['label']]], ignore_index=True)
            print(f"Re-training with {len(log_df)} logged samples/corrections.")
        except Exception as e:
            print(f"Log load error: {e} – using initial data.")

    if len(df) < 5:
        print("Warning: Low data – using initial samples only.")

    # Encode string labels to integers
    le = LabelEncoder()
    le.fit(LABELS)  # Fit on all known classes so encoding is stable
    df['label_enc'] = le.transform(df['label'])

    X = df[FEATURES]
    y = df['label_enc']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBClassifier(
        objective='multi:softprob',
        num_class=len(LABELS),
        eval_metric='mlogloss',
        max_depth=3,
        n_estimators=100,
        learning_rate=0.1,
        random_state=42,
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"AI Model Accuracy: {acc:.2f} on {len(df)} samples – getting smarter!")

    joblib.dump(model, MODEL_PATH)
    joblib.dump(le, ENCODER_PATH)
    print("XGBoost model trained and saved – ready for predictions!")
    return model, le

def predict_with_xgboost(row: Dict, address: str, chain: str = 'eth') -> Dict:
    """AI Prediction – uses features + Etherscan balance."""
    model, le = train_xgboost_model()  # Train/load (learns automatically)

    # Extract features from DB row
    features = {
        'tx_count': row.get('tx_count', 0),
        'risk_score': row.get('risk_score', 0.0),
        'tag_count': len(row.get('tags', [])),
        'avg_value': row.get('total_value_in', 0) / max(1, row.get('tx_count', 1)),
        'balance_eth': get_etherscan_balance(address) if chain == 'eth' else 0.0
    }

    # Predict (model outputs integer, decode back to string label)
    df = pd.DataFrame([features])
    probs = model.predict_proba(df)[0]
    pred_idx = int(model.predict(df)[0])
    pred_label = le.inverse_transform([pred_idx])[0]
    confidence = float(probs[pred_idx])

    # Log for learning (features + pred – correction will override)
    log_entry = features.copy()
    log_entry['predicted_label'] = pred_label
    log_entry['confidence'] = confidence
    log_entry['timestamp'] = datetime.now().isoformat()
    log_entry['address'] = address
    log_entry['chain'] = chain
    with open(LOG_PATH, 'a') as f:
        if os.path.getsize(LOG_PATH) == 0:
            pd.DataFrame([log_entry]).to_csv(f, index=False)
        else:
            pd.DataFrame([log_entry]).to_csv(f, mode='a', header=False, index=False)

    print(f"AI Predicted: {pred_label} for {address} (conf: {confidence:.2f}, balance: {features['balance_eth']:.2f} ETH)")

    return {
        "type": pred_label,
        "confidence": confidence,
        "probabilities": dict(zip(LABELS, probs)),  # All class chances
        "features_used": features,
        "reason": "XGBoost AI (learning from logs + corrections)",
        "balance_eth": features['balance_eth']  # Etherscan enrich
    }

def correct_label(address: str, chain: str, corrected_type: str, features: Dict = None):
    """User Correction – logs for AI to learn."""
    if features is None:
        features = {}  # Fetch from DB if needed

    correction = {
        'tx_count': features.get('tx_count', 0),
        'risk_score': features.get('risk_score', 0.0),
        'tag_count': features.get('tag_count', 0),
        'avg_value': features.get('avg_value', 0),
        'balance_eth': features.get('balance_eth', 0),
        'label': corrected_type,  # Corrected (for training)
        'predicted_label': corrected_type,  # Override pred
        'confidence': 1.0,  # User = full confidence
        'timestamp': datetime.now().isoformat(),
        'address': address,
        'chain': chain
    }

    with open(LOG_PATH, 'a') as f:
        if os.path.getsize(LOG_PATH) == 0:
            pd.DataFrame([correction]).to_csv(f, index=False)
        else:
            pd.DataFrame([correction]).to_csv(f, mode='a', header=False, index=False)

    print(f"Correction logged for {address}: {corrected_type} – AI will learn on restart!")
    return {"message": "Correction saved – model smarter next time!"}

def classify_with_ai(row: Dict) -> Dict:
    """Main AI call – predicts and logs."""
    address = row.get('address', '')
    chain = row.get('chain', 'eth')
    return predict_with_xgboost(row, address, chain)