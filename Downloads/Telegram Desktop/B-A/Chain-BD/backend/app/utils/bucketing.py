import hashlib
from datetime import datetime

NUM_BUCKETS = 1000

def get_address_bucket(address: str) -> int:
    return int(hashlib.sha256(address.lower().encode()).hexdigest(), 16) % NUM_BUCKETS

def get_week_bucket(dt: datetime = None) -> str:
    if dt is None:
        dt = datetime.now()
    return dt.strftime("%Y-W%W")

def get_day_bucket(dt: datetime = None) -> str:
    if dt is None:
        dt = datetime.now()
    return dt.strftime("%Y-%m-%d")