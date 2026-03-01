# Globe News: Real-Time Geolocalized News Globe

This project is a Python + Streamlit application that renders an interactive, high-definition 3D-style globe and overlays live news markers from NewsAPI.

## Features

- **Interactive globe navigation** (drag to rotate, mouse wheel to zoom, pan support).
- **Asynchronous news ingestion** using `asyncio` + `requests`.
- **Geolocalized markers** with latitude/longitude mapped per selected country.
- **Automatic refresh** every X minutes (configurable in sidebar).
- **Hover previews** with headline, source, and short summary.
- **Click workflow** where selecting a marker exposes a one-click button to open the article in a new browser tab.

## Project Structure

- `app.py` – Streamlit application.
- `requirements.txt` – Python dependencies.

## 1) Get required API tokens

### A. NewsAPI token (required)

1. Go to [https://newsapi.org/register](https://newsapi.org/register).
2. Create an account and verify your email.
3. Open your account dashboard and copy your API key.

### B. Mapbox token (optional)

This implementation uses Plotly's orthographic globe and does **not** require Mapbox.

If you want to migrate to a Mapbox/PyDeck globe later:
1. Create an account at [https://account.mapbox.com/](https://account.mapbox.com/).
2. Open **Tokens** and create a new public token.
3. Save it as `MAPBOX_TOKEN` in your environment.

## 2) Setup and run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Set your NewsAPI key:

```bash
export NEWSAPI_KEY="your_newsapi_key_here"
```

Run the app:

```bash
streamlit run app.py
```

Then open the displayed local URL (typically `http://localhost:8501`).

## 3) How the geolocation pipeline works

1. The app requests `top-headlines` for multiple selected countries.
2. Each article is normalized to: `headline`, `summary`, `url`, `source`, and country code.
3. Country code is mapped to representative latitude/longitude coordinates.
4. Points are rendered as globe pins and refreshed on a timer.

## Notes

- The free NewsAPI plan may have usage limits and may not include all regions equally.
- If an API call fails for one country, the app skips that country and keeps running.
