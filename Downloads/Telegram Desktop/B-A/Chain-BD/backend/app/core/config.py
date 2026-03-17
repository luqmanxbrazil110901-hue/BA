from pydantic_settings import BaseSettings
from typing import List
from dotenv import load_dotenv
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(ENV_FILE)

class Settings(BaseSettings):
    scylla_hosts: str = "scylla-db"
    scylla_port: int = 9042
    scylla_username: str = ""
    scylla_password: str = ""
    etherscan_api_key: str = ""
    my_node_rpc_urls: str = ""
    prefer_node: bool = False
    app_host: str = "0.0.0.0"
    app_port: int = 8001
    debug: bool = True
    supported_chains: List[str] = ["eth", "bnb", "arb", "op", "base", "polygon", "avax", "xlayer", "solana", "btc"]

    class Config:
        env_file = str(ENV_FILE)

settings = Settings()