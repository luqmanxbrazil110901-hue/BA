# Chain-BD Backend

## Setup
1. copy .env.example .env
2. Fill ETHERSCAN_API_KEY
3. pip install -r requirements.txt
4. uvicorn app.main:app --reload --port 8001

## Docker
docker-compose -f docker-compose.backend.yml up -d

## Endpoints
- GET /health
- GET /api/{chain}/wallets/{address}
- GET /api/{chain}/txs/{tx_hash}/status  # Etherscan confirmation
- See full in /docs

## Init DB
Use ../scripts to apply schemas to scylla-db