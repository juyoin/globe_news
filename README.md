# Atlas Globe News

Interactive world map experience with live geolocated news intelligence.

## Features

- Premium-styled Google Maps globe UI
- Place search, map controls, and coordinate HUD
- Live News Intelligence side panel with map markers
- Gemini-powered article parsing and location extraction
- Multiple intelligence levels:
  - Standard (Global Pulse)
  - Conflict Watch
  - Green Horizon
  - Economic Engine
  - Cyber Frontier

## Tech Stack

- HTML, CSS, vanilla JavaScript
- Google Maps JavaScript API
- NewsAPI
- Gemini API (Generative Language API)
- OpenStreetMap Nominatim (geocoding)

## Project Structure

- `index.html` - Main page layout and map bootstrapping
- `style.css` - UI styling and animations
- `app.js` - Map logic, search, and news intelligence pipeline

## Run Locally

Because browser security can block some fetch behavior on `file://`, run with a local static server.

### Option A: Python

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080`

### Option B: VS Code Live Server

Open the folder and start Live Server from `index.html`.

## API Keys

This project currently includes API keys directly in source files:

- Google Maps key in `index.html`
- NewsAPI and Gemini keys in `app.js`

For production:

- Move keys to a backend or secure proxy
- Restrict Google Maps key by allowed HTTP referrers
- Never ship unrestricted keys

## Notes

- News fetching uses proxy fallbacks to bypass CORS limitations in browser-only mode.
- Nominatim geocoding is rate-limited in the client flow.
- If UI changes do not appear, hard refresh (`Ctrl+F5`).
