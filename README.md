# 🌍 GlobeNews

A real-time 3D globe that plots live news events as interactive pins — built with Python, Flask, and CesiumJS.

---

## What it does

- Renders a photorealistic 3D Earth (Google Earth style) in the browser
- Fetches live headlines from NewsAPI and GNews, extracts geographic locations using spaCy NLP, and places a coloured pin on the globe for each story
- Hover over a pin to see a headline preview; click to fly the camera to that location and read the full summary
- Pins auto-refresh every 15 minutes in the background without any page reload
- Filter events by category: Politics, Technology, Business, Science, Health, Sports, Arts

---

## Requirements

- Python 3.10 or higher
- A free [NewsAPI key](https://newsapi.org/register)
- A free [Cesium Ion token](https://ion.cesium.com/tokens) (for satellite imagery)
- A free [GNews key](https://gnews.io) *(optional — adds more sources)*

---

## Setup

**1. Create and activate a virtual environment**

```bash
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

**2. Install dependencies**

```bash
pip install -r requirements.txt
```

**3. Download the spaCy language model**

```bash
python -m spacy download en_core_web_sm
```

**4. Add your API keys**

Open the `.env` file (already included) and fill in your keys:

```env
CESIUM_ION_TOKEN=your_token_here
NEWSAPI_KEY=your_key_here
GNEWS_KEY=your_key_here        # optional
PORT=5050
NEWS_REFRESH_INTERVAL=900
```

**5. Run**

```bash
python app.py
```

The browser opens automatically at `http://localhost:5050`. The first news fetch takes 1–3 minutes while spaCy geocodes article locations — this is normal.

---

## Controls

| Action | Result |
|--------|--------|
| Left-click + drag | Rotate the globe |
| Right-click + drag | Tilt the camera |
| Scroll wheel | Zoom in / out |
| Hover over a pin | Preview headline and summary |
| Click a pin | Fly to location, open article panel |
| Click category chips | Filter pins by topic |
| Click the ⟳ ring (bottom right) | Force an immediate news refresh |
| Click "Read Full Article" | Opens source URL in a new tab |

---

## Project structure

```
globe_news/
├── app.py              # Flask server and REST API endpoints
├── news_fetcher.py     # News fetching, NLP geocoding, deduplication
├── requirements.txt    # Python dependencies
├── .env                # Your API keys (never commit this)
├── .env.example        # Template for sharing / version control
└── templates/
    └── index.html      # CesiumJS globe, UI, and all frontend logic
```

---

## API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the globe interface |
| `/api/news` | GET | Returns cached article list as JSON |
| `/api/refresh` | POST | Triggers an immediate news fetch |
| `/api/status` | GET | Returns cache metadata and next refresh time |

`/api/news` accepts optional query params: `?limit=100` and `?category=technology`

---

## Configuration

All settings live in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `CESIUM_ION_TOKEN` | — | Enables photorealistic satellite imagery |
| `NEWSAPI_KEY` | — | Primary news source |
| `GNEWS_KEY` | — | Secondary news source (optional) |
| `PORT` | `5050` | Port Flask listens on |
| `NEWS_REFRESH_INTERVAL` | `900` | Seconds between background refreshes |

Without a `NEWSAPI_KEY` the app runs with 15 built-in demo articles so you can verify the globe works before adding keys.

---

## How geocoding works

Each article goes through a three-stage pipeline to get coordinates:

1. **spaCy NER** — extracts place names (cities, countries, regions) from the headline and summary
2. **Nominatim** — geocodes the best candidate via OpenStreetMap (free, no key required, rate-limited to 1 req/s)
3. **Country centroid fallback** — if NER finds nothing, falls back to the article's source country coordinates

Articles that resolve to the same location and share similar keywords are merged into a single pin to avoid clutter.

---

## Troubleshooting

**Globe shows stars but no Earth** — Restart the server. If it persists, check the browser console (F12) for a Cesium error and make sure your Cesium Ion token is correct.

**No pins / "0 events"** — Your `NEWSAPI_KEY` is missing or invalid. Check your `.env` file is saved in the `globe_news/` folder (same directory as `app.py`).

**First run is very slow** — Normal. Nominatim requires a 1-second delay between geocoding requests. ~200 articles takes 3–5 minutes. Results are cached so subsequent refreshes are fast.

**Port already in use** — Change `PORT=5050` to any other number in `.env`.

**`TemplateNotFound: index.html`** — You are running `python app.py` from the wrong directory. Run it from inside the `globe_news/` folder.

---

*Built with Python · Flask · CesiumJS · spaCy · geopy · NewsAPI · GNews*