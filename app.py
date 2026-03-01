"""Streamlit app that renders an interactive 3D-style globe with live geolocated news pins."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st
from streamlit_autorefresh import st_autorefresh

NEWS_API_BASE_URL = "https://newsapi.org/v2/top-headlines"
DEFAULT_COUNTRY_COORDINATES: dict[str, tuple[float, float]] = {
    "us": (39.8283, -98.5795),
    "gb": (55.3781, -3.4360),
    "fr": (46.2276, 2.2137),
    "de": (51.1657, 10.4515),
    "it": (41.8719, 12.5674),
    "es": (40.4637, -3.7492),
    "ca": (56.1304, -106.3468),
    "au": (-25.2744, 133.7751),
    "jp": (36.2048, 138.2529),
    "in": (20.5937, 78.9629),
    "br": (-14.2350, -51.9253),
    "mx": (23.6345, -102.5528),
    "za": (-30.5595, 22.9375),
    "ng": (9.0820, 8.6753),
    "ae": (23.4241, 53.8478),
    "sg": (1.3521, 103.8198),
    "kr": (35.9078, 127.7669),
    "ar": (-38.4161, -63.6167),
}


@dataclass
class NewsEvent:
    headline: str
    summary: str
    url: str
    source: str
    country: str
    latitude: float
    longitude: float


def _fetch_country_headlines_sync(api_key: str, country_code: str, page_size: int = 10) -> list[dict[str, Any]]:
    """Fetch top headlines for one country using requests."""
    response = requests.get(
        NEWS_API_BASE_URL,
        params={
            "apiKey": api_key,
            "country": country_code,
            "pageSize": page_size,
        },
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("articles", [])


async def fetch_news_events(api_key: str, country_codes: list[str], page_size: int = 6) -> pd.DataFrame:
    """Asynchronously collect and normalize geolocated news events across countries."""

    async def fetch_one(country_code: str) -> list[NewsEvent]:
        articles = await asyncio.to_thread(_fetch_country_headlines_sync, api_key, country_code, page_size)
        latitude, longitude = DEFAULT_COUNTRY_COORDINATES[country_code]
        events: list[NewsEvent] = []

        for article in articles:
            headline = article.get("title") or "Untitled headline"
            summary = article.get("description") or "No summary available for this headline."
            url = article.get("url") or ""
            source = (article.get("source") or {}).get("name") or "Unknown source"

            if not url:
                continue

            events.append(
                NewsEvent(
                    headline=headline,
                    summary=summary,
                    url=url,
                    source=source,
                    country=country_code.upper(),
                    latitude=latitude,
                    longitude=longitude,
                )
            )
        return events

    tasks = [fetch_one(country) for country in country_codes]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    collected: list[dict[str, Any]] = []
    for result in results:
        if isinstance(result, Exception):
            # Skip one failing country while keeping the app responsive.
            continue
        collected.extend(event.__dict__ for event in result)

    df = pd.DataFrame(collected)
    if not df.empty:
        df = df.drop_duplicates(subset=["headline", "url"]).reset_index(drop=True)
    return df


def render_globe(df: pd.DataFrame) -> go.Figure:
    """Build an orthographic globe with interactive pins and rich hover previews."""
    hover_template = (
        "<b>%{customdata[0]}</b><br>"
        "<i>%{customdata[1]}</i><br>"
        "%{customdata[2]}<br>"
        "<extra></extra>"
    )

    fig = go.Figure(
        data=[
            go.Scattergeo(
                lon=df["longitude"],
                lat=df["latitude"],
                mode="markers",
                marker={
                    "size": 10,
                    "opacity": 0.9,
                    "color": "#ff4b4b",
                    "line": {"width": 1, "color": "white"},
                },
                customdata=df[["headline", "source", "summary", "url"]],
                hovertemplate=hover_template,
            )
        ]
    )

    fig.update_layout(
        geo={
            "projection": {"type": "orthographic", "rotation": {"lon": 0, "lat": 20}},
            "showland": True,
            "landcolor": "rgb(19, 54, 88)",
            "showocean": True,
            "oceancolor": "rgb(4, 15, 30)",
            "showlakes": True,
            "lakecolor": "rgb(4, 15, 30)",
            "countrycolor": "rgb(140, 164, 190)",
            "showcountries": True,
            "showcoastlines": True,
            "coastlinecolor": "rgb(140, 164, 190)",
            "bgcolor": "rgba(0,0,0,0)",
        },
        height=760,
        margin={"l": 10, "r": 10, "t": 10, "b": 10},
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    return fig


def main() -> None:
    st.set_page_config(page_title="Globe News", page_icon="🌍", layout="wide")
    st.title("🌍 Live Global News Globe")
    st.caption("Rotate, zoom, and pan the globe. Hover pins for previews, click pins to open full articles.")

    refresh_minutes = st.sidebar.slider("Auto-refresh interval (minutes)", min_value=1, max_value=30, value=5)
    selected_countries = st.sidebar.multiselect(
        "Countries to monitor",
        options=sorted(DEFAULT_COUNTRY_COORDINATES.keys()),
        default=["us", "gb", "fr", "de", "jp", "in", "au", "br"],
    )

    if not selected_countries:
        st.warning("Select at least one country in the sidebar to load news pins.")
        return

    st_autorefresh(interval=refresh_minutes * 60 * 1000, key="news-refresh")

    api_key = os.getenv("NEWSAPI_KEY")
    if not api_key:
        st.error("Missing NEWSAPI_KEY environment variable. Add your API key before running the app.")
        st.stop()

    with st.spinner("Fetching real-time headlines and updating globe pins..."):
        news_df = asyncio.run(fetch_news_events(api_key=api_key, country_codes=selected_countries, page_size=8))

    if news_df.empty:
        st.warning("No news articles were returned from the API for the selected countries.")
        return

    globe = render_globe(news_df)
    selected = st.plotly_chart(
        globe,
        use_container_width=True,
        config={"scrollZoom": True, "displaylogo": False},
        on_select="rerun",
        selection_mode=["points"],
    )

    if selected and selected.get("selection") and selected["selection"].get("points"):
        point_index = selected["selection"]["points"][0]["point_index"]
        row = news_df.iloc[point_index]

        st.subheader("Selected Article")
        st.write(f"**{row['headline']}**")
        st.write(row["summary"])
        st.write(f"Source: {row['source']} ({row['country']})")
        st.link_button("Open full article", row["url"], use_container_width=False)

    last_updated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    st.caption(f"Last refreshed: {last_updated} | Pins loaded: {len(news_df)}")
    st.dataframe(news_df[["country", "source", "headline", "url"]], use_container_width=True, hide_index=True)


if __name__ == "__main__":
    main()
