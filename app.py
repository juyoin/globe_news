"""
============================================================
 GlobeNews — Real-Time 3D Globe + Geolocalized News Feed
============================================================
 app.py  |  Flask backend server
 Serves the CesiumJS globe frontend and exposes REST
 endpoints that the frontend polls for news pins.
============================================================
"""

import os
import threading
import webbrowser
import time
import logging
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from dotenv import load_dotenv

# Load .env file BEFORE any os.getenv() calls
load_dotenv()

from news_fetcher import NewsFetcher

# ── Logging ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("GlobeNews")

# ── Flask app ────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # allow the browser to call /api/* from any origin

# ── Global news cache ────────────────────────────────────
_news_cache: list[dict] = []
_cache_lock = threading.Lock()
_last_fetch_ts: float = 0.0

# How often (seconds) the background thread refreshes news
NEWS_REFRESH_INTERVAL = int(os.getenv("NEWS_REFRESH_INTERVAL", "900"))  # 15 min

# ── News fetcher singleton ───────────────────────────────
fetcher = NewsFetcher(
    newsapi_key=os.getenv("NEWSAPI_KEY", ""),          # from .env or env var
    gnews_key=os.getenv("GNEWS_KEY", ""),              # optional second source
    geocoding_delay=1.2,                               # seconds between geocode calls
)


# ╔══════════════════════════════════════════════════════╗
# ║                   REST ENDPOINTS                     ║
# ╚══════════════════════════════════════════════════════╝

@app.route("/")
def index():
    """Serve the main globe page."""
    cesium_token = os.getenv("CESIUM_ION_TOKEN", "")
    return render_template(
        "index.html",
        cesium_token=cesium_token,
        refresh_interval=NEWS_REFRESH_INTERVAL,
    )


@app.route("/api/news")
def get_news():
    """
    Return the current cached list of geolocalized news articles.
    The frontend calls this endpoint on load and then every
    NEWS_REFRESH_INTERVAL seconds.

    Query params:
        limit   – max articles to return (default 200)
        category – filter by category (optional)
    """
    limit = int(request.args.get("limit", 200))
    category = request.args.get("category", "")

    with _cache_lock:
        articles = list(_news_cache)

    if category:
        articles = [a for a in articles if a.get("category", "").lower() == category.lower()]

    # Sort by priority (has coords first, then by recency)
    articles.sort(key=lambda a: (
        0 if (a.get("lat") is not None and a.get("lon") is not None) else 1,
        -a.get("published_ts", 0),
    ))

    return jsonify({
        "status": "ok",
        "count": len(articles[:limit]),
        "last_updated": _last_fetch_ts,
        "articles": articles[:limit],
    })


@app.route("/api/status")
def status():
    """Health-check + cache metadata."""
    with _cache_lock:
        count = len(_news_cache)
    return jsonify({
        "status": "ok",
        "cached_articles": count,
        "last_fetch": _last_fetch_ts,
        "next_fetch_in": max(0, NEWS_REFRESH_INTERVAL - (time.time() - _last_fetch_ts)),
    })


@app.route("/api/refresh", methods=["POST"])
def force_refresh():
    """Manually trigger a news refresh (useful for dev/testing)."""
    threading.Thread(target=_refresh_news, daemon=True).start()
    return jsonify({"status": "refresh triggered"})


# ╔══════════════════════════════════════════════════════╗
# ║               BACKGROUND NEWS THREAD                 ║
# ╚══════════════════════════════════════════════════════╝

def _refresh_news():
    """Fetch + geocode news and update the global cache."""
    global _last_fetch_ts
    log.info("⬇  Fetching news …")
    try:
        articles = fetcher.fetch_all()
        with _cache_lock:
            _news_cache.clear()
            _news_cache.extend(articles)
        _last_fetch_ts = time.time()
        log.info(f"✅  Cache updated — {len(articles)} articles with coordinates")
    except Exception as exc:
        log.error(f"❌  News fetch failed: {exc}")


def _background_loop():
    """Runs in a daemon thread; refreshes news on a fixed interval."""
    # Initial fetch immediately on startup
    _refresh_news()
    while True:
        time.sleep(NEWS_REFRESH_INTERVAL)
        _refresh_news()


# ╔══════════════════════════════════════════════════════╗
# ║                       MAIN                           ║
# ╚══════════════════════════════════════════════════════╝

def main():
    port = int(os.getenv("PORT", 5050))

    log.info("=" * 55)
    log.info("  🌍  GlobeNews starting …")
    log.info(f"  🔗  http://localhost:{port}")
    log.info("=" * 55)

    # Start background news thread
    bg = threading.Thread(target=_background_loop, daemon=True)
    bg.start()

    # Give the initial fetch a couple of seconds head-start
    # before the browser opens
    def _open_browser():
        time.sleep(2.5)
        webbrowser.open(f"http://localhost:{port}")

    threading.Thread(target=_open_browser, daemon=True).start()

    # Run Flask (use_reloader=False avoids double-starting the bg thread)
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()