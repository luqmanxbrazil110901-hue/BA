from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.core.config import settings
from app.core.database import close_scylla
from app.routers import wallets, transactions, stats

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lazy init – no startup connect
    yield
    close_scylla()

app = FastAPI(
    title="Chain-BD API",
    version="1.0.0",
    description="Blockchain Analytics Backend with Etherscan Integration",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For frontend at localhost:3000
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wallets.router, prefix="/api", tags=["wallets"])
app.include_router(transactions.router, prefix="/api", tags=["transactions"])
app.include_router(stats.router, prefix="/api", tags=["stats"])

@app.get("/health")
def health():
    return {"status": "healthy", "etherscan_enabled": bool(settings.etherscan_api_key)}

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug
    )