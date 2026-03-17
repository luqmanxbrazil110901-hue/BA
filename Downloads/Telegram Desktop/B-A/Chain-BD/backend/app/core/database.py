from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
from cassandra.policies import DCAwareRoundRobinPolicy
from app.core.config import settings

_session = None
_cluster = None

def get_scylla_session():
    global _session, _cluster
    if _session is None:
        try:
            auth_provider = PlainTextAuthProvider(settings.scylla_username, settings.scylla_password) if settings.scylla_username else None
            _cluster = Cluster(
                contact_points=settings.scylla_hosts.split(','),
                port=settings.scylla_port,
                auth_provider=auth_provider,
                load_balancing_policy=DCAwareRoundRobinPolicy(),
                connect_timeout=10,
            )
            _session = _cluster.connect()
            print("ScyllaDB connected successfully!")
        except Exception as e:
            print(f"ScyllaDB connect failed (lazy): {e}. Retrying on query.")
            _session = None
    return _session

def close_scylla():
    global _cluster
    if _cluster:
        _cluster.shutdown()

def execute_query(chain: str, cql: str):
    session = get_scylla_session()
    if session is None:
        print("No Scylla session – skipping query")
        return []  # Empty for now
    keyspace = f"chain_bd_{chain}"
    try:
        session.execute(f"USE {keyspace};")
        return list(session.execute(cql))
    except Exception as e:
        raise ValueError(f"Query failed for {keyspace}: {str(e)}")