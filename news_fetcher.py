"""
============================================================
 news_fetcher.py  |  Async news retrieval + geocoding
============================================================
 Pulls headlines from NewsAPI (primary) and GNews (fallback),
 extracts geographic coordinates from article text/metadata
 using spaCy NER + Nominatim geocoding, deduplicates events
 that refer to the same location, and returns a clean list
 of pin-ready dicts for the globe frontend.
============================================================
"""

import re
import time
import hashlib
import logging
import asyncio
import threading
from datetime import datetime, timezone
from typing import Optional
from math import radians, sin, cos, sqrt, atan2

import requests
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable

log = logging.getLogger("GlobeNews.Fetcher")

# ── Category colour mapping (used by the frontend) ──────
CATEGORY_COLORS = {
    "politics":      "#E74C3C",
    "business":      "#3498DB",
    "technology":    "#9B59B6",
    "science":       "#27AE60",
    "health":        "#E67E22",
    "sports":        "#F39C12",
    "entertainment": "#1ABC9C",
    "world":         "#E74C3C",
    "general":       "#95A5A6",
}

# ── Country-code → (lat, lon) look-up table ─────────────
# Used as a fallback when NER geocoding fails.
COUNTRY_COORDS: dict[str, tuple[float, float]] = {
    "ae": (23.4241,  53.8478), "af": (33.9391,  67.7100),
    "ar": (-38.4161,-63.6167), "at": (47.5162,  14.5501),
    "au": (-25.2744, 133.7751),"be": (50.5039,   4.4699),
    "bg": (42.7339,  25.4858), "br": (-14.2350, -51.9253),
    "ca": (56.1304, -106.3468),"ch": (46.8182,   8.2275),
    "cn": (35.8617,  104.1954),"co": (4.5709,  -74.2973),
    "cu": (21.5218,  -77.7812),"cz": (49.8175,  15.4730),
    "de": (51.1657,  10.4515), "eg": (26.8206,  30.8025),
    "fr": (46.2276,   2.2137), "gb": (55.3781,  -3.4360),
    "gr": (39.0742,  21.8243), "hk": (22.3193, 114.1694),
    "hu": (47.1625,  19.5033), "id": (-0.7893, 113.9213),
    "ie": (53.1424,  -7.6921), "il": (31.0461,  34.8516),
    "in": (20.5937,  78.9629), "it": (41.8719,  12.5674),
    "jp": (36.2048, 138.2529), "kr": (35.9078, 127.7669),
    "lt": (55.1694,  23.8813), "lv": (56.8796,  24.6032),
    "ma": (31.7917,  -7.0926), "mx": (23.6345, -102.5528),
    "my": (4.2105,  101.9758), "ng": (9.0820,   8.6753),
    "nl": (52.1326,   5.2913), "no": (60.4720,   8.4689),
    "nz": (-40.9006, 174.8860),"ph": (12.8797, 121.7740),
    "pl": (51.9194,  19.1451), "pt": (39.3999,  -8.2245),
    "ro": (45.9432,  24.9668), "rs": (44.0165,  21.0059),
    "ru": (61.5240, 105.3188), "sa": (23.8859,  45.0792),
    "se": (60.1282,  18.6435), "sg": (1.3521,  103.8198),
    "si": (46.1512,  14.9955), "sk": (48.6690,  19.6990),
    "th": (15.8700, 100.9925), "tr": (38.9637,  35.2433),
    "tw": (23.6978, 120.9605), "ua": (48.3794,  31.1656),
    "us": (37.0902, -95.7129), "ve": (6.4238,  -66.5897),
    "za": (-30.5595,  22.9375),"zw": (-19.0154,  29.1549),
}


class NewsFetcher:
    """
    Fetches geolocalized news from multiple sources,
    extracts coordinates, and deduplicates nearby events.
    """

    def __init__(
        self,
        newsapi_key: str = "",
        gnews_key: str = "",
        geocoding_delay: float = 1.2,
        dedup_radius_km: float = 80.0,
    ):
        self.newsapi_key     = newsapi_key
        self.gnews_key       = gnews_key
        self.geocoding_delay = geocoding_delay   # seconds between Nominatim calls
        self.dedup_radius_km = dedup_radius_km   # merge pins closer than this

        # Nominatim geocoder (free, no API key)
        self._geocoder = Nominatim(
            user_agent="globe-news-app/1.0",
            timeout=8,
        )
        # Simple in-memory geocode cache to avoid hammering Nominatim
        self._geo_cache: dict[str, Optional[tuple[float, float]]] = {}

        # Try to import spaCy NER model (optional but greatly improves geocoding)
        self._nlp = None
        try:
            import spacy
            self._nlp = spacy.load("en_core_web_sm")
            log.info("✅  spaCy NER loaded — location extraction enabled")
        except Exception:
            log.warning("⚠️  spaCy not available — falling back to source-country coords")


    # ══════════════════════════════════════════════════════
    #  Public API
    # ══════════════════════════════════════════════════════

    def fetch_all(self) -> list[dict]:
        """
        Fetch from all configured sources, geocode, deduplicate,
        and return a clean list of article dicts ready for the globe.
        """
        raw: list[dict] = []

        if self.newsapi_key:
            raw.extend(self._fetch_newsapi())
        else:
            log.warning("No NEWSAPI_KEY — using demo/sample data")
            raw.extend(self._demo_articles())

        if self.gnews_key:
            raw.extend(self._fetch_gnews())

        log.info(f"  Raw articles fetched: {len(raw)}")

        # Geocode each article (adds lat/lon)
        geocoded = self._geocode_articles(raw)

        # Keep only articles that could be placed on the globe
        placed = [a for a in geocoded if a.get("lat") and a.get("lon")]
        log.info(f"  Articles with coordinates: {len(placed)}")

        # Cluster/deduplicate nearby pins about the same story
        deduped = self._deduplicate(placed)
        log.info(f"  After deduplication: {len(deduped)}")

        return deduped


    # ══════════════════════════════════════════════════════
    #  Data sources
    # ══════════════════════════════════════════════════════

    def _fetch_newsapi(self) -> list[dict]:
        """Pull top headlines + world news from NewsAPI.org."""
        articles: list[dict] = []
        categories = ["general", "business", "technology", "science",
                      "health", "sports", "entertainment"]
        countries  = ["us", "gb", "de", "fr", "in", "jp", "au",
                      "ca", "br", "cn", "ru", "za"]

        session = requests.Session()
        session.headers["User-Agent"] = "GlobeNews/1.0"

        # ── Top headlines by country/category ──
        for country in countries:
            try:
                resp = session.get(
                    "https://newsapi.org/v2/top-headlines",
                    params={
                        "country":  country,
                        "pageSize": 15,
                        "apiKey":   self.newsapi_key,
                    },
                    timeout=10,
                )
                if resp.status_code == 200:
                    for item in resp.json().get("articles", []):
                        art = self._normalize_newsapi(item, country=country)
                        if art:
                            articles.append(art)
            except requests.RequestException as e:
                log.warning(f"  NewsAPI country {country}: {e}")

        # ── World / international everything ──
        try:
            resp = session.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q":        "world OR international OR global",
                    "language": "en",
                    "sortBy":   "publishedAt",
                    "pageSize": 50,
                    "apiKey":   self.newsapi_key,
                },
                timeout=10,
            )
            if resp.status_code == 200:
                for item in resp.json().get("articles", []):
                    art = self._normalize_newsapi(item)
                    if art:
                        articles.append(art)
        except requests.RequestException as e:
            log.warning(f"  NewsAPI everything: {e}")

        log.info(f"  NewsAPI returned {len(articles)} articles")
        return articles


    def _fetch_gnews(self) -> list[dict]:
        """Pull headlines from GNews API (secondary source)."""
        articles: list[dict] = []
        try:
            resp = requests.get(
                "https://gnews.io/api/v4/top-headlines",
                params={
                    "token":    self.gnews_key,
                    "lang":     "en",
                    "max":      100,
                    "topic":    "world",
                },
                timeout=10,
            )
            if resp.status_code == 200:
                for item in resp.json().get("articles", []):
                    art = self._normalize_gnews(item)
                    if art:
                        articles.append(art)
        except requests.RequestException as e:
            log.warning(f"  GNews: {e}")

        log.info(f"  GNews returned {len(articles)} articles")
        return articles


    # ══════════════════════════════════════════════════════
    #  Normalizers
    # ══════════════════════════════════════════════════════

    def _normalize_newsapi(self, item: dict, country: str = "") -> Optional[dict]:
        title = (item.get("title") or "").strip()
        if not title or title == "[Removed]":
            return None
        src   = item.get("source", {})
        desc  = (item.get("description") or "").strip()
        url   = item.get("url") or ""
        pub   = item.get("publishedAt") or ""
        img   = item.get("urlToImage") or ""

        return {
            "id":           _article_id(title),
            "title":        title,
            "summary":      desc[:300] if desc else title,
            "url":          url,
            "source":       src.get("name", ""),
            "image":        img,
            "country":      country,
            "category":     "general",
            "published_ts": _parse_ts(pub),
            "lat":          None,
            "lon":          None,
        }


    def _normalize_gnews(self, item: dict) -> Optional[dict]:
        title = (item.get("title") or "").strip()
        if not title:
            return None
        src   = item.get("source", {})
        desc  = (item.get("description") or "").strip()

        return {
            "id":           _article_id(title),
            "title":        title,
            "summary":      desc[:300] if desc else title,
            "url":          item.get("url") or "",
            "source":       src.get("name", ""),
            "image":        item.get("image") or "",
            "country":      "",
            "category":     "world",
            "published_ts": _parse_ts(item.get("publishedAt") or ""),
            "lat":          None,
            "lon":          None,
        }


    # ══════════════════════════════════════════════════════
    #  Geocoding pipeline
    # ══════════════════════════════════════════════════════

    def _geocode_articles(self, articles: list[dict]) -> list[dict]:
        """
        Attach lat/lon to each article using a multi-stage pipeline:
          1. spaCy NER → extract named locations from title+summary
          2. Nominatim geocode the best candidate
          3. Fall back to the article's source country centroid
        """
        result = []
        seen_ids: set[str] = set()

        for art in articles:
            # Skip true duplicates (same headline from different pulls)
            if art["id"] in seen_ids:
                continue
            seen_ids.add(art["id"])

            lat, lon = self._extract_coords(art)
            art["lat"] = lat
            art["lon"] = lon
            art["color"] = CATEGORY_COLORS.get(art.get("category", ""), "#95A5A6")
            result.append(art)

        return result


    def _extract_coords(self, art: dict) -> tuple[Optional[float], Optional[float]]:
        """
        Try multiple strategies to get (lat, lon) for one article.
        Returns (None, None) if all strategies fail.
        """
        text = f"{art['title']} {art.get('summary', '')}"

        # Strategy 1 — spaCy NER
        if self._nlp:
            locations = self._ner_locations(text)
            for loc in locations:
                coords = self._geocode(loc)
                if coords:
                    return coords

        # Strategy 2 — country centroid
        country = art.get("country", "").lower()
        if country in COUNTRY_COORDS:
            # Jitter slightly so pins from the same country don't stack
            base_lat, base_lon = COUNTRY_COORDS[country]
            import random
            return (
                base_lat + random.uniform(-2.5, 2.5),
                base_lon + random.uniform(-2.5, 2.5),
            )

        # Strategy 3 — guess from source domain
        src = art.get("source", "").lower()
        for cc, coords in COUNTRY_COORDS.items():
            if cc in src:
                return coords

        return (None, None)


    def _ner_locations(self, text: str) -> list[str]:
        """
        Run spaCy NER on text and return GPE/LOC entity strings,
        most specific first (shortest to longest, cities before countries).
        """
        if not self._nlp:
            return []
        doc = self._nlp(text[:512])   # limit for speed
        locs = [
            ent.text.strip()
            for ent in doc.ents
            if ent.label_ in ("GPE", "LOC", "FAC")
               and len(ent.text.strip()) > 2
        ]
        # Deduplicate while preserving order
        seen: set[str] = set()
        unique: list[str] = []
        for loc in locs:
            if loc.lower() not in seen:
                seen.add(loc.lower())
                unique.append(loc)
        return unique


    def _geocode(self, query: str) -> Optional[tuple[float, float]]:
        """
        Geocode a location string → (lat, lon), with caching
        and rate-limiting to respect Nominatim's ToS.
        """
        key = query.lower().strip()
        if key in self._geo_cache:
            return self._geo_cache[key]

        try:
            time.sleep(self.geocoding_delay)   # rate limit
            location = self._geocoder.geocode(query, exactly_one=True)
            if location:
                coords = (location.latitude, location.longitude)
                self._geo_cache[key] = coords
                return coords
            else:
                self._geo_cache[key] = None
        except (GeocoderTimedOut, GeocoderUnavailable) as e:
            log.debug(f"  Geocode error '{query}': {e}")
            self._geo_cache[key] = None

        return None


    # ══════════════════════════════════════════════════════
    #  Deduplication
    # ══════════════════════════════════════════════════════

    def _deduplicate(self, articles: list[dict]) -> list[dict]:
        """
        Cluster articles by geographic proximity and keep only
        the most recent / most complete article per cluster.
        Articles within `dedup_radius_km` of each other and
        sharing similar keywords are merged into one pin.
        """
        clusters: list[list[dict]] = []

        for art in articles:
            placed = False
            for cluster in clusters:
                rep = cluster[0]   # representative of the cluster
                if (
                    _haversine(art["lat"], art["lon"], rep["lat"], rep["lon"])
                    < self.dedup_radius_km
                    and _headline_similarity(art["title"], rep["title"]) > 0.25
                ):
                    cluster.append(art)
                    placed = True
                    break
            if not placed:
                clusters.append([art])

        result: list[dict] = []
        for cluster in clusters:
            # Pick the most detailed article as the pin representative
            best = max(cluster, key=lambda a: len(a.get("summary", "")))
            # Optionally surface count of related articles
            best["related_count"] = len(cluster) - 1
            result.append(best)

        return result


    # ══════════════════════════════════════════════════════
    #  Demo data (when no API key is configured)
    # ══════════════════════════════════════════════════════

    def _demo_articles(self) -> list[dict]:
        """
        Hard-coded sample articles so the globe looks populated
        even without an API key. Good for first-run demos.
        """
        now = time.time()
        samples = [
            ("G7 Leaders Gather for Emergency Climate Summit in Berlin",
             "Finance ministers from the G7 nations convened in Berlin to discuss emergency measures…",
             "https://example.com/g7-climate", "Reuters", "de", "politics",
             52.52, 13.40),
            ("Tech Giants Face New Antitrust Probe in Brussels",
             "EU regulators have launched a fresh antitrust investigation into major American tech companies…",
             "https://example.com/eu-antitrust", "Bloomberg", "be", "technology",
             50.85, 4.35),
            ("Earthquake Strikes Southern Turkey, 5.8 Magnitude",
             "A moderate earthquake shook the southern Hatay province of Turkey early Tuesday…",
             "https://example.com/turkey-quake", "AP News", "tr", "general",
             36.20, 36.16),
            ("India's Mars Orbiter Completes 10-Year Mission",
             "ISRO's Mangalyaan spacecraft has officially completed its decade-long Mars orbit mission…",
             "https://example.com/india-mars", "The Hindu", "in", "science",
             28.61, 77.21),
            ("Amazon Fires Break Record in Brazilian Amazon",
             "Satellite data shows the highest number of fire hotspots in the Brazilian Amazon since 2007…",
             "https://example.com/amazon-fires", "BBC", "br", "science",
             -3.47, -62.21),
            ("South Korea Launches 6G Research Consortium",
             "Seoul announced a multi-billion dollar consortium to lead global 6G standardization efforts…",
             "https://example.com/korea-6g", "Korea Times", "kr", "technology",
             37.56, 126.97),
            ("Nigeria Holds Historic General Election",
             "Voters across Nigeria headed to the polls in what analysts describe as a pivotal election…",
             "https://example.com/nigeria-election", "Al Jazeera", "ng", "politics",
             9.05, 7.49),
            ("Sydney Opera House Celebrates 50th Anniversary",
             "Australia's most iconic building marks its golden jubilee with a week of free public events…",
             "https://example.com/sydney-opera", "Guardian Australia", "au", "entertainment",
             -33.86, 151.21),
            ("WHO Declares New Health Emergency in Central Africa",
             "The World Health Organization has declared a public health emergency following an Mpox outbreak…",
             "https://example.com/who-africa", "WHO", "cd", "health",
             -4.32, 15.32),
            ("New York Stock Exchange Hits All-Time High",
             "The Dow Jones Industrial Average surged past 42,000 points for the first time in history…",
             "https://example.com/nyse-ath", "CNBC", "us", "business",
             40.71, -74.01),
            ("Russia and China Sign Arctic Trade Pact",
             "Moscow and Beijing finalized a landmark agreement to develop shared Arctic shipping lanes…",
             "https://example.com/russia-china-arctic", "FT", "ru", "politics",
             55.75, 37.62),
            ("SpaceX Starship Completes First Orbital Flight",
             "Elon Musk's fully reusable Starship rocket completed its first successful orbital test flight…",
             "https://example.com/spacex-starship", "Space.com", "us", "technology",
             28.57, -80.65),
            ("Flooding Devastates Parts of Bangladesh",
             "Severe monsoon flooding has displaced over two million people in the low-lying Sylhet region…",
             "https://example.com/bangladesh-floods", "Reuters", "bd", "general",
             24.89, 91.87),
            ("Tokyo Opens World's Largest Floating Solar Farm",
             "Japan inaugurated a massive floating photovoltaic installation on Lake Yamakura outside Tokyo…",
             "https://example.com/japan-solar", "Nikkei", "jp", "science",
             35.68, 140.02),
            ("UNESCO Adds New Sites to World Heritage List",
             "The UN cultural body added 24 new natural and cultural sites to its prestigious World Heritage List…",
             "https://example.com/unesco-2024", "UNESCO", "fr", "general",
             48.85, 2.35),
        ]

        articles = []
        for i, (title, summary, url, source, country, cat, lat, lon) in enumerate(samples):
            articles.append({
                "id":           _article_id(title),
                "title":        title,
                "summary":      summary,
                "url":          url,
                "source":       source,
                "image":        "",
                "country":      country,
                "category":     cat,
                "published_ts": now - i * 1800,  # stagger by 30 min
                "lat":          lat,
                "lon":          lon,
                "color":        CATEGORY_COLORS.get(cat, "#95A5A6"),
                "related_count": 0,
            })
        return articles


# ══════════════════════════════════════════════════════════
#  Pure helper functions
# ══════════════════════════════════════════════════════════

def _article_id(title: str) -> str:
    """Stable 12-char hash of the article title."""
    return hashlib.md5(title.encode()).hexdigest()[:12]


def _parse_ts(iso: str) -> float:
    """Parse ISO-8601 timestamp → Unix timestamp float."""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return time.time()


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres between two points."""
    R = 6371.0
    φ1, φ2 = radians(lat1), radians(lat2)
    Δφ = radians(lat2 - lat1)
    Δλ = radians(lon2 - lon1)
    a = sin(Δφ / 2) ** 2 + cos(φ1) * cos(φ2) * sin(Δλ / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def _headline_similarity(a: str, b: str) -> float:
    """
    Very fast Jaccard similarity on headline word sets.
    Returns 0.0–1.0.
    """
    stop = {"the","a","an","in","on","at","of","and","or","to","for","is","are","was","were"}
    def words(s: str) -> set[str]:
        return {w.lower() for w in re.findall(r"\w+", s) if w.lower() not in stop}
    wa, wb = words(a), words(b)
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)