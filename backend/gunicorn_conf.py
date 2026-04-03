# backend/gunicorn_conf.py
import multiprocessing
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# Workers: default is capped so we do not open (workers × pool) DB connections
# beyond Postgres max_connections (~100). Override with WEB_CONCURRENCY for bare metal.
_cpu = multiprocessing.cpu_count()
_workers_uncapped = (_cpu * 2) + 1
_workers_default = min(_workers_uncapped, 4)
workers = int(os.getenv("WEB_CONCURRENCY", str(_workers_default)))
worker_class = "uvicorn.workers.UvicornWorker"

# Timeout and keepalive
timeout = 120
keepalive = 5

# Logging
loglevel = os.getenv("LOG_LEVEL", "info")
accesslog = "-"
errorlog = "-"

# False: each worker imports the app and owns a fresh DB pool (safe with async SQLAlchemy).
# True + fork duplicates the parent's pool state and can multiply stray connections.
preload_app = False
